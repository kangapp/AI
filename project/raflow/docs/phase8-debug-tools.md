# Phase 8: 调试工具与开发者体验

本文档描述 RaFlow 的调试工具和开发者体验功能。

## 概述

Phase 8 实现了以下功能：

1. **调试模式** - 运行时控制日志级别和模块过滤
2. **前端调试面板** - 可视化配置调试选项
3. **结构化日志** - 基于 tracing 的日志系统

## 架构

### 后端 (Rust)

#### 调试模式模块 (`src-tauri/src/debug/`)

```
src-tauri/src/debug/
├── mod.rs          # 调试状态管理、日志配置
└── 全局单例        # 使用 OnceLock 实现线程安全全局状态
```

**核心类型:**

- `LogLevel` - 日志级别枚举 (Trace/Debug/Info/Warn/Error)
- `DebugConfig` - 调试配置（支持构建器模式）
- `DebugState` - 调试状态（启用/禁用、级别、目标过滤）

**全局状态:**

```rust
// 获取全局调试状态
let state = raflow::debug::global_debug_state();

// 便捷函数
raflow::debug::enable_debug();
raflow::debug::disable_debug();
raflow::debug::toggle_debug();
raflow::debug::set_log_level(LogLevel::Debug);
```

#### Tauri 命令 (`src-tauri/src/commands.rs`)

| 命令 | 描述 | 返回值 |
|------|------|--------|
| `enable_debug_mode` | 启用调试模式 | `DebugStatus` |
| `disable_debug_mode` | 禁用调试模式 | `DebugStatus` |
| `toggle_debug_mode` | 切换调试模式 | `DebugStatus` |
| `get_debug_status` | 获取调试状态 | `DebugStatus` |
| `set_debug_log_level` | 设置日志级别 | `DebugStatus` |
| `add_debug_include_target` | 添加白名单模块 | `DebugStatus` |
| `remove_debug_include_target` | 移除白名单模块 | `DebugStatus` |
| `add_debug_exclude_target` | 添加黑名单模块 | `DebugStatus` |
| `remove_debug_exclude_target` | 移除黑名单模块 | `DebugStatus` |

**DebugStatus 结构:**

```typescript
interface DebugStatus {
  enabled: boolean;
  log_level: string;
  include_targets: string[];
  exclude_targets: string[];
}
```

### 前端 (React/TypeScript)

#### useDebug Hook (`src/hooks/useDebug.ts`)

```typescript
import { useDebug } from '@/hooks/useDebug';

function MyComponent() {
  const {
    isEnabled,           // 是否启用调试模式
    logLevel,            // 当前日志级别
    includeTargets,      // 白名单模块
    excludeTargets,      // 黑名单模块
    toggle,              // 切换调试模式
    setLogLevel,         // 设置日志级别
    addIncludeTarget,    // 添加白名单
    removeIncludeTarget, // 移除白名单
    addExcludeTarget,    // 添加黑名单
    removeExcludeTarget, // 移除黑名单
    isLoading,           // 操作进行中
  } = useDebug();

  return (
    <button onClick={() => toggle()}>
      {isEnabled ? '禁用调试' : '启用调试'}
    </button>
  );
}
```

#### DebugPanel 组件 (`src/components/DebugPanel.tsx`)

可视化调试面板，提供：

- 调试模式开关
- 日志级别选择器
- 白名单/黑名单模块管理
- 实时状态更新

```typescript
import { DebugPanel } from '@/components/DebugPanel';

function App() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>打开调试面板</button>
      <DebugPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
```

## 日志系统

### 初始化

在 `main.rs` 中初始化 tracing 日志系统：

```rust
fn main() {
    // 初始化 tracing 日志系统
    raflow::debug::init_tracing();

    // 运行 Tauri 应用
    raflow::run();
}
```

### 使用日志

```rust
use tracing::{info, debug, error, instrument};

#[instrument]
fn my_function(x: i32) -> Result<(), String> {
    debug!(value = x, "Processing value");
    info!("Operation completed");
    Err("Something went wrong".into())
}
```

### 日志级别

| 级别 | 用途 |
|------|------|
| Trace | 最详细的诊断信息 |
| Debug | 诊断信息，开发调试 |
| Info | 一般信息，正常运行 |
| Warn | 警告信息，可能有问题 |
| Error | 错误信息，操作失败 |

### 模块过滤

使用 Rust 模块路径过滤日志：

```
# 启用特定模块的 Debug 日志
raflow::audio=debug

# 禁用特定模块
raflow::perf=off

# 通配符
raflow::*=info
```

## 测试

### 后端测试

运行调试模式测试：

```bash
cd src-tauri
cargo test --test debug_mode_tests
```

**测试覆盖:**
- DebugState 默认状态
- 启用/禁用/切换调试模式
- 日志级别设置
- 白名单/黑名单管理
- DebugConfig 构建器
- LogLevel 字符串解析

### 前端测试

```bash
npm run build
```

## 使用示例

### 场景 1: 诊断音频问题

1. 打开调试面板
2. 启用调试模式
3. 设置日志级别为 Debug
4. 添加白名单: `raflow::audio`
5. 重启应用
6. 查看控制台日志

### 场景 2: 性能分析

1. 打开调试面板
2. 启用调试模式
3. 设置日志级别为 Trace
4. 添加白名单: `raflow::perf`, `raflow::audio`
5. 重启应用
6. 使用性能面板监控指标

### 场景 3: 禁用冗余日志

1. 打开调试面板
2. 启用调试模式
3. 添加黑名单: `raflow::perf`
4. 重启应用
5. 性能日志将被禁用

## 限制

1. **日志配置重启生效** - 日志级别和模块过滤在应用启动时配置，运行时修改需要重启应用才能生效。

2. **tracing subscriber 不可重载** - tracing-subscriber 不支持运行时重新加载配置。

3. **未来扩展** - 可以实现日志重新加载功能或使用支持动态配置的日志系统。

## 性能影响

| 级别 | 性能影响 | 推荐用途 |
|------|----------|----------|
| Error | 极小 | 生产环境 |
| Warn | 极小 | 生产环境 |
| Info | 小 | 生产环境 |
| Debug | 中等 | 开发/测试 |
| Trace | 大 | 深度诊断 |

## 相关文件

### 后端
- `src-tauri/src/debug/mod.rs` - 调试模式实现
- `src-tauri/src/commands.rs` - Tauri 调试命令
- `src-tauri/src/main.rs` - 日志初始化
- `src-tauri/tests/debug_mode_tests.rs` - 调试模式测试

### 前端
- `src/hooks/useDebug.ts` - 调试模式 Hook
- `src/components/DebugPanel.tsx` - 调试面板组件
- `src/types/index.ts` - 调试相关类型定义
- `src/components/FloatingWindow.tsx` - 集成调试面板入口

## 测试统计

- **后端测试**: 12 个调试模式测试全部通过
- **总测试数**: 151 个测试全部通过（Phase 8 新增 12 个）

## 下一步

- Phase 9: 测试与验证
- Phase 10: 打包与部署
