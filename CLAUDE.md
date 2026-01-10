# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

全栈数据库查询工具，支持 MySQL、PostgreSQL、SQLite，具备自然语言转SQL的AI功能。

**技术栈**: Python 3.14+ (FastAPI) + React 18 (TypeScript + Vite + Ant Design)

## 开发命令

### 使用 Makefile（推荐）
```bash
make dev          # 同时启动前后端开发服务器
make backend-run  # 仅启动后端（端口 8000）
make frontend-run # 仅启动前端（端口 5173）
make stop         # 停止所有服务器
make install      # 安装所有依赖
make lint         # 运行代码检查
make format       # 格式化代码
make test         # 运行测试
make clean        # 清理构建产物
```

### 后端 (backend/)
```bash
uv sync                                    # 安装依赖
uv run uvicorn src.api.main:app --reload  # 开发服务器（端口 8000）
uv run mypy src                            # 类型检查（strict模式）
uv run ruff check src                      # 代码检查
uv run ruff format src                     # 格式化（100字符行宽）
uv run pytest                              # 运行测试
```

### 前端 (frontend/)
```bash
npm install          # 安装依赖
npm run dev          # 开发服务器（端口 5173）
npm run build        # 生产构建
npm run type-check   # TypeScript类型检查
npm run preview      # 预览生产构建
```

## 架构概览

### 后端架构

**核心服务** (`backend/src/services/`):
- `DatabaseService` - 数据库连接池管理，支持连接缓存和超时清理
- `MetadataService` - 元数据提取和缓存，SQL注入防护（标识符验证）
- `QueryService` - SQL执行、历史记录、结果导出
- `LLMService` - 自然语言转SQL（智谱AI glm-4-flash）

**API层** (`backend/src/api/v1/`):
- `databases.py` - 数据库CRUD操作
- `queries.py` - 查询执行、自然语言查询、历史记录、导出

**数据模型** (`backend/src/models/`):
- 使用 Pydantic，所有模型继承 `CamelModel`（驼峰命名响应）
- `database.py` - 数据库连接模型
- `query.py` - 查询请求/响应模型
- `metadata.py` - 元数据模型

**核心功能** (`backend/src/core/`):
- `sqlite_db.py` - 应用内部SQLite（存储连接信息和历史）
- `sql_parser.py` - SQL解析器包装（sqlglot，只允许SELECT）
- `config.py` - Pydantic Settings配置管理

### 前端架构

**主页面** (`frontend/src/pages/Dashboard.tsx`):
- 侧边栏：数据库列表 + 架构浏览器（树形展示表/列）
- 主内容区：三个Tab（SQL查询、AI查询、历史记录）
- 只在SQL查询Tab下显示结果栏

**组件** (`frontend/src/components/`):
- `database/` - 数据库管理组件
- `query/` - 查询相关（SqlEditor使用Monaco、NaturalQueryInput、QueryResults、QueryHistoryTab）
- `shared/` - 共享组件（SchemaTree）

**状态管理**:
- 使用React hooks进行本地状态管理
- API客户端单例 (`frontend/src/services/api.ts`)

## 关键约定

### 后端
- **严格类型检查**: `mypy strict`，所有函数必须类型注解
- **异步优先**: 所有数据库操作和I/O使用async/await
- **驼峰命名API**: 响应使用驼峰命名（`CamelModel`）
- **SQL注入防护**: 标识符验证（仅允许字母、数字、下划线）
- **只读查询**: 仅允许SELECT，自动添加LIMIT 1000
- **连接池**: 引擎缓存，1小时超时自动清理

### 前端
- **TypeScript严格模式**: 启用所有严格检查
- **路径别名**: `@/*` 映射到 `src/*`
- **中文优先**: UI文本使用中文

## 环境配置

**后端 `.env`**:
```
ZAI_API_KEY=your_api_key_here      # 必需：智谱AI API密钥
DB_PATH=~/.db_query/db_query.db    # 可选：应用数据库路径
LOG_LEVEL=INFO                     # 可选：日志级别
```

**前端 `.env.development`**:
```
VITE_API_URL=http://localhost:8000
```

## 数据库连接字符串格式

- **MySQL**: `mysql://username:password@localhost:3306/database_name`
- **PostgreSQL**: `postgresql://username:password@localhost:5432/database_name`
- **SQLite**:
  - 相对路径: `sqlite:///path/to/database.db`
  - 绝对路径: `sqlite:////absolute/path/to/db.db`

## API端点

- `GET /api/v1/dbs` - 列出数据库
- `PUT /api/v1/dbs/{name}` - 创建数据库连接
- `GET /api/v1/dbs/{name}` - 获取数据库详情和元数据
- `PATCH /api/v1/dbs/{name}` - 更新数据库
- `DELETE /api/v1/dbs/{name}` - 删除数据库
- `POST /api/v1/dbs/{name}/query` - 执行SQL
- `POST /api/v1/dbs/{name}/query/natural` - 自然语言转SQL
- `GET /api/v1/dbs/{name}/history` - 查询历史
- `DELETE /api/v1/dbs/{name}/history` - 删除历史记录
- `GET /api/v1/dbs/{name}/history/summary` - 历史统计
- `POST /api/v1/dbs/{name}/query/export` - 导出结果（CSV/JSON）
- `GET /api/v1/dbs/{name}/suggested-queries` - AI查询建议

## 重要注意事项

1. **Python版本**: 必须使用 3.14+（strict mypy要求）
2. **API密钥**: 智谱AI的 `ZAI_API_KEY` 必须配置
3. **查询类型**:
   - `sql` - 直接SQL查询
   - `natural` - AI生成的查询
4. **历史记录**: 记录所有查询，包含输入、执行SQL、行数、耗时、状态
5. **密码脱敏**: API响应中连接字符串密码会被隐藏
6. **CORS**: 当前允许所有来源（`allow_origins=["*"]`）
