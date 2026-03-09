//! Audio capture using AVAudioEngine (via CoreAudio AudioUnit)
//!
//! This module provides macOS-specific audio capture using CoreAudio's
//! AudioUnit API, which is the underlying implementation for AVAudioEngine.
//! This bypasses cpal which has issues with `open` launch on macOS.
//!
//! Note: av-foundation 0.2 crate does not include AVAudioEngine API,
//! so we use CoreAudio AudioUnit directly as the implementation.

use coreaudio_sys::*;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use thiserror::Error;

/// Audio capture errors
#[derive(Error, Debug)]
pub enum CaptureError {
    /// No input device available
    #[error("No input device available")]
    NoInputDevice,

    /// Microphone permission denied
    #[error("Microphone permission denied")]
    PermissionDenied,

    /// Failed to get audio component
    #[error("Failed to get audio component: {0}")]
    ComponentNotFound(String),

    /// Failed to open audio component
    #[error("Failed to open audio component: {0}")]
    ComponentOpenFailed(String),

    /// Failed to set audio format
    #[error("Failed to set audio format: {0}")]
    FormatError(String),

    /// Failed to start audio unit
    #[error("Failed to start audio unit: {0}")]
    StartError(String),
}

/// Thread-safe buffer for audio data
pub struct RingBuffer {
    data: Vec<f32>,
    write_pos: usize,
    read_pos: usize,
    count: usize,
    max: f32,
}

impl RingBuffer {
    /// Create a new ring buffer with the given capacity
    pub fn new(capacity: usize) -> Self {
        Self {
            data: vec![0.0; capacity],
            write_pos: 0,
            read_pos: 0,
            count: 0,
            max: 0.0,
        }
    }

    /// Push a sample into the buffer
    fn push(&mut self, sample: f32) {
        if self.count < self.data.len() {
            self.data[self.write_pos] = sample;
            self.write_pos = (self.write_pos + 1) % self.data.len();
            self.count += 1;
            if sample.abs() > self.max {
                self.max = sample.abs();
            }
        }
    }

    /// Pop a sample from the buffer
    pub fn pop(&mut self) -> Option<f32> {
        if self.count > 0 {
            let sample = self.data[self.read_pos];
            self.read_pos = (self.read_pos + 1) % self.data.len();
            self.count -= 1;
            Some(sample)
        } else {
            None
        }
    }

    /// Get the number of samples in the buffer
    pub fn len(&self) -> usize {
        self.count
    }

    /// Clear the buffer
    fn clear(&mut self) {
        self.write_pos = 0;
        self.read_pos = 0;
        self.count = 0;
        self.max = 0.0;
    }

    /// Get the current max amplitude (with decay)
    pub fn get_max(&mut self) -> f32 {
        let m = self.max;
        self.max = self.max * 0.9; // Decay
        m
    }
}

/// Audio capture handle using CoreAudio AudioUnit
/// (underlying implementation for AVAudioEngine)
pub struct AudioCapture {
    /// The audio unit
    audio_unit: AudioUnit,
    /// Audio buffer (protected by mutex for thread safety)
    buffer: Arc<Mutex<RingBuffer>>,
    /// Flag indicating if capture is active
    is_capturing: Arc<AtomicBool>,
    /// Sample rate
    sample_rate: u32,
    /// Number of channels
    channels: u32,
    /// Callback context pointer (owned, must be freed in Drop)
    callback_context: *mut AudioCallbackContext,
}

impl AudioCapture {
    /// Create a new audio capture from default input device
    pub fn new() -> Result<Self, CaptureError> {
        // Get the default input device
        let device_id = get_default_input_device()?;

        let (sample_rate, channels) = get_device_format(device_id)?;

        tracing::info!(
            "[AVAudioEngine] Using device ID {}, {} Hz, {} channels",
            device_id,
            sample_rate,
            channels
        );

        // Create audio unit
        let audio_unit = create_audio_unit()?;

        // Enable input
        let enable_input: UInt32 = 1;
        let status = unsafe {
            AudioUnitSetProperty(
                audio_unit,
                kAudioOutputUnitProperty_EnableIO,
                kAudioUnitScope_Input,
                1, // Input element
                &enable_input as *const _ as *const std::ffi::c_void,
                std::mem::size_of::<UInt32>() as UInt32,
            )
        };
        if status != 0 {
            tracing::warn!("[AVAudioEngine] EnableIO returned: {}", status);
        }

        // Disable output
        let disable_output: UInt32 = 0;
        let status = unsafe {
            AudioUnitSetProperty(
                audio_unit,
                kAudioOutputUnitProperty_EnableIO,
                kAudioUnitScope_Output,
                0, // Output element
                &disable_output as *const _ as *const std::ffi::c_void,
                std::mem::size_of::<UInt32>() as UInt32,
            )
        };
        if status != 0 {
            tracing::warn!("[AVAudioEngine] Disable output returned: {}", status);
        }

        // Set device
        set_audio_unit_device(audio_unit, device_id)?;

        // Set format
        set_audio_unit_format(audio_unit, sample_rate, channels)?;

        // Create shared buffer and flag for callback
        let buffer = Arc::new(Mutex::new(RingBuffer::new(16384)));
        let is_capturing = Arc::new(AtomicBool::new(false));

        // Set callback BEFORE AudioUnitInitialize (this is critical!)
        let callback_context = Box::into_raw(Box::new(AudioCallbackContext {
            buffer: buffer.clone(),
            is_capturing: is_capturing.clone(),
        }));

        let callback = AURenderCallbackStruct {
            inputProc: Some(audio_input_callback),
            inputProcRefCon: callback_context as *mut std::ffi::c_void,
        };

        // Use kAudioUnitProperty_SetRenderCallback for input capture
        // Set on input scope element 1 to receive audio from microphone
        let status = unsafe {
            AudioUnitSetProperty(
                audio_unit,
                kAudioUnitProperty_SetRenderCallback,
                kAudioUnitScope_Input,
                1, // Input element (microphone)
                &callback as *const _ as *const std::ffi::c_void,
                std::mem::size_of::<AURenderCallbackStruct>() as UInt32,
            )
        };

        if status != 0 {
            tracing::error!("[AVAudioEngine] SetRenderCallback failed: {}", status);
            // Release callback_context since AudioUnit is not initialized yet
            // and the callback was never registered
            drop(unsafe { Box::from_raw(callback_context) });
            return Err(CaptureError::FormatError(format!(
                "Failed to set render callback: {}",
                status
            )));
        }
        tracing::info!("[AVAudioEngine] Render callback set successfully on input scope");

        // Initialize audio unit (callback must be set BEFORE this!)
        let status = unsafe { AudioUnitInitialize(audio_unit) };
        if status != 0 {
            // Release callback_context since AudioUnitInitialize failed
            // and AudioCapture won't be created (no Drop will be called)
            drop(unsafe { Box::from_raw(callback_context) });
            return Err(CaptureError::ComponentOpenFailed(format!(
                "AudioUnitInitialize failed: {}",
                status
            )));
        }

        tracing::info!(
            "Audio capture initialized: {} Hz, {} channels",
            sample_rate,
            channels
        );

        Ok(Self {
            audio_unit,
            buffer,
            is_capturing,
            sample_rate,
            channels,
            callback_context,
        })
    }

    /// Try to create a new audio capture (for wake-up purposes)
    pub fn try_new() -> Result<Self, CaptureError> {
        Self::new()
    }

    /// Get the sample rate
    pub fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    /// Get the number of channels
    pub fn channels(&self) -> u16 {
        self.channels as u16
    }

    /// Check if currently capturing
    pub fn is_capturing(&self) -> bool {
        self.is_capturing.load(Ordering::SeqCst)
    }

    /// Start capturing audio
    pub fn start(&mut self) -> Result<(), CaptureError> {
        if self.is_capturing() {
            tracing::warn!("Audio capture already in progress");
            return Ok(());
        }

        // Clear buffer
        {
            let mut buf = self.buffer.lock().unwrap();
            buf.clear();
        }

        // Set capturing flag (callback will check this)
        self.is_capturing.store(true, Ordering::SeqCst);

        // Start the audio unit (callback was set in new())
        let status = unsafe { AudioOutputUnitStart(self.audio_unit) };
        tracing::info!("[AVAudioEngine] AudioOutputUnitStart status: {}", status);
        if status != 0 {
            self.is_capturing.store(false, Ordering::SeqCst);
            return Err(CaptureError::StartError(format!(
                "AudioOutputUnitStart failed: {}",
                status
            )));
        }

        // Give the audio system time to start the data flow
        std::thread::sleep(std::time::Duration::from_millis(100));

        tracing::info!("Audio capture started");

        Ok(())
    }

    /// Pop samples from the buffer (for consumer)
    pub fn pop_samples(&self, output: &mut [f32]) -> usize {
        let mut buf = self.buffer.lock().unwrap();
        let mut count = 0;
        for sample in output.iter_mut() {
            match buf.pop() {
                Some(s) => {
                    *sample = s;
                    count += 1
                }
                None => break,
            }
        }
        count
    }

    /// Get the buffer Arc for external access
    pub fn buffer(&self) -> Arc<Mutex<RingBuffer>> {
        self.buffer.clone()
    }

    /// Get the current audio level (max amplitude)
    pub fn audio_level(&self) -> f32 {
        let mut buf = self.buffer.lock().unwrap();
        buf.get_max()
    }

    /// Check if there's data available
    pub fn has_data(&self) -> bool {
        let buf = self.buffer.lock().unwrap();
        buf.len() > 0
    }

    /// Get the name of the input device
    pub fn device_name(&self) -> String {
        "CoreAudio Input".to_string()
    }

    /// Stop capturing audio
    pub fn stop(&mut self) {
        if !self.is_capturing() {
            return;
        }

        self.is_capturing.store(false, Ordering::SeqCst);

        let status = unsafe { AudioOutputUnitStop(self.audio_unit) };
        if status != 0 {
            tracing::error!("AudioOutputUnitStop failed: {}", status);
        }

        // Clear buffer
        {
            let mut buf = self.buffer.lock().unwrap();
            buf.clear();
        }

        tracing::info!("Audio capture stopped");
    }
}

impl Default for AudioCapture {
    fn default() -> Self {
        Self::new().expect("Failed to initialize default audio capture")
    }
}

impl Drop for AudioCapture {
    fn drop(&mut self) {
        self.stop();
        unsafe {
            let _ = AudioUnitUninitialize(self.audio_unit);
            let _ = AudioComponentInstanceDispose(self.audio_unit);
            // Release the callback context that was allocated in new()
            if !self.callback_context.is_null() {
                drop(Box::from_raw(self.callback_context));
            }
        }
    }
}

/// Callback context
struct AudioCallbackContext {
    buffer: Arc<Mutex<RingBuffer>>,
    is_capturing: Arc<AtomicBool>,
}

/// Get the default input device ID
fn get_default_input_device() -> Result<AudioDeviceID, CaptureError> {
    let mut property_size: UInt32 = std::mem::size_of::<AudioDeviceID>() as UInt32;
    let mut device_id: AudioDeviceID = 0;

    let addr = AudioObjectPropertyAddress {
        mSelector: kAudioHardwarePropertyDefaultInputDevice,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMaster,
    };

    let status = unsafe {
        AudioObjectGetPropertyData(
            kAudioObjectSystemObject,
            &addr,
            0,
            std::ptr::null_mut(),
            &mut property_size,
            &mut device_id as *mut _ as *mut std::ffi::c_void,
        )
    };

    if status != 0 {
        tracing::error!("[AVAudioEngine] Failed to get default input device: status={}", status);
        return Err(CaptureError::NoInputDevice);
    }

    if device_id == 0 {
        tracing::error!("[AVAudioEngine] No input device available (device_id=0)");
        return Err(CaptureError::NoInputDevice);
    }

    tracing::info!("[AVAudioEngine] Default input device ID: {}", device_id);
    Ok(device_id)
}

/// Get the format (sample rate, channels) for a device
fn get_device_format(device_id: AudioDeviceID) -> Result<(u32, u32), CaptureError> {
    // Validate device ID
    if device_id == 0 {
        tracing::warn!("[AVAudioEngine] Invalid device ID, using defaults");
        return Ok((44100, 1));
    }

    // Get sample rate
    let mut property_size: UInt32 = std::mem::size_of::<Float64>() as UInt32;
    let mut sample_rate: Float64 = 44100.0;

    let addr = AudioObjectPropertyAddress {
        mSelector: kAudioDevicePropertyNominalSampleRate,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMaster,
    };

    let status = unsafe {
        AudioObjectGetPropertyData(
            device_id,
            &addr,
            0,
            std::ptr::null_mut(),
            &mut property_size,
            &mut sample_rate as *mut _ as *mut std::ffi::c_void,
        )
    };

    if status != 0 {
        tracing::warn!("[AVAudioEngine] Failed to get sample rate, using default");
        sample_rate = 44100.0;
    }

    // Get channel count using safer method
    let mut channel_count = 1u32;

    // Try to get input channel count using kAudioDevicePropertyStreamConfiguration
    let mut size: UInt32 = 0;
    let channel_addr = AudioObjectPropertyAddress {
        mSelector: kAudioDevicePropertyStreamConfiguration,
        mScope: kAudioDevicePropertyScopeInput,
        mElement: kAudioObjectPropertyElementMaster,
    };

    let status = unsafe {
        AudioObjectGetPropertyDataSize(
            device_id,
            &channel_addr,
            0,
            std::ptr::null_mut(),
            &mut size,
        )
    };

    if status == 0 && size > 0 && size < 65536 {
        // Allocate buffer for AudioBufferList
        let mut buffer: Vec<u8> = vec![0u8; size as usize];

        let status = unsafe {
            AudioObjectGetPropertyData(
                device_id,
                &channel_addr,
                0,
                std::ptr::null_mut(),
                &mut size,
                buffer.as_mut_ptr() as *mut std::ffi::c_void,
            )
        };

        if status == 0 {
            let bl = unsafe { &*(buffer.as_ptr() as *const AudioBufferList) };
            let num_buffers = bl.mNumberBuffers;
            if num_buffers > 0 {
                channel_count = 0;
                for i in 0..num_buffers as usize {
                    let buffer_ptr = unsafe { bl.mBuffers.as_ptr() };
                    let buffer_item = unsafe { buffer_ptr.add(i) };
                    channel_count += unsafe { (*buffer_item).mNumberChannels };
                }
            }
        }
    } else {
        tracing::warn!("[AVAudioEngine] Failed to get stream config size, trying alternative");
    }

    tracing::info!(
        "[AVAudioEngine] Device format: {} Hz, {} channels",
        sample_rate as u32,
        channel_count
    );

    Ok((sample_rate as u32, channel_count))
}

/// Create an audio unit for input
fn create_audio_unit() -> Result<AudioUnit, CaptureError> {
    let component_desc = AudioComponentDescription {
        componentType: kAudioUnitType_Output,
        componentSubType: kAudioUnitSubType_HALOutput,
        componentManufacturer: kAudioUnitManufacturer_Apple,
        componentFlags: 0,
        componentFlagsMask: 0,
    };

    let component = unsafe { AudioComponentFindNext(std::ptr::null_mut(), &component_desc) };
    if component.is_null() {
        return Err(CaptureError::ComponentNotFound(
            "Could not find HAL Output audio unit".to_string(),
        ));
    }

    let mut audio_unit: AudioUnit = std::ptr::null_mut();
    let status = unsafe { AudioComponentInstanceNew(component, &mut audio_unit) };
    if status != 0 || audio_unit.is_null() {
        return Err(CaptureError::ComponentOpenFailed(format!(
            "Failed to create audio unit instance: {}",
            status
        )));
    }

    Ok(audio_unit)
}

/// Set the audio unit to use a specific device
fn set_audio_unit_device(audio_unit: AudioUnit, device_id: AudioDeviceID) -> Result<(), CaptureError> {
    let device_id: UInt32 = device_id;
    let status = unsafe {
        AudioUnitSetProperty(
            audio_unit,
            kAudioOutputUnitProperty_CurrentDevice,
            kAudioUnitScope_Global,
            0,
            &device_id as *const _ as *const std::ffi::c_void,
            std::mem::size_of::<UInt32>() as UInt32,
        )
    };

    if status != 0 {
        return Err(CaptureError::ComponentOpenFailed(format!(
            "Failed to set device: {}",
            status
        )));
    }

    Ok(())
}

/// Set the audio format for the audio unit
fn set_audio_unit_format(
    audio_unit: AudioUnit,
    sample_rate: u32,
    channels: u32,
) -> Result<(), CaptureError> {
    let format = AudioStreamBasicDescription {
        mSampleRate: sample_rate as Float64,
        mFormatID: kAudioFormatLinearPCM,
        mFormatFlags: kAudioFormatFlagIsFloat | kAudioFormatFlagIsPacked,
        mBytesPerPacket: (4 * channels) as UInt32,
        mFramesPerPacket: 1,
        mBytesPerFrame: (4 * channels) as UInt32,
        mChannelsPerFrame: channels,
        mBitsPerChannel: 32,
        mReserved: 0,
    };

    let status = unsafe {
        AudioUnitSetProperty(
            audio_unit,
            kAudioUnitProperty_StreamFormat,
            kAudioUnitScope_Input,
            1, // Input element
            &format as *const _ as *const std::ffi::c_void,
            std::mem::size_of::<AudioStreamBasicDescription>() as UInt32,
        )
    };

    if status != 0 {
        return Err(CaptureError::FormatError(format!(
            "Failed to set stream format: {}",
            status
        )));
    }

    Ok(())
}

/// Input callback for audio unit
/// For Input Unit with SetRenderCallback on input scope, io_data contains the audio data
static CALLBACK_COUNT: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);

unsafe extern "C" fn audio_input_callback(
    in_ref_con: *mut std::ffi::c_void,
    _io_action_flags: *mut UInt32,
    _in_time_stamp: *const AudioTimeStamp,
    _in_bus_number: UInt32,
    in_num_frames: UInt32,
    io_data: *mut AudioBufferList,
) -> OSStatus {
    let count = CALLBACK_COUNT.fetch_add(1, Ordering::SeqCst);
    if count < 5 {
        tracing::info!("[AVAudioEngine-CB] callback #{}, frames={}", count, in_num_frames);
    }

    let context = &*(in_ref_con as *mut AudioCallbackContext);

    if !context.is_capturing.load(Ordering::SeqCst) {
        return 0;
    }

    if io_data.is_null() {
        tracing::warn!("[AVAudioEngine-CB] io_data is null");
        return -1;
    }

    let buf_list = &mut *io_data;

    // Get buffer
    let mut buffer = match context.buffer.lock() {
        Ok(b) => b,
        Err(_) => return -1,
    };

    // Process each buffer
    let mut total_samples = 0u32;
    for i in 0..buf_list.mNumberBuffers {
        let buffer_item = &mut buf_list.mBuffers[i as usize];
        if buffer_item.mDataByteSize == 0 || buffer_item.mData.is_null() {
            continue;
        }

        let samples = buffer_item.mData as *const Float32;
        let frame_count = buffer_item.mDataByteSize / std::mem::size_of::<Float32>() as UInt32;
        total_samples += frame_count;

        // Copy samples to our buffer
        for j in 0..frame_count as usize {
            let sample = *samples.add(j);
            buffer.push(sample);
        }
    }

    if total_samples > 0 {
        tracing::debug!("[AVAudioEngine-CB] received {} samples, buffer len={}", total_samples, buffer.len());
    } else {
        tracing::warn!("[AVAudioEngine-CB] no samples in io_data!");
    }

    0
}
