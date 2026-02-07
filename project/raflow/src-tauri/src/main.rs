// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // 初始化 tracing 日志系统
    // 注意：必须在应用启动早期调用，且只能调用一次
    raflow::debug::init_tracing();

    // 运行 Tauri 应用
    raflow::run();
}
