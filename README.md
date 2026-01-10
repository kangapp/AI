# AI 项目集合

> AI 相关的项目集合

---

## 项目导航

### 001 - 数据库查询工具 (DB Query Tool)

**路径**: `project/db_query/`

**简介**: 一个基于 AI 的智能数据库查询工具，支持自然语言转 SQL、多数据库连接、查询历史管理等功能。

**核心特性**:
- AI 智能查询：基于智谱 AI (glm-4-flash) 实现自然语言转 SQL
- 多数据库支持：MySQL、PostgreSQL、SQLite
- 实时架构浏览：树形展示表/视图结构，点击自动生成查询
- 查询历史管理：记录所有查询，支持重新执行和批量删除
- 结果导出：支持 CSV、JSON 格式导出

**技术栈**:
- 后端：Python 3.14+ / FastAPI / SQLAlchemy / zai-sdk
- 前端：TypeScript 5+ / React 18 / Vite / Ant Design / Monaco Editor

**快速开始**:
```bash
cd project/db_query
make install    # 安装依赖
make dev        # 启动前后端服务
```

访问：
- 前端：http://localhost:5173
- 后端 API：http://localhost:8000
- API 文档：http://localhost:8000/docs

**详细文档**: [project/db_query/README.md](project/db_query/README.md)

---

## 目录结构

```
AI/
├── project/                    # 项目目录
│   └── db_query/              # 数据库查询工具
│       ├── backend/           # Python 后端
│       ├── frontend/          # TypeScript 前端
│       └── Makefile           # 自动化脚本
├── CLAUDE.md                   # Claude Code 项目配置
└── README.md                   # 本文件
```

---

## 开发环境

### 环境要求

- Python 3.14+
- Node.js 18+
- uv (Python 包管理器)

### 通用命令

```bash
# 进入项目目录
cd project/db_query

# 安装依赖
make install

# 启动开发服务器
make dev

# 运行测试
make test

# 代码检查
make lint

# 停止服务
make stop
```

---

## 许可证

MIT License
