//! Audio capture and processing pipeline

#[cfg(target_os = "macos")]
mod capture_avfoundation;
#[cfg(not(target_os = "macos"))]
mod capture;
mod pipeline;
mod resampler;

#[cfg(target_os = "macos")]
pub use capture_avfoundation::*;
#[cfg(not(target_os = "macos"))]
pub use capture::*;
pub use pipeline::*;
pub use resampler::*;
