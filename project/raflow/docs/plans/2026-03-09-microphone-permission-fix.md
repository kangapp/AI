# 修复麦克风权限 - 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**目标:** 修复 Tauri v2 麦克风权限配置，确保应用在首次启动时能正确请求并获得麦克风授权

**架构:** 通过 Tauri v2 的 capabilities 系统添加麦克风权限，让系统在应用首次访问麦克风时弹出授权对话框

**技术栈:** Tauri v2, Capabilities, macOS TCC

---

## 任务 1: 添加麦克风权限到 Capabilities

**文件:**
- 修改: `src-tauri/capabilities/default.json`

**步骤 1: 添加麦克风权限**

在 permissions 数组中添加麦克风相关权限:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capabilities for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:event:default",
    "core:event:allow-emit",
    "core:event:allow-emit-to",
    "core:event:allow-listen",
    "core:window:default",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-set-focus",
    "global-shortcut:default",
    "notification:default"
  ]
}
```

修改为:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capabilities for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:event:default",
    "core:event:allow-emit",
    "core:event:allow-emit-to",
    "core:event:allow-listen",
    "core:window:default",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-set-focus",
    "global-shortcut:default",
    "notification:default"
  ]
}
```

**注意:** cpal 是直接调用 CoreAudio，不通过 Tauri 插件系统。所以 capabilities 添加可能不够。

---

## 任务 2: 验证麦克风权限请求流程

**步骤 1: 重新构建应用**

```bash
cd /Users/liufukang/workplace/AI/project/raflow
npx tauri build 2>&1 | tail -15
```

**步骤 2: 测试 open 启动**

```bash
pkill -9 -f "raflow" 2>/dev/null
rm -f /tmp/raflow.log
open /Users/liufukang/workplace/AI/project/raflow/src-tauri/target/release/bundle/macos/RaFlow.app
```

**步骤 3: 检查是否有权限弹窗**

- 首次启动时 macOS 应该弹出 "RaFlow 想访问麦克风" 对话框
- 用户需要点击"允许"

---

## 任务 3: 如果权限仍不工作 - 添加硬编码权限请求

如果任务 2 仍然没有弹出权限对话框，需要在 Rust 代码中显式请求麦克风权限。

**文件:**
- 修改: `src-tauri/src/audio/capture.rs`

**步骤 1: 添加麦克风权限请求代码**

在 `AudioCapture::new()` 函数开头添加:

```rust
// Request microphone permission on macOS
#[cfg(target_os = "macos")]
{
    use std::process::Command;
    // Try to use system_profiler to trigger permission dialog
    let _ = Command::new("system_profiler")
        .args(["-json", "SPAudioDataType"])
        .output();
}
```

**步骤 2: 重新构建**

```bash
npx tauri build 2>&1 | tail -10
```

---

## 任务 4: 测试验证

**步骤 1: 清理权限缓存**

```bash
# 关闭所有可能使用麦克风的进程
pkill -9 -f "raflow"

# 检查 TCC 数据库
sqlite3 ~/Library/Application\ Support/com.apple.TCC/TCC.db "SELECT client, service FROM access WHERE service LIKE '%microphone%'" 2>/dev/null
```

**步骤 2: 重新构建并测试**

```bash
# 构建
npx tauri build 2>&1 | tail -10

# 启动（open 方式）
rm -f /tmp/raflow.log
open /Users/liufukang/workplace/AI/project/raflow/src-tauri/target/release/bundle/macos/RaFlow.app

# 等待启动完成
sleep 5
tail -20 /tmp/raflow.log
```

**预期结果:**
- 如果权限未授权：系统弹出授权对话框
- 如果权限已授权：麦克风数据应该能正常采集

---

## 验证标准

| 检查项 | 预期 |
|--------|------|
| 构建成功 | ✅ 无编译错误 |
| 权限弹窗 | macOS 首次弹出授权对话框 |
| 麦克风数据 | RMS > 0 当对着麦克风说话时 |

---

**Plan complete and saved to `docs/plans/2026-03-09-microphone-permission-fix.md`.**

## 执行方式选择

**1. Subagent-Driven (本会话)** - 每个任务分配子代理，任务间审查，快速迭代

**2. Parallel Session (独立会话)** - 新会话中执行，带检查点

选择哪个方式？
