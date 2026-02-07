// Library entry point for Tauri

// 声明模块
pub mod audio;
pub mod transcription;
pub mod commands;
pub mod injection;
pub mod system_tray;
pub mod perf;

// Re-export the main run function (for binary)
pub use commands::run;
