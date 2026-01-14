# 数据库查询工具 (DB Query Tool)

> 一个基于 AI 的智能数据库查询工具，支持自然语言转 SQL、多数据库连接、查询历史管理等功能。

## 目录

- [项目概述](#项目概述)
- [技术栈](#技术栈)
- [系统架构](#系统架构)
- [快速开始](#快速开始)
- [使用指南](#使用指南)
- [项目结构](#项目结构)
- [核心功能实现](#核心功能实现)
- [技术要点](#技术要点)
- [开发指南](#开发指南)
- [API 文档](#api-文档)

---

## 项目概述

### 项目目标

本项目旨在构建一个智能化的数据库查询工具，主要解决以下痛点：

1. **降低 SQL 使用门槛**：通过自然语言转 SQL，让非技术人员也能查询数据库
2. **提升查询效率**：提供 AI 查询建议、历史记录快速复用
3. **多数据库统一管理**：支持 MySQL、PostgreSQL、SQLite 三种主流数据库
4. **安全可控**：仅允许 SELECT 查询，自动添加 LIMIT 保护，防止误操作

### 核心特性

- **AI 智能查询**：基于智谱 AI (glm-4-flash) 实现自然语言转 SQL
- **多数据库支持**：MySQL、PostgreSQL、SQLite
- **实时架构浏览**：树形展示表/视图结构，点击自动生成查询
- **查询历史管理**：记录所有查询，支持重新执行和批量删除，分页展示
- **结果导出**：支持 CSV、JSON 格式导出
- **连接池管理**：自动管理数据库连接，空闲超时清理
- **速率限制**：API 级别速率限制，防止滥用
- **结构化日志**：JSON 格式日志，便于分析和监控

---

## 技术栈

### 后端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Python | 3.14+ | 开发语言 |
| FastAPI | 0.115.0+ | Web 框架 |
| SQLAlchemy | 2.0.36+ | ORM 和数据库连接 |
| Pydantic | 2.10.0+ | 数据验证 |
| sqlglot | 25.30.0+ | SQL 解析和验证 |
| zai-sdk | 0.2.0+ | 智谱 AI 集成 |
| uvicorn | 0.32.0+ | ASGI 服务器 |
| aiosqlite | 0.20.0+ | 异步 SQLite |
| pymysql | 1.1.2+ | MySQL 驱动 |
| slowapi | 0.1.9+ | 速率限制 |
| structlog | 24.0.0+ | 结构化日志 |
| tenacity | 8.5.0+ | 重试机制 |

### 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| TypeScript | 5.6.2+ | 开发语言 |
| React | 18.3.1+ | UI 框架 |
| Vite | 6.0.1+ | 构建工具 |
| Ant Design | 5.22.2+ | UI 组件库 |
| Monaco Editor | 4.7.0+ | SQL 编辑器 |
| Tailwind CSS | 3.4.17+ | 样式框架 |
| React Router | 7.1.1+ | 路由管理 |
| React Query | 5.90.17+ | 服务端状态管理 |
| Refinedev | 4.57.0+ | 数据提供框架 |

---

## 系统架构

### 整体架构图

```mermaid
graph TB
    subgraph 前端层
        A[Dashboard.tsx / 主仪表板]
        B[DatabaseList / 数据库列表]
        C[SqlEditor / SQL编辑器]
        D[NaturalQueryInput / AI查询输入]
        E[QueryResults / 结果展示]
        F[QueryHistoryTab / 查询历史]
    end

    subgraph API层
        G[FastAPI Router]
        H["/api/v1/dbs / 数据库管理"]
        I["/api/v1/dbs/:name/query / 查询执行"]
        J["/api/v1/dbs/:name/query/natural / AI查询"]
        K["/api/v1/dbs/:name/history / 查询历史"]
    end

    subgraph 服务层
        L[DatabaseService / 数据库连接管理]
        M[QueryService / 查询执行]
        N[LLMService / AI服务]
        O[MetadataService / 元数据提取]
    end

    subgraph 数据层
        P[(SQLite / 应用数据库)]
        Q[(MySQL-PostgreSQL / 用户数据库)]
        R[元数据缓存]
    end

    A --> G
    B --> H
    C --> I
    D --> J
    E --> I
    F --> K

    G --> L
    I --> M
    J --> N
    K --> M
    H --> O

    L --> P
    M --> P
    M --> Q
    O --> Q
    O --> R
```

### 数据流图

```mermaid
sequenceDiagram
    participant User as 用户
    participant Frontend as 前端
    participant API as API层
    participant LLM as LLM服务
    participant DB as 数据库服务

    User->>Frontend: 输入自然语言查询
    Frontend->>API: POST /dbs/:name/query/natural
    API->>LLM: 生成SQL
    LLM->>LLM: 构建Prompt（含元数据）
    LLM->>LLM: 调用智谱AI API
    LLM->>API: 返回生成的SQL
    API->>API: SQL验证和修复
    API->>DB: 执行查询
    DB->>API: 返回结果
    API->>Frontend: 返回结果
    Frontend->>User: 展示查询结果
```

### 后端模块架构

```mermaid
graph LR
    subgraph src_api
        A[main.py / 应用入口]
        B[dependencies.py / 依赖注入]
        C[errors.py / 错误处理]
        D[v1/databases.py / 数据库API]
        E[v1/queries.py / 查询API]
    end

    subgraph src_services
        F[db_service.py / 数据库连接]
        G[query_service.py / 查询执行]
        H[llm_service.py / AI服务]
        I[metadata_service.py / 元数据提取]
    end

    subgraph src_models
        J[database.py / 数据库模型]
        K[query.py / 查询模型]
        L[metadata.py / 元数据模型]
    end

    subgraph src_core
        M[config.py / 配置管理]
        N[constants.py / 常量定义]
        O[sql_parser.py / SQL解析]
        P[sqlite_db.py / SQLite连接]
        Q[logging.py / 日志配置]
    end

    subgraph src_lib
        R[json_encoder.py / 驼峰命名]
    end

    subgraph src_middleware
        S[rate_limit.py / 速率限制]
    end

    D --> F
    D --> I
    E --> G
    E --> H
    E --> I

    F --> J
    G --> K
    H --> L
    I --> L
```

### 前端组件架构

```mermaid
graph TD
    A[Dashboard/index.tsx / 主页面] --> B[Sidebar / 侧边栏]
    A --> C[DatabaseInfo / 数据库信息]
    A --> D[QueryTabs / 查询标签页]

    B --> E[DatabaseList / 数据库列表]
    B --> F[SchemaTree / 架构树]

    D --> G[SQL查询Tab]
    D --> H[AI查询Tab]
    D --> I[历史记录Tab]

    G --> J[SqlEditor / SQL编辑器]
    G --> K[QueryResults / 结果展示]

    H --> L[NaturalQueryInput / 自然语言输入]
    H --> M[SuggestedQueries / 建议查询]

    I --> N[QueryHistoryTab / 历史记录]

    E --> O[AddDatabaseForm / 添加表单]
    E --> P[EditDatabaseForm / 编辑表单]
    E --> Q[DatabaseDetail / 数据库详情]
```

---

## 快速开始

### 环境要求

- Python 3.14+
- Node.js 18+
- 智谱 AI API Key

### 安装依赖

```bash
# 安装所有依赖
make install

# 或分别安装
cd backend && uv sync
cd frontend && npm install
```

### 配置环境变量

```bash
# 设置智谱AI密钥
export ZAI_API_KEY="your_api_key_here"
```

### 启动服务

```bash
# 同时启动前后端
make dev

# 或分别启动
make backend-run  # 后端 http://localhost:8000
make frontend-run # 前端 http://localhost:5173
```

### 访问应用

打开浏览器访问 http://localhost:5173

---

## 使用指南

### 1. 首页概览

打开应用后，您将看到简洁的主界面：

![首页](docs/screenshots/01-homepage.png)

- **左侧侧边栏**：显示已配置的数据库列表
- **主内容区**：SQL 查询编辑器和结果展示
- **添加数据库按钮**：点击右上角"+"按钮添加新的数据库连接

### 2. 添加数据库连接

点击"添加数据库"按钮，弹出连接配置表单：

**连接字符串格式**：
```bash
# MySQL
mysql://username:password@localhost:3306/database_name

# PostgreSQL
postgresql://username:password@localhost:5432/database_name

# SQLite (相对路径)
sqlite:///path/to/database.db

# SQLite (绝对路径)
sqlite:////Users/username/path/to/database.db
```

填写数据库名称和连接字符串后，点击"添加数据库"完成配置。

### 3. 浏览数据库架构

选择数据库后，左侧将显示完整的数据库架构：

![数据库选中状态](docs/screenshots/02-database-selected.png)

**架构浏览器功能**：
- **表列表**：显示所有表和视图
- **列信息**：展开表/视图查看列详情（类型、是否可空、主键等）
- **快速查询**：点击表名自动生成 SELECT 查询语句

### 4. SQL 查询

**SQL 编辑器功能**：
- 基于 Monaco Editor，提供语法高亮和自动补全
- 快捷键：`Ctrl + Enter` 执行查询
- 工具栏：格式化 SQL、执行查询

**执行查询**：
1. 在左侧选择数据库
2. 在 SQL 编辑器中输入查询语句
3. 点击"执行"按钮或按 `Ctrl + Enter`
4. 查询结果将显示在下方表格中

### 5. AI 智能查询

使用自然语言描述您的需求，AI 自动生成 SQL 查询：

![AI 查询界面](docs/screenshots/03-ai-query-tab.png)

**使用步骤**：
1. 切换到"AI 查询"标签页
2. 在输入框中用自然语言描述查询需求
3. 按 `Enter` 生成 SQL，或 `Shift + Enter` 换行
4. 查看生成的 SQL，可选择：
   - **生成 SQL**：仅生成不执行
   - **立即运行**：生成并直接执行查询

**AI 查询示例**：
```
显示所有活跃用户
查询价格最高的10个商品
统计每个客户的订单数量
查找最近7天的注册用户
```

### 6. 查询历史管理

所有查询（SQL 和 AI）都会自动记录到历史中：

![查询历史](docs/screenshots/04-query-history.png)

**历史记录功能**：
- **统计信息**：总查询数、成功/失败数
- **筛选功能**：按查询类型（SQL/AI）和状态筛选
- **重新执行**：点击"运行"按钮重新执行历史查询
- **编辑 SQL**：点击"编辑"将历史查询加载到编辑器
- **批量删除**：选中多条记录后批量删除
- **清空全部**：清空当前数据库的所有历史记录

### 7. 查询结果操作

**结果展示**：
- 表格形式展示查询结果
- 显示列类型信息
- 显示执行统计（行数、耗时）

**导出功能**：
- 支持导出为 CSV 格式
- 支持导出为 JSON 格式
- 可选择是否包含列标题

---

## 项目结构

```
db_query/
├── backend/                          # Python 后端
│   ├── src/
│   │   ├── api/                      # API 路由层
│   │   │   ├── main.py              # FastAPI 应用入口
│   │   │   ├── dependencies.py      # 依赖注入
│   │   │   ├── errors.py            # 统一错误处理
│   │   │   └── v1/                  # v1 API
│   │   │       ├── databases.py     # 数据库管理端点
│   │   │       └── queries.py       # 查询执行端点
│   │   ├── core/                    # 核心模块
│   │   │   ├── config.py            # 配置管理
│   │   │   ├── constants.py         # 常量定义
│   │   │   ├── sql_parser.py        # SQL 解析器
│   │   │   ├── sqlite_db.py         # SQLite 连接
│   │   │   └── logging.py           # 日志配置
│   │   ├── models/                  # 数据模型
│   │   │   ├── database.py          # 数据库模型
│   │   │   ├── metadata.py          # 元数据模型
│   │   │   └── query.py             # 查询模型
│   │   ├── services/                # 业务逻辑层
│   │   │   ├── db_service.py        # 数据库连接服务
│   │   │   ├── query_service.py     # 查询执行服务
│   │   │   ├── llm_service.py       # LLM 服务
│   │   │   └── metadata_service.py  # 元数据服务
│   │   ├── lib/                     # 工具库
│   │   │   └── json_encoder.py      # 驼峰命名编码器
│   │   └── middleware/              # 中间件
│   │       └── rate_limit.py        # 速率限制
│   ├── tests/                       # 测试目录
│   └── pyproject.toml              # Python 配置
│
├── frontend/                         # TypeScript 前端
│   ├── src/
│   │   ├── pages/                   # 页面组件
│   │   │   └── Dashboard/           # 主仪表板
│   │   │       ├── index.tsx        # 主页面
│   │   │       ├── Sidebar.tsx      # 侧边栏
│   │   │       ├── DatabaseInfo.tsx # 数据库信息
│   │   │       ├── QueryTabs.tsx    # 查询标签页
│   │   │       ├── useDatabases.ts  # 数据库 Hook
│   │   │       ├── useMetadata.ts   # 元数据 Hook
│   │   │       └── useQueryExecution.ts # 查询执行 Hook
│   │   ├── components/              # React 组件
│   │   │   ├── database/            # 数据库组件
│   │   │   │   ├── DatabaseList.tsx
│   │   │   │   ├── AddDatabaseForm.tsx
│   │   │   │   ├── EditDatabaseForm.tsx
│   │   │   │   └── DatabaseDetail.tsx
│   │   │   ├── query/               # 查询组件
│   │   │   │   ├── SqlEditor.tsx
│   │   │   │   ├── NaturalQueryInput.tsx
│   │   │   │   ├── QueryResults.tsx
│   │   │   │   └── QueryHistoryTab.tsx
│   │   │   ├── metadata/            # 元数据组件
│   │   │   │   ├── TableList.tsx
│   │   │   │   └── TableSchema.tsx
│   │   │   └── shared/              # 共享组件
│   │   │       ├── SchemaTree.tsx
│   │   │       └── ErrorBoundary.tsx
│   │   ├── hooks/                   # 自定义 Hooks
│   │   │   ├── useDatabaseQuery.ts
│   │   │   └── useTreeData.tsx
│   │   ├── services/                # API 服务
│   │   │   └── api.ts
│   │   ├── types/                   # 类型定义
│   │   │   └── index.ts
│   │   ├── App.tsx                  # 应用根组件
│   │   └── main.tsx                 # 应用入口
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
└── Makefile                          # 自动化脚本
```

---

## 核心功能实现

### 1. 数据库连接管理

#### 连接字符串解析

支持多种连接字符串格式，自动检测数据库类型：

```python
# MySQL
mysql://user:password@localhost:3306/dbname

# PostgreSQL
postgresql://user:password@localhost:5432/dbname

# SQLite (相对路径)
sqlite:///path/to/db.db

# SQLite (绝对路径)
sqlite:////Users/username/path/to/db.db
```

**技术要点**：
- 使用 `urllib.parse.urlparse` 解析连接字符串
- 密码自动脱敏显示（`ConnectionString.redact()`）
- SQLite 路径处理：3 斜杠表示相对路径，4 斜杠表示绝对路径

#### 连接池管理

```mermaid
graph LR
    A[请求连接] --> B{连接是否存在?}
    B -->|是| C[更新最后使用时间]
    B -->|否| D[创建新连接]
    D --> E[启动清理任务]
    C --> F[返回连接]
    E --> F

    G[后台清理任务] --> H{检查空闲连接}
    H -->|超过1小时| I[释放连接]
    H -->|未超时| G
```

**关键代码** (`db_service.py`):
```python
# 连接空闲超时：1小时
ENGINE_IDLE_TIMEOUT = 3600

# 后台清理任务
async def _cleanup_idle_engines(self):
    while True:
        await asyncio.sleep(300)  # 每5分钟检查
        idle_engines = [
            db_id for db_id, last_used in self._engine_last_used.items()
            if time.time() - last_used > ENGINE_IDLE_TIMEOUT
        ]
        for db_id in idle_engines:
            await self._dispose_engine(db_id)
```

### 2. 元数据提取与缓存

#### 元数据提取流程

```mermaid
flowchart TD
    A[请求元数据] --> B{是否强制刷新?}
    B -->|否| C{有缓存?}
    C -->|是| D[返回缓存]
    C -->|否| E[提取表元数据]
    B -->|是| E

    E --> F[提取视图元数据]
    F --> G[批量获取列信息]
    G --> H[获取主键信息]
    H --> I[组装元数据]
    I --> J[缓存到数据库]
    J --> K[返回元数据]
```

#### SQL 注入防护

**标识符验证** (`metadata_service.py`):
```python
# 只允许字母、数字、下划线和 $ 开头
_SQL_IDENTIFIER_PATTERN = re.compile(r'^[a-zA-Z_][a-zA-Z0-9_$]*$')

@classmethod
def _validate_identifier(cls, identifier: str | None) -> str | None:
    if not identifier:
        return None
    if not cls._SQL_IDENTIFIER_PATTERN.match(identifier):
        raise ValueError(f"Invalid SQL identifier: '{identifier}'")
    return identifier
```

#### 批量查询优化

对于 MySQL/PostgreSQL，按 Schema 分组批量获取列信息，大幅减少查询次数：

```python
# 为每个 Schema 一次性获取所有表的列信息
columns_query = f"""
    SELECT c.table_name, c.column_name, c.data_type,
           c.is_nullable, c.column_default, c.ordinal_position
    FROM information_schema.columns c
    WHERE c.table_schema = '{schema}'
    AND c.table_name IN ({tables_str})
    ORDER BY c.table_name, c.ordinal_position
"""
```

### 3. AI 自然语言转 SQL

#### Prompt 工程设计

```mermaid
graph TD
    A[用户输入] --> B[构建元数据上下文]
    B --> C[格式化表结构]
    C --> D[格式化视图结构]
    D --> E[构建系统Prompt]
    E --> F[添加安全要求]
    F --> G[添加示例格式]
    G --> H[调用智谱AI API]
    H --> I[解析响应]
    I --> J[提取SQL]
    I --> K[提取说明]
```

**系统 Prompt** (`llm_service.py`):
```python
prompt = f"""根据以下自然语言请求生成 SQL 查询:

请求: {natural_query}

可用数据库架构:
{metadata_context}

要求:
1. 只生成 SELECT 查询（不允许 INSERT, UPDATE, DELETE, DROP 等）
2. 使用架构中正确的表名和列名
3. 如果没有指定 LIMIT 子句，在末尾添加 'LIMIT 1000'
4. 为 {db_type} 使用适当的 SQL 语法
5. 返回用 ```sql ... ``` 代码块包裹的 SQL 查询
6. 在 SQL 前包含简短的中文说明
"""
```

#### SQL 验证与修复

```mermaid
flowchart TD
    A[LLM生成SQL] --> B[sqlglot解析]
    B --> C{是否为SELECT?}
    C -->|否| D[抛出错误]
    C -->|是| E{有LIMIT?}
    E -->|否| F[添加LIMIT 1000]
    E -->|是| G[验证通过]
    F --> G
    G --> H[返回验证后的SQL]
```

**关键代码** (`sql_parser.py`):
```python
def validate_select_only(self, sql: str) -> None:
    """验证 SQL 只包含 SELECT 查询"""
    parsed = self.parse(sql)
    for stmt in parsed:
        if stmt.key != "select":
            raise ValueError("Only SELECT queries are allowed")

def ensure_limit(self, sql: str, default_limit: int = 1000) -> str:
    """确保 SQL 有 LIMIT 子句"""
    parsed = self.parse(sql)
    for stmt in parsed:
        if not any(expr.key == "limit" for expr in stmt.find_all(sqlglo.expressions.Limit)):
            # 添加 LIMIT
            stmt.append(f"LIMIT {default_limit}")
    return parsed.sql()
```

### 4. 查询执行与结果处理

#### 查询执行流程

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant QueryService
    participant Database
    participant History

    Client->>API: POST /query {sql}
    API->>QueryService: execute_query()
    QueryService->>QueryService: 验证SQL
    QueryService->>QueryService: 添加LIMIT保护
    QueryService->>Database: 执行查询
    Database-->>QueryService: 返回结果
    QueryService->>QueryService: 序列化结果
    QueryService->>History: 记录历史
    QueryService-->>API: QueryResponse
    API-->>Client: 返回结果
```

**类型推断** (`query_service.py`):
```python
def _infer_type(self, value: Any) -> str:
    """推断值的类型"""
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "BOOLEAN"
    if isinstance(value, int):
        return "INTEGER"
    if isinstance(value, float):
        return "FLOAT"
    if isinstance(value, (datetime, date, time)):
        return "DATETIME"
    return "TEXT"
```

### 5. 查询历史管理

#### 历史记录存储

```sql
CREATE TABLE query_history (
    id INTEGER PRIMARY KEY,
    database_id INTEGER NOT NULL,
    database_name TEXT NOT NULL,
    query_type TEXT NOT NULL,  -- 'sql' or 'natural'
    input_text TEXT NOT NULL,   -- 自然语言输入或SQL
    executed_sql TEXT NOT NULL,
    row_count INTEGER,
    execution_time_ms INTEGER,
    status TEXT NOT NULL,       -- 'success' or 'error'
    error_message TEXT,
    created_at DATETIME NOT NULL
);
```

**查询类型区分**:
- `sql`: 直接执行的 SQL 查询，`input_text` 为 SQL 语句
- `natural`: AI 生成的查询，`input_text` 为自然语言输入

---

## 技术要点

### 1. 后端技术要点

#### 统一错误处理

```python
# 错误码定义
class ErrorCode(str, Enum):
    VALIDATION_ERROR = "VALIDATION_ERROR"
    SQL_SYNTAX_ERROR = "SQL_SYNTAX_ERROR"
    DATABASE_CONNECTION_ERROR = "DATABASE_CONNECTION_ERROR"
    # ...

# 错误处理中间件
@app.exception_handler(APIError)
async def api_error_handler(request: Request, exc: APIError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}}
    )
```

#### FastAPI 依赖注入

```python
# 服务工厂函数
def get_db_service() -> DatabaseService:
    return DatabaseService()

def get_query_service() -> QueryService:
    return QueryService()

# 路由中使用
@router.get("/{name}")
async def get_database(
    name: str,
    db_service: DatabaseService = Depends(get_db_service)
):
    return await db_service.get_database(name)

# 生命周期管理
@app.on_event("startup")
async def startup_event():
    # 启动时初始化
    pass

@app.on_event("shutdown")
async def shutdown_event():
    # 关闭时清理资源
    await db_service.close()
```

#### Pydantic 数据验证

```python
class QueryRequest(CamelModel):
    """使用 CamelCase API 命名"""
    sql: str = Field(..., description="SQL查询语句")

# 自动转换为 camelCase JSON
# {"sql": "SELECT * FROM users"} -> {"executedSql": "..."}
```

#### 异步编程

```python
# 使用 asyncio.to_thread 执行阻塞操作
await asyncio.to_thread(self._test_connection, connection_url)

# 使用 SQLAlchemy 引池管理连接
engine = db_service.get_engine(database_id, connection_url)
```

#### 结构化日志

```python
import structlog

logger = structlog.get_logger()

# 记录结构化日志
logger.info(
    "query_executed",
    database_name=database_name,
    query_type="sql",
    row_count=len(result.rows),
    execution_time_ms=result.execution_time_ms
)
```

#### 速率限制

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# 应用到路由
@router.post("/{name}/query")
@limiter.limit("30/minute")
async def execute_query(...):
    ...
```

### 2. 前端技术要点

#### React Query 状态管理

```typescript
// 使用 React Query 管理服务端状态
const { data: databases, isLoading } = useQuery({
  queryKey: ['databases'],
  queryFn: () => api.listDatabases(),
});

// 使用 Mutation 执行操作
const queryMutation = useMutation({
  mutationFn: ({ databaseName, sql }: QueryParams) =>
    api.executeQuery(databaseName, sql),
  onSuccess: (data) => {
    setQueryResult(data);
  },
});
```

#### 自定义 Hooks

```typescript
// useDatabaseQuery.ts - 封装数据库查询逻辑
export function useDatabaseQuery() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeQuery = async (databaseName: string, sql: string) => {
    // ...
  };

  return { executeQuery, loading, error };
}
```

#### Monaco Editor 集成

```typescript
<Editor
  height="300px"
  language="sql"
  theme="vs-dark"
  value={sql}
  onChange={(value) => setSql(value || "")}
  options={{
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: "on",
    automaticLayout: true,
  }}
/>
```

### 3. 安全要点

#### SQL 注入防护

1. **标识符验证**：只允许合法的 SQL 标识符
2. **参数化查询**：使用 SQLAlchemy 的参数绑定
3. **查询类型限制**：只允许 SELECT 查询

#### 连接字符串安全

```python
def redact(self) -> str:
    """密码脱敏"""
    if self.password:
        return f"{self.scheme}://{self.username}:****@{self.host}:{self.port}/{self.database}"
    return str(self)
```

---

## 开发指南

### 代码风格

**Python**:
- 使用 Ruff 进行格式化和检查
- 使用 mypy 进行类型检查
- 遵循 PEP 8 规范

**TypeScript**:
- 使用 ESLint 进行检查
- 使用 Prettier 进行格式化
- 遵循 Airbnb Style Guide

### 测试

```bash
# 运行所有测试
make test

# 运行测试并生成覆盖率报告
make test-cov

# 运行指定测试
cd backend && uv run pytest tests/test_query_service.py
```

### 调试

**后端调试**:
```bash
# 启动时启用调试
cd backend && uv run uvicorn src.api.main:app --reload --log-level debug
```

**前端调试**:
```bash
# 启动开发服务器（自动 HMR）
npm run dev
```

---

## API 文档

### 数据库管理 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/dbs | 列出所有数据库 |
| PUT | /api/v1/dbs | 创建数据库连接 |
| GET | /api/v1/dbs/{name} | 获取数据库详情 |
| PATCH | /api/v1/dbs/{name} | 更新数据库连接 |
| DELETE | /api/v1/dbs/{name} | 删除数据库 |
| GET | /api/v1/dbs/{name}/metadata | 获取元数据 |

### 查询执行 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/dbs/{name}/query | 执行 SQL 查询 |
| POST | /api/v1/dbs/{name}/query/natural | AI 自然语言查询 |
| POST | /api/v1/dbs/{name}/query/export | 导出查询结果 |
| GET | /api/v1/dbs/{name}/history | 获取查询历史（分页） |
| GET | /api/v1/dbs/{name}/history/summary | 获取历史统计 |
| DELETE | /api/v1/dbs/{name}/history | 删除查询历史 |
| GET | /api/v1/dbs/{name}/suggested-queries | 获取查询建议 |

### 速率限制

| 端点类型 | 限制 |
|----------|------|
| 查询执行 | 30 次/分钟 |
| 自然语言查询 | 10 次/分钟 |
| 导出 | 20 次/分钟 |

### 请求/响应示例

**AI 查询请求**:
```json
POST /api/v1/dbs/mydb/query/natural
{
  "prompt": "显示所有活跃用户",
  "executeImmediately": true
}
```

**AI 查询响应**:
```json
{
  "success": true,
  "generatedSql": "SELECT id, name, email FROM users WHERE is_active = true LIMIT 1000;",
  "explanation": "此查询检索所有活跃用户",
  "isValid": true,
  "validationMessage": null,
  "rowCount": 150,
  "executionTimeMs": 45,
  "columns": [...],
  "rows": [...]
}
```

---

## 常见问题

### 1. SQLite 连接字符串报错

**问题**: `sqlite:///Users/...` 格式无法连接

**解决**: 使用 4 斜杠格式表示绝对路径
```
sqlite:////Users/username/path/to/db.db
```

### 2. AI 查询未记录历史

**原因**: 需要在调用 `query_service.execute_query` 时传入 `query_type="natural"`

**解决**: 在 `queries.py` 中正确传递参数

### 3. 端口被占用

```bash
# 清理 8000 端口
lsof -ti:8000 | xargs kill -9

# 清理 5173 端口
lsof -ti:5173 | xargs kill -9
```

---

## 许可证

MIT License
