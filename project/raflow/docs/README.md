# RaFlow - 实时语音转文字桌面应用

## 简介

RaFlow 是一个基于 Tauri v2 的实时语音转文字桌面应用，支持 ElevenLabs Scribe v2 Realtime API、全局快捷键、智能文本注入等功能。

## 主要功能

- ✅ **实时语音转文字** - 使用 ElevenLabs Scribe v2 Realtime API
- ✅ **全局快捷键** - Command+Shift+R (macOS) 或 Ctrl+Shift+R (Windows/Linux)
- ✅ **智能文本注入** - 自动检测可编辑元素，优先直接注入
- ✅ **系统托盘** - 常驻后台，提供快捷菜单
- ✅ **悬浮窗显示** - 实时显示转录结果
- ✅ **多语言支持** - 中文、英语、日语、韩语等 29 种语言
- ✅ **性能监控** - 实时性能指标显示
- ✅ **调试模式** - 开发者调试工具

## 系统要求

### macOS
- macOS 10.13 或更高版本
- Intel 或 Apple Silicon (M1/M2) 处理器

### Windows
- Windows 10 或更高版本
- x64 架构

### Linux
- 任何现代 Linux 发行版
- x64 架构

## 安装

### macOS

下载 `.dmg` 文件，打开并拖拽到应用程序文件夹。

### Windows

下载 `.exe` 安装程序，运行并按照提示完成安装。

### Linux

下载 `.AppImage` 文件，添加执行权限并运行：

```bash
chmod +x RaFlow-0.1.0.AppImage
./RaFlow-0.1.0.AppImage
```

## 配置

首次运行时，需要配置以下内容：

1. **ElevenLabs API 密钥**
   - 在 ElevenLabs 控制台创建 API 密钥
   - 在应用设置中输入密钥

2. **麦克风权限**
   - 应用会请求麦克风访问权限
   - 允许应用访问麦克风

3. **辅助功能权限（macOS）**
   - 启用智能文本注入需要辅助功能权限
   - 在系统偏好设置 > 安全性与隐私 > 辅助功能中添加 RaFlow

## 使用方法

### 开始录音

1. 点击录音按钮或使用全局快捷键 `Command+Shift+R` (macOS) / `Ctrl+Shift+R` (Windows/Linux)
2. 对着麦克风说话
3. 应用会实时显示转录结果
4. 再次点击录音按钮或使用快捷键停止录音

### 注入文本

1. 确保已停止录音
2. 点击"注入文本"按钮
3. 应用会自动将文本注入到当前可编辑元素

### 性能监控

点击性能指标按钮（图表图标）查看实时性能数据。

### 调试模式

点击调试按钮（代码图标）打开调试面板，配置日志级别和模块过滤。

## 全局快捷键

| 快捷键 | 功能 |
|--------|------|
| Command+Shift+R (macOS) / Ctrl+Shift+R (Windows/Linux) | 切换录音状态 |

## 技术规格

- **前端**: React 18 + TypeScript + Vite + Tailwind CSS
- **后端**: Tauri v2 + Rust
- **音频处理**: cpal + rubato + ringbuf
- **转录服务**: ElevenLabs Scribe v2 Realtime API

## 性能指标

- 端到端延迟: < 200ms
- 音频采集延迟: < 50ms
- 内存占用: < 100MB（空闲）
- CPU 占用: < 5%（录音时）

## 隐私说明

- RaFlow 仅在录音时访问麦克风
- 录音数据通过安全连接发送到 ElevenLabs API
- 转录结果仅存储在本地，不上传到其他服务器
- 剪贴板访问仅用于文本注入功能

## 故障排除

### 录音没有反应

1. 检查麦克风权限是否已授予
2. 确认 ElevenLabs API 密钥是否正确配置
3. 查看调试日志获取详细错误信息

### 文本注入失败

1. 确认应用有辅助功能权限（macOS）
2. 确保当前焦点在可编辑元素上
3. 尝试手动粘贴（Cmd+V / Ctrl+V）

### 应用无法启动

1. 确认操作系统版本符合要求
2. 检查是否有杀毒软件阻止应用运行
3. 查看系统日志获取错误信息

## 开源许可

MIT License

## 支持

- GitHub Issues: https://github.com/your-org/raflow/issues
- 邮箱: support@raflow.app

## 致谢

- Tauri 团队
- ElevenLabs 团队
- 所有开源贡献者
