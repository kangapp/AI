# 数据库查询工具 (DB Query Tool)

> 一个基于 AI 的智能数据库查询工具，支持自然语言转 SQL、多数据库连接、查询历史管理等功能。

## 目录

- [项目概述](#项目概述)
- [快速开始](#快速开始)
- [使用指南](#使用指南)
- [项目结构](#项目结构)
- [技术栈](#技术栈)
- [系统架构](#系统架构)
- [技术要点](#技术要点)
- [核心功能实现](#核心功能实现)
- [完整调用链路详解](#完整调用链路详解)
- [开发指南](#开发指南)
- [API 文档](#api-文档)
- [常见问题](#常见问题)

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

## 技术要点

### 后端技术要点

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
        content={"code": exc.code, "message": exc.message}
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

### 前端技术要点

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

### 安全要点

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

## 完整调用链路详解

本节通过具体案例详细描绘从用户输入自然语言到获得查询结果的完整调用链路，包括前端组件依赖、状态流转、后端函数调用链路以及底层数据流转。

### 案例场景：用户查询"显示价格最高的10个商品"

#### 前端组件依赖与状态流转

```mermaid
flowchart TD
    subgraph "前端组件层级"
        A[Dashboard/index.tsx<br/>主仪表板]
        B[QueryTabs.tsx<br/>查询标签页容器]
        C[NaturalQueryInput.tsx<br/>AI查询输入组件]
        D[SqlEditor.tsx<br/>SQL编辑器]
        E[QueryResults.tsx<br/>结果展示组件]
    end

    subgraph "React Hooks状态管理"
        F[useQueryExecution.ts<br/>查询执行状态Hook]
        G[useMetadata.ts<br/>元数据管理Hook]
        H[useDatabases.ts<br/>数据库列表Hook]
    end

    subgraph "API服务层"
        I[api.ts<br/>API客户端单例]
    end

    A --> B
    B --> C
    B --> D
    B --> E
    A --> F
    A --> G
    A --> H
    F --> I
    G --> I
    H --> I

    style A fill:#e1f5ff
    style C fill:#fff4e6
    style F fill:#f0f0f0
    style I fill:#f5f5f5
```

**前端状态流转时序图**：

```mermaid
sequenceDiagram
    participant User as 用户
    participant UI as NaturalQueryInput
    participant Hook as useQueryExecution
    participant API as api.ts
    participant Msg as message反馈

    User->>UI: 输入："显示价格最高的10个商品"
    User->>UI: 按下 Enter
    UI->>UI: setPrompt("显示价格最高的10个商品")
    UI->>UI: handleGenerate()
    UI->>API: naturalQuery("mydb", prompt, false)
    API->>API: fetch POST /api/v1/dbs/mydb/query/natural
    API-->>UI: NaturalQueryResponse {success, generatedSql, ...}
    UI->>UI: setShowConfirmModal(true)
    UI->>UI: 显示成功弹窗

    User->>UI: 点击"立即执行"
    UI->>UI: handleConfirmExecute()
    UI->>API: naturalQuery("mydb", prompt, true)
    API->>API: fetch POST /api/v1/dbs/mydb/query/natural
    API-->>Hook: NaturalQueryResponse {with results}
    Hook->>Hook: naturalQueryMutation.onSuccess
    Hook->>Hook: setSql(generatedSql)
    Hook->>Hook: setActiveTab("sql")
    Hook->>Hook: setQueryResult(results)
    Hook->>Msg: message.success("AI 查询返回 10 行，耗时 45ms")
```

#### 后端函数调用链路

```mermaid
flowchart TD
    subgraph "API层 - queries.py"
        A[natural_query endpoint<br/>Line 212-348]
    end

    subgraph "服务层"
        B[DatabaseService<br/>get_database_by_name]
        C[DatabaseService<br/>get_connection_url_with_driver]
        D[DatabaseService<br/>get_engine]
        E[MetadataService<br/>fetch_metadata]
        F[LLMService<br/>generate_and_validate]
        G[QueryService<br/>execute_query]
    end

    subgraph "核心模块"
        H[SQLParser<br/>validate_select_only]
        I[SQLParser<br/>ensure_limit]
        J[Logger<br/>structlog]
    end

    subgraph "外部服务"
        K[智谱AI API<br/>glm-4-flash]
        L[用户数据库<br/>MySQL/PostgreSQL/SQLite]
    end

    A --> B
    A --> C
    A --> D
    A --> E
    A --> F
    A --> G

    F --> F
    F --> K
    F --> H
    F --> I

    G --> G
    G --> H
    G --> I
    G --> L
    G --> J

    style A fill:#e1f5ff
    style F fill:#fff4e6
    style G fill:#f0f0f0
    style K fill:#ffcccc
    style L fill:#ccffcc
```

**完整后端调用时序图**：

```mermaid
sequenceDiagram
    participant API as queries.py<br/>natural_query
    participant DBService as DatabaseService
    participant MetaService as MetadataService
    participant LLMService as LLMService
    participant QueryService as QueryService
    participant Logger as structlog
    participant ZhipuAI as 智谱AI API
    participant UserDB as 用户数据库
    participant AppDB as 应用SQLite

    API->>Logger: info("natural_query_start", query=prompt)
    API->>DBService: get_database_by_name("mydb")
    DBService-->>API: DatabaseDetail

    API->>DBService: get_connection_url_with_driver("mydb")
    DBService->>AppDB: SELECT FROM databases WHERE name=?
    DBService-->>API: connection_url

    API->>DBService: get_engine(database_id, url)
    DBService-->>API: SQLAlchemy Engine

    API->>MetaService: fetch_metadata(database, engine)
    MetaService->>UserDB: 查询表/视图元数据
    MetaService->>AppDB: 检查缓存
    MetaService-->>API: MetadataResponse {tables, views}

    API->>LLMService: generate_and_validate(prompt, tables, views)

    LLMService->>Logger: info("llm_generate_sql_start", query_length=...)
    LLMService->>LLMService: _format_metadata_context(tables, views)
    LLMService->>LLMService: _build_prompt(prompt, context)

    LLMService->>ZhipuAI: chat.completions.create(model="glm-4-flash")
    Note over ZhipuAI: 包含元数据上下文和自然语言请求

    ZhipuAI-->>LLMService: content {SQL + 说明}
    LLMService->>Logger: debug("llm_response_received")

    LLMService->>LLMService: _parse_llm_response(content)
    LLMService-->>LLMService: (sql, explanation)

    LLMService->>LLMService: validate_and_fix_sql(sql, tables)
    LLMService->>LLMService: get_parser(db_type).validate_select_only(sql)
    LLMService->>LLMService: parser.ensure_limit(sql, 1000)
    LLMService->>Logger: debug("sql_validation_success")

    LLMService-->>API: (generated_sql, explanation, is_valid=True)

    API->>QueryService: execute_query(database, engine, generated_sql, "natural", prompt)

    QueryService->>Logger: info("executing_query", database, query_type="natural")
    QueryService->>QueryService: validate_select_only(generated_sql)
    QueryService->>QueryService: ensure_limit(generated_sql, 1000)

    QueryService->>UserDB: 执行SQL查询
    Note over UserDB: SELECT name, price FROM products<br/>ORDER BY price DESC LIMIT 10

    UserDB-->>QueryService: ResultProxy

    QueryService->>QueryService: _serialize_results(result)
    QueryService->>QueryService: _infer_type(values) for each column
    QueryService-->>QueryService: (columns, rows)

    QueryService->>Logger: info("query_completed", row_count=10, execution_time_ms=45)
    QueryService->>AppDB: INSERT INTO query_history (...)
    Note over AppDB: query_type="natural"<br/>input_text=prompt<br/>executed_sql=generated_sql

    QueryService-->>API: QueryResponse {success, executed_sql, rows=10, ...}

    API->>Logger: info("natural_query_completed", success=true)
    API-->>前端: NaturalQueryResponse
```

#### 日志模块配合

```mermaid
flowchart LR
    subgraph "日志记录点"
        A[请求开始<br/>llm_generate_sql_start]
        B[收到AI响应<br/>llm_response_received]
        C[SQL验证成功<br/>sql_validation_success]
        D[查询执行开始<br/>executing_query]
        E[查询完成<br/>query_completed]
        F[历史记录保存<br/>_log_query]
    end

    subgraph "日志字段"
        G[query_length<br/>tables_count<br/>views_count<br/>db_type]
        H[response_length<br/>sql_length<br/>has_explanation]
        I[database<br/>query_type<br/>row_count<br/>execution_time_ms]
    end

    A --> G
    B --> H
    C --> H
    D --> I
    E --> I
    F --> I

    style A fill:#e1f5ff
    style E fill:#d4edda
```

**实际日志输出示例** (JSON格式):

```json
// 1. LLM生成开始
{
  "event": "llm_generate_sql_start",
  "query_length": 32,
  "tables_count": 5,
  "views_count": 2,
  "db_type": "mysql",
  "timestamp": "2024-01-15T10:30:00.123Z"
}

// 2. LLM响应
{
  "event": "llm_response_received",
  "response_length": 256,
  "timestamp": "2024-01-15T10:30:01.456Z"
}

// 3. 查询执行
{
  "event": "executing_query",
  "database": "mydb",
  "query_type": "natural",
  "sql": "SELECT name, price FROM products ORDER BY price DESC LIMIT 10",
  "timestamp": "2024-01-15T10:30:01.789Z"
}

// 4. 查询完成
{
  "event": "query_completed",
  "database": "mydb",
  "query_type": "natural",
  "row_count": 10,
  "execution_time_ms": 45,
  "timestamp": "2024-01-15T10:30:01.834Z"
}
```

#### 底层数据流转

```mermaid
flowchart TD
    subgraph "应用内部 SQLite (~/.db_query/db_query.db)"
        A[databases 表<br/>存储数据库连接配置]
        B[query_history 表<br/>存储查询历史]
    end

    subgraph "用户数据库"
        C[products 表<br/>name, price, ...]
        D[其他业务表...]
    end

    subgraph "数据流转"
        E[读取连接配置<br/>SELECT * FROM databases<br/>WHERE name = 'mydb']
        F[记录查询历史<br/>INSERT INTO query_history]
        G[执行业务查询<br/>SELECT ... FROM products]
    end

    A --> E
    E --> H[建立连接<br/>SQLAlchemy Engine]
    H --> G
    G --> C
    C --> I[返回结果集<br/>ResultSet]
    I --> J[序列化为JSON<br/>ColumnMetadata + rows]
    J --> F
    F --> B

    style A fill:#ffe6e6
    style B fill:#ffe6e6
    style C fill:#e6f7ff
    style H fill:#fff4e6
    style J fill:#f0f0f0
```

**数据格式转换链路**：

```mermaid
flowchart LR
    subgraph "数据库原始数据"
        A[RowProxy对象<br/>SQLAlchemy返回]
    end

    subgraph "类型推断"
        B[_infer_type value]
        C[确定列类型<br/>INTEGER/FLOAT/TEXT/...]
    end

    subgraph "序列化"
        D[ColumnMetadata]
        E[dict rows]
    end

    subgraph "JSON响应"
        F[CamelModel自动转换<br/>snake_case → camelCase]
        G[HTTP Response<br/>application/json]
    end

    A --> B
    B --> C
    C --> D
    A --> E
    D --> F
    E --> F
    F --> G

    style A fill:#e1f5ff
    style C fill:#fff4e6
    style F fill:#f0f0f0
    style G fill:#d4edda
```

#### AI查询建议生成链路

```mermaid
sequenceDiagram
    participant User as 用户
    participant Frontend as NaturalQueryInput
    participant API as GET /suggested-queries
    participant LLM as LLMService
    participant Meta as MetadataService
    participant AI as 智谱AI

    Frontend->>Frontend: useEffect监听databaseName变化
    Frontend->>API: getSuggestedQueries("mydb", 6, {seed, exclude})

    API->>Meta: fetch_metadata(database, engine)
    Meta-->>API: {tables, views}

    API->>API: get_query_history(database, page=1, pageSize=10)
    API-->>API: history_context

    API->>LLM: generate_suggested_queries(tables, views, db_type, limit, seed, exclude, history)

    LLM->>LLM: _format_metadata_context(tables, views)
    LLM->>LLM: 构建prompt (包含历史查询上下文)

    Note over LLM,AI: temperature=0.9 (高随机性)<br/>使用seed影响生成结果

    LLM->>AI: chat.completions.create()
    AI-->>LLM: 建议列表 (6条中文描述)

    LLM->>LLM: 清理前缀 ("查询：", "显示："等)
    LLM-->>API: {suggestions}
    API-->>Frontend: {suggestions: [...]}

    Frontend->>Frontend: setSuggestedQueries(suggestions)
    Frontend->>User: 显示"猜你想搜"标签

    Note over User: 点击建议标签<br/>自动填充到输入框
```

#### 导出功能链路

```mermaid
sequenceDiagram
    participant User as 用户
    participant Frontend as QueryResults
    participant API as POST /query/export
    participant QuerySVC as QueryService
    participant DB as 用户数据库

    User->>Frontend: 点击"导出CSV"按钮
    Frontend->>API: exportQueryResults("mydb", sql, "csv", true)

    API->>QuerySVC: execute_query(database, engine, sql)
    QuerySVC->>DB: 执行查询
    DB-->>QuerySVC: 结果集
    QuerySVC-->>API: QueryResponse {columns, rows}

    API->>API: 生成CSV格式
    Note over API: 1. 写入列标题 (if include_headers)<br/>2. 写入数据行<br/>3. 处理NULL值为空字符串

    API-->>Frontend: Response with Content-Disposition header

    Frontend->>Frontend: 创建Blob URL
    Frontend->>Frontend: 创建<a>元素触发下载
    Frontend->>User: 下载 mydb_query_20240115_103000.csv

    Note over User: 文件内容示例:<br/>name,price,category<br/>商品A,99.99,电子产品<br/>商品B,89.99,电子产品
```

**导出格式对比**：

| 格式 | Content-Type | 文件结构 | 特点 |
|------|--------------|----------|------|
| CSV | text/csv | 纯文本，逗号分隔 | Excel可直接打开，体积小 |
| JSON | application/json | {metadata, columns, rows} | 包含完整元数据，结构化 |

### 错误处理与重试机制

```mermaid
flowchart TD
    A[LLM调用失败] --> B{错误类型判断}
    B -->|timeout/connection<br/>rate limit/503/502| C[TransientLLMError]
    B -->|其他错误| D[LLMServiceError]

    C --> E[tenacity重试<br/>max=3次, exponential_backoff]
    E --> F{重试成功?}
    F -->|是| G[返回SQL结果]
    F -->|否| H[返回失败响应]

    D --> H

    H --> I[前端显示错误提示<br/>message.error]

    style C fill:#fff3cd
    style E fill:#d1ecf1
    style G fill:#d4edda
    style H fill:#f8d7da
```

**重试机制配置** (`llm_service.py:114-118`):

```python
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(TransientLLMError),
)
async def generate_sql(...):
    # LLM调用逻辑
```

### 性能优化点

| 优化点 | 实现位置 | 说明 |
|--------|----------|------|
| 元数据缓存 | MetadataService | TTL=1小时，避免重复查询information_schema |
| 连接池管理 | DatabaseService | 引擎缓存，1小时超时自动清理 |
| 批量列查询 | MetadataService | 按Schema分组批量获取列信息 |
| 类型推断采样 | QueryService | 只检查前100行推断列类型 |
| React Query缓存 | 前端 | queryKey自动管理缓存失效 |
| 速率限制 | middleware/rate_limit.py | 防止API滥用 |

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
