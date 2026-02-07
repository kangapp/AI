// Library entry point for Tauri

// 声明模块
pub mod audio;
pub mod transcription;
pub mod commands;

// Re-export the main run function (for binary)
pub use commands::run;
