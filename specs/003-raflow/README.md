# RaFlow 项目设计文档索引

## 文档概述

本目录包含 RaFlow (Real-time Assistant Flow) 项目的完整设计文档。

**项目状态**: 设计阶段 → 准备启动开发

**最后更新**: 2026-02-07

---

## 文档结构

### 核心设计文档

| 文档 | 描述 | 页数 |
|------|------|------|
| [0001-spec.md](./0001-spec.md) | 技术规格报告 - ElevenLabs Scribe v2 与 Tauri v2 深度解析 | ~700 |
| [0002-design.md](./0002-design.md) | 系统设计文档 - 完整架构与组件设计 | ~1000 |
| [0003-implementation.md](./0003-implementation.md) | 原始实施计划 - 三阶段开发路线图 | ~2500 |

### 补充设计文档 (新增)

| 文档 | 描述 | 页数 |
|------|------|------|
| [0004-performance-and-testing.md](./0004-performance-and-testing.md) | **性能优化与测试策略** - 详细优化方案和测试覆盖 | ~800 |
| [0005-mvp-implementation-plan.md](./0005-mvp-implementation-plan.md) | **MVP 优先实施计划** - 4 周快速交付方案 | ~600 |

---

## 快速导航

### 如果您是...

**新加入的开发者**:
1. 先阅读 [0005-mvp-implementation-plan.md](./0005-mvp-implementation-plan.md) - 了解开发计划
2. 再阅读 [0002-design.md](./0002-design.md) - 理解系统架构
3. 参考 [0004-performance-and-testing.md](./0004-performance-and-testing.md) - 编写测试

**项目经理**:
1. 查看 [0005-mvp-implementation-plan.md](./0005-mvp-implementation-plan.md) - 时间线与里程碑
2. 参考 [0003-implementation.md](./0003-implementation.md) - 详细任务分解

**架构师/技术负责人**:
1. [0002-design.md](./0002-design.md) - 完整架构设计
2. [0004-performance-and-testing.md](./0004-performance-and-testing.md) - 性能与质量保证

### 如果您想了解...

**技术选型原因**: [0001-spec.md](./0001-spec.md) 第 1-2 部分

**音频处理细节**: [0002-design.md](./0002-design.md) 第 3.1 节 + [0004-performance-and-testing.md](./0004-performance-and-testing.md) 第 1.2 节

**文本注入策略**: [0002-design.md](./0002-design.md) 第 3.2 节

**性能优化方案**: [0004-performance-and-testing.md](./0004-performance-and-testing.md) 第一部分

**测试策略**: [0004-performance-and-testing.md](./0004-performance-and-testing.md) 第二部分

**MVP 开发计划**: [0005-mvp-implementation-plan.md](./0005-mvp-implementation-plan.md)

---

## 文档关系图

```
0001-spec.md (技术规格)
      ↓
      ├─→ 0002-design.md (系统设计)
      │         ↓
      │         ├─→ 0003-implementation.md (原始计划)
      │         └─→ 0005-mvp-implementation-plan.md (MVP计划) ✨
      │
      └─→ 0004-performance-and-testing.md (性能与测试) ✨
```

✨ = 新增补充文档

---

## 核心设计决策

### 技术栈

| 层级 | 技术 | 理由 |
|------|------|------|
| 框架 | Tauri v2 | 轻量级、原生性能、Rust 后端 |
| 前端 | React 19 + TypeScript | 成熟生态、类型安全 |
| 音频 | cpal + rubato | 跨平台、高质量重采样 |
| STT | ElevenLabs Scribe v2 | 超低延迟、高准确率 |
| 注入 | enigo + arboard | 跨平台输入模拟 |

### 架构原则

1. **MVP 优先**: 4 周交付可测试版本
2. **渐进增强**: Phase 1 (剪贴板) → Phase 2 (注入) → Phase 3 (完善)
3. **性能优先**: 零拷贝、无锁设计、SIMD 加速
4. **测试驱动**: 单元测试覆盖率 > 80%

---

## 实施计划摘要

### MVP (4 周)

**Week 1**: 基础架构 + 音频可视化
**Week 2**: 音频采集 + ElevenLabs 集成 + 剪贴板
**Week 3**: 全局热键 + 设置 + 错误处理
**Week 4**: 性能优化 + UI 打磨 + 打包

**交付物**: 可公开测试的 Beta 版本

### Phase 2 (4 周)

**Week 5-6**: Accessibility API 集成
**Week 7**: 光标位置注入
**Week 8**: 测试与优化

**新增**: 智能文本注入

### Phase 3 (6 周)

**Week 9-10**: Windows 支持
**Week 11-12**: 离线模式 (Whisper)
**Week 13-14**: 产品打磨

**交付**: 正式 v1.0 版本

---

## 性能目标

| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| 冷启动时间 | < 500ms | 命令到首帧音频 |
| 首字延迟 | < 300ms | 说话到首字显示 |
| 端到端延迟 | < 500ms | 说话到剪贴板 |
| 内存占用 | < 50MB | 空闲状态 |
| CPU 占用 | < 5% | 录音状态 |

---

## 下一步行动

### 立即可执行

1. **创建项目仓库**
   ```bash
   mkdir raflow && cd raflow
   npm create tauri-app@latest
   ```

2. **配置开发环境**
   - 安装 Rust 1.77+
   - 安装 Node.js 22+
   - 配置 VS Code 插件

3. **开始 Week 1 任务**
   - 参考 [0005-mvp-implementation-plan.md](./0005-mvp-implementation-plan.md) 第 3 节

### 需要讨论

- [ ] 确定 API Key 管理策略
- [ ] 确认是否需要代码签名证书
- [ ] 确认测试团队成员
- [ ] 确认 Beta 发布渠道

---

## 版本历史

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-01-18 | 1.0.0 | 初始设计文档 (0001-0003) |
| 2026-02-07 | 1.1.0 | 添加性能与测试补充 (0004) |
| 2026-02-07 | 1.2.0 | 优化 MVP 实施计划 (0005) |

---

## 贡献指南

设计文档变更请遵循:

1. 使用语义化版本号
2. 在文档底部记录变更历史
3. 保持 Markdown 格式一致
4. 图表使用 Mermaid 语法
5. 代码指定语言高亮

---

**维护者**: TBC

**最后审核**: 2026-02-07

**状态**: ✅ 设计完成，准备启动开发
