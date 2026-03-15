# AI 项目集合

> AI 相关的项目集合

---

## 目录

- [001 - 数据库查询工具 (DB Query Tool)](#001---数据库查询工具-db-query-tool)
- [002 - RaFlow (实时语音转录工具)](#002---raflow-实时语音转录工具)

---

## 项目导航

### 001 - 数据库查询工具 (DB Query Tool)

**路径**: `project/db_query/`

**简介**: 一个基于 AI 的智能数据库查询工具，支持自然语言转 SQL、多数据库连接、查询历史管理等功能。

**核心特性**:
- **AI 智能查询**：基于智谱 AI (glm-4-flash) 实现自然语言转 SQL
- **多数据库支持**：MySQL、PostgreSQL、SQLite
- **实时架构浏览**：树形展示表/视图结构，点击自动生成查询
- **查询历史管理**：记录所有查询，支持重新执行和批量删除，分页展示
- **结果导出**：支持 CSV、JSON 格式导出
- **性能监控**：实时系统指标监控、慢查询跟踪、HTTP 请求性能分析
- **Web 性能监控**：Core Web Vitals 收集、性能评分和评级
- **连接池管理**：自动管理数据库连接，空闲超时清理
- **速率限制**：API 级别速率限制，防止滥用
- **结构化日志**：JSON 格式日志，便于分析和监控
- **完整测试覆盖**：单元测试、集成测试、性能测试

**技术栈**:
- **后端**：Python 3.14+ / FastAPI / SQLAlchemy / aiosqlite / zai-sdk / slowapi / structlog / tenacity / psutil / pytest
- **前端**：TypeScript 5+ / React 18 / Vite / Ant Design / Monaco Editor / React Query / Refinedev / web-vitals / @playwright/test

**快速开始**:
```bash
cd project/db_query
make install    # 安装依赖
make dev        # 启动前后端服务
```

访问：
- **前端**：http://localhost:5173
- **后端 API**：http://localhost:8000
- **API 文档**：http://localhost:8000/docs

**详细文档**: [project/db_query/README.md](project/db_query/README.md)

---

### 002 - RaFlow (实时语音转录工具)

**路径**: `project/raflow/`

**简介**: 一款基于 Tauri 构建的 macOS 悬浮窗应用，提供实时语音转录功能。通过全局快捷键快速调用悬浮窗进行录音，并将音频实时转换为文字。

**核心特性**:
- **悬浮窗设计**：轻量级悬浮窗，始终置顶，不影响其他工作
- **实时转录**：边说边转，实时显示转录结果
- **全局快捷键**：支持自定义快捷键快速启动录音
- **音频可视化**：录音时实时显示音频波形
- **自定义外观**：可调整字体大小、颜色、背景透明度
- **多种音频风格**：支持不同的音频样式显示效果
- **系统托盘**：支持托盘图标，后台运行
- **剪贴板集成**：一键复制转录结果

**技术栈**:
- **前端**：React 18 / TypeScript / Vite / Tailwind CSS / Framer Motion
- **后端**：Tauri 2.0 / Rust
- **音频处理**：cpal / av-foundation / rubato
- **实时通信**：tokio / tokio-tungstenite

**快速开始**:
```bash
cd project/raflow
pnpm install     # 安装依赖
pnpm tauri dev  # 启动开发模式
```

构建应用：
```bash
pnpm tauri build
```

**详细文档**: [project/raflow/README.md](project/raflow/README.md)
