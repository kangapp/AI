# 数据库查询工具技术文档

## 目录

- [第一部分：项目概览](#第一部分项目概览)
  - [1.1 项目背景与目标](#11-项目背景与目标)
  - [1.2 整体架构图](#12-整体架构图)
- [第二部分：后端架构详解](#第二部分后端架构详解)
  - [2.1 架构分层](#21-架构分层)
  - [2.2 函数调用链分析](#22-函数调用链分析)
- [第三部分：前端架构详解](#第三部分前端架构详解)
  - [3.1 组件架构](#31-组件架构)
  - [3.2 状态管理](#32-状态管理)
  - [3.3 API 客户端](#33-api-客户端)
- [第四部分：数据流与通信](#第四部分数据流与通信)
- [第五部分：安全设计](#第五部分安全设计)
- [第六部分：性能优化](#第六部分性能优化)
- [第七部分：部署与运维](#第七部分部署与运维)
- [第八部分：扩展与维护](#第八部分扩展与维护)

---

## 第一部分：项目概览

### 1.1 项目背景与目标

#### 解决的核心问题

本项目旨在解决数据分析师和开发者在日常工作中面临的以下痛点：

| 痛点 | 解决方案 |
|------|----------|
| 多数据库管理分散 | 统一管理 MySQL、PostgreSQL、SQLite 连接 |
| SQL 编写门槛高 | 自然语言转 SQL，降低使用门槛 |
| 查询结果难以复用 | 完整的查询历史记录和重新执行功能 |
| 缺乏性能监控 | 全面的查询性能和系统资源监控 |
| 数据导出繁琐 | 一键导出 CSV/JSON 格式 |

#### 主要功能特性

```mermaid
flowchart TD
    Root["数据库查询工具"]

    Root --> DB_Mgmt["数据库管理"]
    Root --> SQL_Query["SQL 查询"]
    Root --> AI_Query["AI 智能查询"]
    Root --> Perf_Mon["性能监控"]

    DB_Mgmt --> DB1["连接管理"]
    DB_Mgmt --> DB2["元数据浏览"]
    DB_Mgmt --> DB3["架构浏览器"]

    SQL_Query --> SQL1["Monaco 编辑器"]
    SQL_Query --> SQL2["语法高亮"]
    SQL_Query --> SQL3["自动补全"]

    AI_Query --> AI1["自然语言转 SQL"]
    AI_Query --> AI2["查询建议"]
    AI_Query --> AI3["SQL 验证"]

    Perf_Mon --> P1["系统资源监控"]
    Perf_Mon --> P2["慢查询追踪"]
    Perf_Mon --> P3["健康检查"]

    style Root fill:#667eea
    style DB_Mgmt fill:#764ba2
    style SQL_Query fill:#f093fb
    style AI_Query fill:#4facfe
    style Perf_Mon fill:#43e97b
```

#### 技术选型理由

**后端技术栈**

| 技术 | 版本 | 选型理由 |
|------|------|----------|
| **Python** | 3.14+ | strict mypy 类型检查，现代化异步特性 |
| **FastAPI** | 0.115.0+ | 高性能异步框架，自动生成 API 文档 |
| **SQLAlchemy** | 2.0.36+ | 成熟的 ORM，支持多数据库方言 |
| **sqlglot** | 25.30.0+ | 纯 Python SQL 解析器，无需额外依赖 |
| **智谱AI SDK** | 0.2.0+ | 国产 AI 服务，支持 glm-4-flash 模型 |
| **structlog** | 24.0.0+ | 结构化日志，便于日志分析 |
| **tenacity** | 8.5.0+ | 优雅的重试机制 |

**前端技术栈**

| 技术 | 版本 | 选型理由 |
|------|------|----------|
| **React** | 18.3.1 | 并发特性，自动批处理 |
| **TypeScript** | 5.6.2 | 严格类型检查，提高代码质量 |
| **Vite** | 6.0.1 | 快速的 dev server 和构建 |
| **Ant Design** | 5.22.2 | 企业级 UI 组件库 |
| **Monaco Editor** | 4.7.0 | VS Code 同款编辑器 |
| **React Query** | 5.90.17 | 强大的服务端状态管理 |

### 1.2 整体架构图

#### 后端整体架构图

```mermaid
flowchart TB
    subgraph API["API 层 (FastAPI)"]
        direction TB
        Main["main.py<br/>应用入口"]
        Dep["dependencies.py<br/>依赖注入"]
        Err["errors.py<br/>错误处理"]

        Main --> CORS["CORS 中间件"]
        Main --> Perf["性能监控中间件"]
        Main --> Rate["速率限制中间件"]

        subgraph V1["v1 路由"]
            DB_Router["databases.py<br/>数据库管理"]
            Q_Router["queries.py<br/>查询执行"]
            M_Router["metrics.py<br/>性能监控"]
        end

        Main --> V1
    end

    subgraph Services["服务层 (Services)"]
        DB_Svc["DatabaseService<br/>连接管理"]
        Q_Svc["QueryService<br/>查询执行"]
        LLM_Svc["LLMService<br/>AI 服务"]
        Meta_Svc["MetadataService<br/>元数据"]
        Metrics_Svc["MetricsService<br/>性能监控"]
    end

    subgraph Models["数据模型层 (Models)"]
        DB_Mod["database.py"]
        Q_Mod["query.py"]
        M_Mod["metadata.py"]
    end

    subgraph Core["核心模块 (Core)"]
        Config["config.py<br/>配置管理"]
        Const["constants.py<br/>常量定义"]
        SQLite["sqlite_db.py<br/>内部数据库"]
        Parser["sql_parser.py<br/>SQL 解析"]
        Log["logging.py<br/>日志配置"]
    end

    subgraph Storage["存储层"]
        Internal_DB[(内部 SQLite)]
        User_DB[(用户数据库)]
        ZAI_API[智谱 AI API]
    end

    %% 依赖关系
    V1 --> Services
    Services --> Models
    Services --> Core
    Services --> Storage

    DB_Svc --> Internal_DB
    DB_Svc --> User_DB
    Q_Svc --> Internal_DB
    Q_Svc --> User_DB
    LLM_Svc --> ZAI_API
    Meta_Svc --> User_DB
    Metrics_Svc --> Internal_DB

    style API fill:#e1f5ff
    style Services fill:#fff4e6
    style Models fill:#f3e5f5
    style Core fill:#e8f5e9
    style Storage fill:#fce4ec
```

#### 前端整体架构图

```mermaid
flowchart TB
    subgraph Entry["应用入口"]
        Main["main.tsx<br/>React 入口"]
        App["App.tsx<br/>QueryClient Provider"]
    end

    subgraph Pages["页面层 (Pages)"]
        Dashboard["Dashboard/index.tsx<br/>主仪表板"]
        Sidebar["Sidebar.tsx<br/>侧边栏"]
        DBInfo["DatabaseInfo.tsx<br/>数据库信息"]
        QTabs["QueryTabs.tsx<br/>查询标签页"]
    end

    subgraph Components["组件层 (Components)"]
        direction TB
        subgraph DB_Comp["数据库组件"]
            DBList["DatabaseList"]
            AddForm["AddDatabaseForm"]
            EditForm["EditDatabaseForm"]
        end

        subgraph Q_Comp["查询组件"]
            SqlEditor["SqlEditor<br/>Monaco 编辑器"]
            NatInput["NaturalQueryInput<br/>AI 查询"]
            QResult["QueryResults<br/>结果展示"]
            QHistory["QueryHistoryTab<br/>历史记录"]
        end

        subgraph Meta_Comp["元数据组件"]
            TList["TableList"]
            TSchema["TableSchema"]
            STree["SchemaTree"]
        end

        subgraph Perf_Comp["性能组件"]
            PerfDash["PerformanceDashboard"]
            PerfMon["PerformanceMonitor"]
        end
    end

    subgraph Hooks["自定义 Hooks"]
        useDB["useDatabases<br/>数据库管理"]
        useMeta["useMetadata<br/>元数据管理"]
        useQExec["useQueryExecution<br/>查询执行"]
        usePerf["usePerformance<br/>性能监控"]
        useTree["useTreeData<br/>树形数据"]
    end

    subgraph Services["服务层"]
        API["api.ts<br/>API 客户端"]
        PerfAPI["performanceApi.ts<br/>性能 API"]
    end

    subgraph State["状态管理"]
        RQ["React Query<br/>服务端状态"]
        Local["useState<br/>本地状态"]
    end

    subgraph Types["类型定义"]
        TypesMod["types/index.ts<br/>TypeScript 类型"]
    end

    subgraph Utils["工具库"]
        PerfUtils["utils/performance.ts<br/>性能工具"]
    end

    %% 数据流向
    Entry --> Pages
    Pages --> Components
    Components --> Hooks
    Hooks --> Services
    Services --> State
    Pages --> Types
    Components --> Utils

    Dashboard --> Sidebar
    Dashboard --> DBInfo
    Dashboard --> QTabs
    QTabs --> Q_Comp
    QTabs --> Perf_Comp
    Sidebar --> DB_Comp
    Sidebar --> Meta_Comp

    style Entry fill:#e3f2fd
    style Pages fill:#f3e5f5
    style Components fill:#fff3e0
    style Hooks fill:#e8f5e9
    style Services fill:#fce4ec
    style State fill:#e1f5fe
```

#### 前后端交互概览

```mermaid
flowchart LR
    subgraph Frontend["前端 React"]
        FE[端口: 5173]
        UI[Ant Design UI]
        MQ[React Query]
    end

    subgraph Backend["后端 FastAPI"]
        BE[端口: 8000]
        MW[中间件层]
    end

    subgraph Storage["数据存储"]
        SQLite[(内部 SQLite)]
        UserDB[(用户数据库)]
        ZAI[智谱 AI API]
    end

    FE -->|HTTP JSON| BE
    BE --> MW
    MW --> Storage

    style Frontend fill:#e3f2fd
    style Backend fill:#fff3e0
    style Storage fill:#f3e5f5
```

#### 数据流向图

```mermaid
sequenceDiagram
    participant U as 用户浏览器
    participant F as React 前端
    participant A as FastAPI 后端
    participant S as 服务层
    participant D as 数据库
    participant L as 智谱AI

    U->>F: 1. 输入自然语言查询
    F->>A: 2. POST /api/v1/dbs/{name}/query/natural
    A->>S: 3. LLMService.generate_sql()
    S->>L: 4. 调用 glm-4-flash
    L-->>S: 5. 返回生成的 SQL
    S->>S: 6. SQL 验证 (sqlglot)
    S->>S: 7. 添加 LIMIT
    A->>S: 8. QueryService.execute_query()
    S->>D: 9. 执行 SQL
    D-->>S: 10. 返回结果
    S->>S: 11. 记录历史 + 慢查询监控
    S-->>A: 12. 返回 QueryResponse
    A-->>F: 13. JSON 响应 (camelCase)
    F-->>U: 14. 展示结果
```

#### 部署架构

```mermaid
flowchart LR
    subgraph Dev["开发环境"]
        DevFE[前端 npm run dev :5173]
        DevBE[后端 uvicorn :8000]
    end

    subgraph Prod["生产环境"]
        Nginx[Nginx 反向代理]
        Gunicorn[Gunicorn 多进程]
        Static[前端静态文件]
    end

    subgraph External["外部服务"]
        ZAIService[智谱 AI API]
        DBs[用户数据库]
    end

    DevFE -.构建.-> Static
    DevBE -.部署.-> Gunicorn

    Nginx --> Gunicorn
    Nginx --> Static
    Gunicorn --> ZAIService
    Gunicorn --> DBs

    style Dev fill:#e8f5e9
    style Prod fill:#fff3e0
    style External fill:#f3e5f5
```

---

## 第二部分：后端架构详解

### 2.1 架构分层

#### API 层 (`src/api/`)

##### FastAPI 应用入口 (`main.py`)

**生命周期管理**

```python
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """应用生命周期管理"""
    # 启动阶段
    logger.info("application_starting")
    await initialize_database()              # 初始化内部 SQLite

    from ..services.metrics_service import MetricsService
    _metrics_service = MetricsService()
    await _metrics_service.start_collection() # 启动性能监控

    yield

    # 关闭阶段
    logger.info("application_shutting_down")
    from ..services.db_service import DatabaseService
    db_service = DatabaseService()
    await db_service.close()                  # 关闭所有连接
    await _metrics_service.stop_collection()  # 停止性能监控
```

**中间件注册顺序**

```python
# 1. CORS 中间件（最先处理跨域）
app.add_middleware(CORSMiddleware, ...)

# 2. 性能监控中间件（记录所有请求）
app.add_middleware(PerformanceMiddleware)

# 3. 速率限制（在路由层面应用）
@router.post("/query", dependencies=[Depends(rate_limit_query)])
```

##### 依赖注入系统 (`dependencies.py`)

**设计模式：服务定位器 + 依赖注入**

```python
# 单例服务实例
_db_service: DatabaseService | None = None

def get_db_service() -> DatabaseService:
    """获取 DatabaseService 单例"""
    global _db_service
    if _db_service is None:
        _db_service = DatabaseService()
    return _db_service

# FastAPI 依赖注入
@app.get("/api/v1/dbs")
async def list_databases(
    db_service: DatabaseService = Depends(get_db_service)
) -> DatabaseListResponse:
    return await db_service.list_databases()
```

**优势分析**

| 特性 | 说明 |
|------|------|
| **单例模式** | 确保服务实例唯一，避免重复初始化 |
| **延迟初始化** | 首次使用时才创建，减少启动开销 |
| **测试友好** | 可轻松替换为 mock 实例 |
| **类型安全** | 完整的类型注解，mypy 检查通过 |

##### 错误处理机制 (`errors.py`)

**错误码枚举设计**

```python
class ErrorCode(str, Enum):
    """统一错误码定义"""

    # 验证错误 (400)
    VALIDATION_ERROR = "VALIDATION_ERROR"
    SQL_SYNTAX_ERROR = "SQL_SYNTAX_ERROR"

    # 资源未找到 (404)
    DATABASE_NOT_FOUND = "DATABASE_NOT_FOUND"

    # 速率限制 (429)
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"

    # 服务器错误 (500)
    QUERY_EXECUTION_ERROR = "QUERY_EXECUTION_ERROR"
    LLM_SERVICE_ERROR = "LLM_SERVICE_ERROR"
    INTERNAL_ERROR = "INTERNAL_ERROR"
```

**异常类层次结构**

```mermaid
flowchart TD
    Base[Exception]

    Base --> API[APIError]

    API --> Val[ValidationError<br/>400]
    API --> NotF[NotFoundError<br/>404]
    API --> Rate[RateLimitError<br/>429]
    API --> Svc[ServiceError<br/>500]

    Svc --> QExec[QueryExecutionError]
    Svc --> LLM[LLMServiceError]
    Svc --> Meta[MetadataFetchError]

    style Base fill:#ffcdd2
    style API fill:#ffe0b2
    style Val fill:#c8e6c9
    style NotF fill:#c8e6c9
    style Rate fill:#c8e6c9
    style Svc fill:#ffcdd2
    style QExec fill:#fff9c4
    style LLM fill:#fff9c4
    style Meta fill:#fff9c4
```

**异常转换函数**

```python
def handle_api_error(exc: Exception) -> HTTPException:
    """将业务异常转换为 HTTPException"""
    if isinstance(exc, APIError):
        return HTTPException(
            status_code=exc.status_code,
            detail={
                "code": exc.code,
                "message": exc.message,
                "details": exc.details
            }
        )
    # 未知错误记录日志后返回通用错误
    logger.error("unhandled_exception", error=str(exc))
    return HTTPException(
        status_code=500,
        detail={"code": "INTERNAL_ERROR", "message": "内部服务器错误"}
    )
```

#### 路由层 (`src/api/v1/`)

##### 数据库管理端点 (`databases.py`)

| 端点 | 方法 | 功能 | 请求模型 | 响应模型 |
|------|------|------|----------|----------|
| `/api/v1/dbs` | GET | 列出数据库 | - | `DatabaseListResponse` |
| `/api/v1/dbs/{name}` | PUT | 创建连接 | `DatabaseCreateRequest` | `DatabaseDetail` |
| `/api/v1/dbs/{name}` | GET | 获取详情 | - | `DatabaseDetail` |
| `/api/v1/dbs/{name}` | PATCH | 更新连接 | `DatabaseUpdateRequest` | `DatabaseDetail` |
| `/api/v1/dbs/{name}` | DELETE | 删除连接 | - | - |
| `/api/v1/dbs/{name}/metadata` | GET | 获取元数据 | - | `MetadataResponse` |

**创建数据库流程**

```mermaid
flowchart TD
    Start([PUT /api/v1/dbs/name]) --> Validate{验证连接格式}
    Validate -->|无效| Error1[返回 400 错误]
    Validate -->|有效| Create[DatabaseService.create_database]

    Create --> Detect{检测数据库类型}
    Detect -->|MySQL| MySQL[添加 pymysql 驱动]
    Detect -->|PostgreSQL| PG[使用 postgresql 驱动]
    Detect -->|SQLite| SQLite[使用 sqlite 驱动]

    MySQL --> Test[测试连接]
    PG --> Test
    SQLite --> Test

    Test --> Success{连接成功?}
    Success -->|否| Error2[返回 400 错误]
    Success -->|是| Save[保存到内部 SQLite]
    Save --> Return([返回 DatabaseDetail])

    style Start fill:#ffebee
    style Error1 fill:#ffcdd2
    style Error2 fill:#ffcdd2
    style Return fill:#c8e6c9
```

##### 查询执行端点 (`queries.py`)

**速率限制策略**

```python
# 依赖注入限流器
limiter = Limiter(key_func=get_remote_address)

# 不同端点的限制
@router.post("/query", dependencies=[Depends(rate_limit_query)])        # 30/分钟
@router.post("/query/natural", dependencies=[Depends(rate_limit_ai)])  # 10/分钟
@router.post("/query/export", dependencies=[Depends(rate_limit_export)]) # 20/分钟
```

**自然语言查询完整流程**

```mermaid
flowchart TD
    Start([POST query/natural]) --> Gen[LLMService.generate_and_validate]
    Gen --> Retry{重试循环 max=3}

    Retry --> Build[构建 Prompt 包含元数据上下文]
    Build --> Call[调用智谱 AI API]
    Call --> Check{API 成功?}

    Check -->|瞬态错误| Wait[等待指数退避]
    Wait --> Retry

    Check -->|持久错误| Throw[抛出 LLMServiceError]
    Check -->|成功| Parse[解析 SQL]

    Parse --> ExecImm{executeImmediately?}
    ExecImm -->|是| Exec[QueryService.execute_query]
    ExecImm -->|否| ReturnSQL([返回生成的 SQL])

    Exec --> Log[记录查询历史]
    Log --> ReturnResult([返回结果])

    style Start fill:#e3f2fd
    style Throw fill:#ffebee
    style ReturnSQL fill:#fff9c4
    style ReturnResult fill:#c8e6c9
```

##### 性能监控端点 (`metrics.py`)

**系统指标收集**

```python
@router.get("/system")
async def get_system_metrics() -> SystemMetrics:
    """获取当前系统指标"""
    import psutil

    return SystemMetrics(
        cpu_percent=psutil.cpu_percent(interval=1),
        memory_percent=psutil.virtual_memory().percent,
        disk_percent=psutil.disk_usage('/').percent,
        process_memory_mb=psutil.Process().memory_info().rss / 1024 / 1024,
        timestamp=datetime.now().isoformat()
    )
```

#### 服务层 (`src/services/`)

##### DatabaseService - 数据库连接管理

**连接池架构**

```mermaid
flowchart TD
    DSvc["DatabaseService"]

    DSvc --> Cache["引擎缓存 dict int, Engine"]
    DSvc --> Cleanup["后台清理任务"]

    Cache --> E1["Engine 1<br/>db_id=1<br/>last_used=now"]
    Cache --> E2["Engine 2<br/>db_id=2<br/>last_used=5min ago"]

    Cleanup --> Timer{每 5 分钟}
    Timer --> Check[检查空闲时间]
    Check --> Timeout{大于 1 小时?}

    Timeout -->|是| Dispose[dispose 引擎]
    Timeout -->|否| Keep[保留]

    E1 -.->|清理| Dispose
    E2 -.->|清理| Dispose

    style DSvc fill:#e1f5fe
    style Cache fill:#fff3e0
    style Cleanup fill:#f3e5f5
    style Dispose fill:#ffcdd2
    style Keep fill:#c8e6c9
```

**核心函数签名**

```python
class DatabaseService:
    """数据库连接管理服务"""

    def __init__(self) -> None: ...

    async def create_database(
        self,
        request: DatabaseCreateRequest
    ) -> DatabaseDetail:
        """创建数据库连接

        Args:
            request: 包含 name 和 url 的创建请求

        Returns:
            DatabaseDetail: 包含元数据的完整详情

        Raises:
            ValidationError: 连接字符串格式无效
            AlreadyExistsError: 数据库名称已存在
        """
        ...

    def get_engine(
        self,
        db_id: int,
        url: str
    ) -> Engine:
        """获取或创建 SQLAlchemy Engine

        实现 LRU 缓存策略：
        - 已存在且未超时：返回缓存的引擎
        - 不存在或已超时：创建新引擎

        Args:
            db_id: 数据库 ID
            url: 连接字符串

        Returns:
            Engine: SQLAlchemy 引擎实例
        """
        ...

    async def _cleanup_idle_engines(self) -> None:
        """后台任务：清理空闲超过 1 小时的引擎"""
        while True:
            await asyncio.sleep(300)  # 5 分钟
            now = time.time()
            for db_id, (engine, last_used) in list(self._engines.items()):
                if now - last_used > 3600:  # 1 小时
                    engine.dispose()
                    del self._engines[db_id]
```

**连接字符串解析**

```python
def _parse_connection_string(self, url: str) -> ConnectionString:
    """解析连接字符串并检测数据库类型

    支持的格式：
    - MySQL:    mysql://user:pass@host:3306/db
    - PostgreSQL: postgresql://user:pass@host:5432/db
    - SQLite:   sqlite:///path/to/db.db (相对)
               sqlite:////absolute/path/db.db (绝对)

    Returns:
        ConnectionString: 解析后的连接信息
    """
    if url.startswith("postgresql://"):
        return ConnectionString(type="postgresql", ...)
    elif url.startswith("mysql://"):
        return ConnectionString(type="mysql", ...)
    elif url.startswith("sqlite://"):
        return ConnectionString(type="sqlite", ...)
    else:
        raise ValidationError(f"不支持的数据库类型")
```

##### QueryService - 查询执行服务

**SQL 验证流程**

```python
async def execute_query(
    self,
    database: DatabaseDetail,
    engine: Engine,
    sql: str,
    timeout: int = 30,
    query_type: str = "sql",
    input_text: str | None = None
) -> QueryResponse:
    """执行 SQL 查询

    验证和执行流程：
    1. SQL 语法验证（sqlglot）
    2. 检查是否为 SELECT
    3. 添加 LIMIT（如未指定）
    4. 执行查询（带超时）
    5. 序列化结果
    6. 记录历史
    7. 监控慢查询
    """
```

**类型推断算法**

```python
def _infer_column_type(
    self,
    samples: list[Any]
) -> str:
    """从前 100 行样本推断列类型

    优先级：
    1. NULL → TEXT
    2. bool → BOOLEAN
    3. int → INTEGER
    4. float → FLOAT
    5. datetime/date → TEXT (ISO 格式)
    6. 其他 → TEXT
    """
    for value in samples:
        if value is None:
            continue
        if isinstance(value, bool):
            return "BOOLEAN"
        elif isinstance(value, int):
            return "INTEGER"
        elif isinstance(value, float):
            return "FLOAT"
        elif isinstance(value, (datetime, date)):
            return "TEXT"
        else:
            return "TEXT"
    return "TEXT"  # 全是 NULL
```

##### LLMService - AI 服务

**Prompt 工程设计**

```python
def _build_prompt(
    self,
    natural_query: str,
    tables: list[TableMetadata],
    views: list[ViewMetadata],
    db_type: str
) -> str:
    """构建智谱 AI 的 Prompt

    Prompt 结构：
    1. System: 角色（SQL 专家）和约束
    2. Context: 数据库架构（表、列、类型）
    3. Examples: 少样本示例
    4. Query: 用户的自然语言问题
    """
    context = self._format_metadata_context(tables, views)

    return f"""你是一个 SQL 专家，专门为 {db_type} 数据库编写查询。

数据库架构：
{context}

请根据用户的自然语言描述，生成对应的 SQL 查询。

要求：
1. 只生成 SELECT 查询
2. 使用表别名提高可读性
3. 添加 LIMIT 限制结果数量
4. 使用标准的 SQL 语法

用户问题：{natural_query}

请只返回 SQL 语句，不要包含任何解释。
"""
```

**重试机制配置**

```python
@retry(
    stop=stop_after_attempt(3),              # 最多重试 3 次
    wait=wait_exponential(
        multiplier=1,                        # 基础等待 1 秒
        min=2,                               # 最小 2 秒
        max=10                               # 最大 10 秒
    ),
    retry=retry_if_exception_type(TransientLLMError),
    before_sleep=lambda _: logger.info("retrying_llm_request")
)
async def generate_sql(
    self,
    natural_query: str,
    tables: list[TableMetadata],
    views: list[ViewMetadata],
    db_type: str
) -> tuple[str, str | None]:
    """生成 SQL（带自动重试）

    Returns:
        (generated_sql, explanation): SQL 语句和说明
    """
```

##### MetadataService - 元数据服务

**批量提取策略**

```python
async def fetch_metadata(
    self,
    database: DatabaseDetail,
    engine: Engine,
    force_refresh: bool = False
) -> MetadataResponse:
    """获取数据库元数据（带缓存）

    缓存策略：
    - TTL: 1 小时
    - Key: f"metadata:{database.id}"
    - force_refresh: 强制刷新

    批量优化：
    - 一次性获取所有表的列信息
    - 分组获取主键信息
    - 使用 information_schema 查询
    """
```

**SQL 注入防护**

```python
def _validate_identifier(self, identifier: str) -> None:
    """验证 SQL 标识符安全性

    允许的字符：
    - 字母 (a-z, A-Z)
    - 数字 (0-9)
    - 下划线 (_)
    - 美元符号 ($)
    - 点号 (.) 用于 schema.table

    拒绝：
    - 分号 (;)
    - 注释符号 (--, /*)
    - 引号 (', ")
    """
    if not re.match(r'^[a-zA-Z0-9_\.$]+$', identifier):
        raise SQLValidationError(f"无效的标识符: {identifier}")
```

##### MetricsService - 性能监控服务

**后台任务调度**

```python
async def start_collection(self) -> None:
    """启动性能指标收集

    运行两个后台任务：
    1. 系统指标收集（每 60 秒）
    2. 性能统计计算（每 5 分钟）
    """
    self._collecting = True

    # 任务 1: 系统指标收集
    asyncio.create_task(self._system_metrics_loop())

    # 任务 2: 性能统计计算
    asyncio.create_task(self._performance_stats_loop())

async def _system_metrics_loop(self) -> None:
    """每 60 秒收集系统指标"""
    while self._collecting:
        metrics = await get_current_system_metrics()
        self._system_metrics_history.append(metrics)
        await asyncio.sleep(60)
```

**慢查询分级**

```python
def _classify_query(self, execution_time_ms: int) -> str:
    """根据执行时间分类查询

    阈值：
    - < 1000ms: 正常
    - 1000-5000ms: 慢查询
    - 5000-10000ms: 非常慢
    - > 10000ms: 严重慢查询
    """
    if execution_time_ms < 1000:
        return "normal"
    elif execution_time_ms < 5000:
        return "slow"
    elif execution_time_ms < 10000:
        return "very_slow"
    else:
        return "critical"
```

#### 数据模型层 (`src/models/`)

##### CamelModel 基类设计

```python
class CamelModel(BaseModel):
    """所有 API 响应模型的基类

    功能：
    - 自动将 snake_case 转换为 camelCase
    - 支持按名称或别名访问字段
    """

    model_config = ConfigDict(
        alias_generator=to_camel,      # snake_case -> camelCase
        populate_by_name=True,         # 支持两种命名访问
        from_attributes=True           # 支持从对象创建
    )

# 示例
class QueryResponse(CamelModel):
    executed_sql: str          # JSON 中为 "executedSql"
    row_count: int             # JSON 中为 "rowCount"
    execution_time_ms: int     # JSON 中为 "executionTimeMs"
```

#### 核心模块 (`src/core/`)

##### constants.py - 常量定义

```python
class Database:
    """数据库相关常量"""
    ENGINE_IDLE_TIMEOUT = 3600  # 引擎空闲超时（秒）
    CLEANUP_INTERVAL = 300      # 清理间隔（秒）

class Query:
    """查询相关常量"""
    DEFAULT_LIMIT = 1000        # 默认 LIMIT
    QUERY_TIMEOUT = 30          # 查询超时（秒）
    TYPE_INFERENCE_SAMPLE_ROWS = 100  # 类型推断样本行数

class Metadata:
    """元数据相关常量"""
    CACHE_TTL = timedelta(hours=1)  # 缓存生存时间

class Validation:
    """验证相关常量"""
    DATABASE_NAME_MIN_LENGTH = 1
    DATABASE_NAME_MAX_LENGTH = 100
    SQL_QUERY_MAX_LENGTH = 100_000
    PROMPT_MAX_LENGTH = 5_000

class Performance:
    """性能监控常量"""
    SLOW_QUERY_THRESHOLD = 1000         # 1 秒
    VERY_SLOW_QUERY_THRESHOLD = 5000    # 5 秒
    CRITICAL_SLOW_QUERY_THRESHOLD = 10000  # 10 秒
    MEMORY_WARNING_THRESHOLD = 80       # 80%
    MEMORY_CRITICAL_THRESHOLD = 90      # 90%
```

##### sqlite_db.py - 内部数据库

**表结构设计**

```sql
-- 数据库连接表
CREATE TABLE databases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,           -- 数据库名称（唯一）
    url TEXT NOT NULL,                   -- 连接字符串
    db_type TEXT NOT NULL,               -- mysql/postgresql/sqlite
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_connected_at TIMESTAMP,         -- 最后连接时间
    metadata_json TEXT,                  -- 缓存的元数据 JSON
    is_active BOOLEAN NOT NULL DEFAULT 1 -- 是否激活
);

-- 查询历史表
CREATE TABLE query_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    database_id INTEGER NOT NULL,
    database_name TEXT NOT NULL,
    query_type TEXT NOT NULL,            -- sql/natural
    input_text TEXT NOT NULL,            -- 用户输入
    generated_sql TEXT,                  -- AI 生成的 SQL
    executed_sql TEXT,                   -- 实际执行的 SQL
    row_count INTEGER,                   -- 返回行数
    execution_time_ms INTEGER,           -- 执行耗时
    status TEXT NOT NULL,                -- success/error
    error_message TEXT,                  -- 错误信息
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (database_id) REFERENCES databases(id) ON DELETE CASCADE
);

-- 索引优化
CREATE INDEX idx_query_history_db_id ON query_history(database_id);
CREATE INDEX idx_query_history_created_at ON query_history(created_at DESC);
```

##### sql_parser.py - SQL 解析器

**sqlglot 封装**

```python
class SQLParser:
    """SQL 解析器（使用 sqlglot）"""

    def __init__(self, dialect: str = "mysql") -> None:
        self.dialect = dialect

    def parse(self, sql: str) -> exp.Expression:
        """解析 SQL 为 AST

        Args:
            sql: SQL 语句

        Returns:
            exp.Expression: AST 根节点

        Raises:
            SQLParseError: 语法错误
        """
        try:
            return parse_one(sql, dialect=self.dialect)
        except ParseError as e:
            raise SQLParseError(str(e), sql)

    def validate_select_only(self, sql: str) -> None:
        """验证是否为 SELECT 查询

        拒绝：
        - INSERT, UPDATE, DELETE
        - DROP, CREATE, ALTER
        - TRUNCATE, etc.

        Raises:
            SQLValidationError: 非 SELECT 查询
        """
        ast = self.parse(sql)
        if not isinstance(ast, exp.Select):
            raise SQLValidationError("只允许 SELECT 查询")

    def ensure_limit(
        self,
        sql: str,
        default_limit: int = 1000
    ) -> str:
        """确保 SQL 有 LIMIT 子句

        如果没有 LIMIT，自动添加：
        SELECT * FROM users
        → SELECT * FROM users LIMIT 1000

        Args:
            sql: 原始 SQL
            default_limit: 默认 LIMIT 值

        Returns:
            str: 添加 LIMIT 后的 SQL
        """
        ast = self.parse(sql)
        if not ast.args.get("limit"):
            ast.limit(f"LIMIT {default_limit}", copy=False)
        return ast.sql(dialect=self.dialect)
```

#### 中间件 (`src/middleware/`)

##### rate_limit.py - 速率限制

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

# 创建限流器
limiter = Limiter(
    key_func=get_remote_address,  # 按 IP 限流
    default_limits=["200/hour"]    # 默认 200/小时
)

# 预配置限流器
rate_limit_query = limiter.limit("30/minute")
rate_limit_ai = limiter.limit("10/minute")
rate_limit_export = limiter.limit("20/minute")
```

##### performance.py - 性能监控

```python
class PerformanceMiddleware:
    """性能监控中间件

    记录指标：
    - 请求计数（按路径、方法、状态码）
    - 延迟百分位数（P50, P95, P99）
    - 错误率
    - 最近请求历史（100 条）
    """

    def __init__(self, app: FastAPI) -> None:
        self.app = app
        self.metrics: list[RequestMetric] = []

    async def dispatch(
        self,
        request: Request,
        call_next: Callable
    ) -> Response:
        """处理每个请求"""
        start_time = time.time()

        response = await call_next(request)

        duration_ms = (time.time() - start_time) * 1000

        # 记录指标
        self._record_metric(request, response, duration_ms)

        return response

    def _record_metric(
        self,
        request: Request,
        response: Response,
        duration_ms: float
    ) -> None:
        """记录请求指标"""
        metric = RequestMetric(
            path=request.url.path,
            method=request.method,
            status_code=response.status_code,
            duration_ms=duration_ms,
            timestamp=datetime.now()
        )
        self.metrics.append(metric)

        # 只保留最近 1000 条
        if len(self.metrics) > 1000:
            self.metrics = self.metrics[-1000:]
```

### 2.2 函数调用链分析

#### 自然语言查询完整调用链

```mermaid
flowchart TD
    Start([POST query/natural]) --> F1[natural_query 函数]

    F1 --> S1[get_database_by_name]
    S1 --> S2[fetch_from_sqlite]
    S2 --> R1([返回 DatabaseDetail])

    R1 --> S3[get_engine]
    S3 --> C1{缓存中?}
    C1 -->|是| H1[返回缓存的 Engine]
    C1 -->|否| NewE[create_engine]
    NewE --> H1

    H1 --> S4[fetch_metadata]
    S4 --> C2{缓存有效?}
    C2 -->|是| H2[返回缓存]
    C2 -->|否| Fetch[_fetch_tables + _fetch_views]

    Fetch --> LLM[generate_and_validate]
    LLM --> Gen[generate_sql @retry]
    Gen --> Prompt[_build_prompt]
    Prompt --> API[智谱 AI API]
    API --> Parse[_parse_llm_response]
    Parse --> Exec{executeImmediately?}

    Exec -->|是| QExec[execute_query]
    Exec -->|否| R2([返回生成的 SQL])

    QExec --> ExecE[_execute_with_engine]
    ExecE --> Valid[validate_select_only]
    Valid --> Limit[ensure_limit]
    Limit --> Run[engine.execute]
    Run --> Ser[_serialize_results]
    Ser --> Log[_log_query]
    Log --> Slow[record_slow_query 如果大于1s]
    Slow --> R3([返回 QueryResponse])

    style Start fill:#e3f2fd
    style R1 fill:#fff9c4
    style R2 fill:#fff9c4
    style R3 fill:#c8e6c9
    style C1 fill:#ffe0b2
    style C2 fill:#ffe0b2
    style Exec fill:#e1bee7
```

**详细代码位置**

| 步骤 | 文件路径 | 函数/方法 | 行号参考 |
|------|----------|-----------|----------|
| 1 | `backend/src/api/v1/queries.py` | `natural_query()` | ~50 |
| 2 | `backend/src/services/db_service.py` | `get_database_by_name()` | ~80 |
| 3 | `backend/src/services/db_service.py` | `get_engine()` | ~120 |
| 4 | `backend/src/services/metadata_service.py` | `fetch_metadata()` | ~30 |
| 5 | `backend/src/services/llm_service.py` | `generate_and_validate()` | ~80 |
| 6 | `backend/src/services/llm_service.py` | `generate_sql()` | ~40 (带 @retry) |
| 7 | `backend/src/services/llm_service.py` | `_build_prompt()` | ~150 |
| 8 | `backend/src/services/query_service.py` | `execute_query()` | ~30 |
| 9 | `backend/src/core/sql_parser.py` | `validate_select_only()` | ~50 |
| 10 | `backend/src/core/sql_parser.py` | `ensure_limit()` | ~70 |

---

## 第三部分：前端架构详解

### 3.1 组件架构

#### 页面层 (`src/pages/Dashboard/`)

##### Dashboard/index.tsx - 主仪表板

**协调器模式**

```typescript
export default function Dashboard() {
  // === 状态管理 ===
  const {
    databases,
    createDatabase,
    deleteDatabase,
    updateDatabase,
    refreshDatabases
  } = useDatabases();

  const {
    selectedDatabase,
    selectedDatabaseName,
    selectDatabase,
    clearDatabase,
    deleteDatabase: deleteWithConfirm,
    refreshMetadata
  } = useMetadata();

  const {
    sql,
    setSql,
    queryResult,
    executeQuery,
    handleQueryGenerated,
    clearQuery
  } = useQueryExecution();

  // === 布局 ===
  return (
    <Layout>
      <Header />
      <Layout>
        <Sidebar
          databases={databases}
          selectedDatabase={selectedDatabase}
          onSelectDatabase={selectDatabase}
          onDeleteDatabase={deleteWithConfirm}
        />
        <Content>
          {selectedDatabase ? (
            <>
              <DatabaseInfo database={selectedDatabase} />
              <QueryTabs
                sql={sql}
                setSql={setSql}
                queryResult={queryResult}
                executeQuery={executeQuery}
                onQueryGenerated={handleQueryGenerated}
                onClearQuery={clearQuery}
                databaseName={selectedDatabaseName}
              />
            </>
          ) : (
            <Empty description="请选择或创建数据库" />
          )}
        </Content>
      </Layout>
    </Layout>
  );
}
```

##### Dashboard/Sidebar.tsx - 侧边栏

**架构浏览器**

```typescript
export function Sidebar({
  databases,
  selectedDatabase,
  onSelectDatabase,
  onDeleteDatabase
}: SidebarProps) {
  const [searchValue, setSearchValue] = useState("");

  // 构建树形数据
  const treeData = useTreeData(selectedDatabase);

  return (
    <Sider width={300}>
      {/* 数据库列表 */}
      <DatabaseList
        databases={databases}
        selected={selectedDatabase}
        onSelect={onSelectDatabase}
        onDelete={onDeleteDatabase}
      />

      {/* 架构浏览器 */}
      {selectedDatabase && (
        <>
          <Input.Search
            placeholder="搜索表或视图..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
          <Tree
            treeData={treeData}
            onSelect={(keys, info) => {
              if (info.node.isTable) {
                const selectSql = `SELECT * FROM ${info.node.schema || ''}${info.node.name} LIMIT 1000;`;
                onSqlGenerated?.(selectSql);
              }
            }}
          />
        </>
      )}
    </Sider>
  );
}
```

##### Dashboard/QueryTabs.tsx - 查询标签页

```typescript
const items: TabsProps['items'] = [
  {
    key: 'sql',
    label: 'SQL 查询',
    children: (
      <SqlEditor
        sql={sql}
        onChange={setSql}
        onExecute={executeQuery}
        result={queryResult}
      />
    ),
  },
  {
    key: 'natural',
    label: 'AI 查询',
    children: (
      <NaturalQueryInput
        databaseName={databaseName}
        onQueryGenerated={handleQueryGenerated}
        onQueryExecuted={handleNaturalQueryExecuted}
      />
    ),
  },
  {
    key: 'history',
    label: '历史记录',
    children: (
      <QueryHistoryTab databaseName={databaseName} />
    ),
  },
  {
    key: 'performance',
    label: '性能监控',
    children: (
      <PerformanceDashboard />
    ),
  },
];
```

#### 自定义 Hooks (`src/pages/Dashboard/hooks/`)

##### useDatabases.ts - 数据库列表管理

```typescript
export function useDatabases() {
  const queryClient = useQueryClient();

  // === Query ===
  const {
    data: response,
    isLoading,
    error,
  } = useQuery({
    queryKey: databaseKeys.list(),
    queryFn: () => api.listDatabases(),
    staleTime: 2 * 60 * 1000,  // 2 分钟
  });

  const databases = response?.databases ?? [];

  // === Mutations ===
  const createMutation = useMutation({
    mutationFn: ({ name, url }: DatabaseCreateRequest) =>
      api.createDatabase(name, url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: databaseKeys.list() });
      message.success("数据库创建成功");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.deleteDatabase(name),
    onMutate: async (name) => {
      // 乐观更新：备份当前数据
      await queryClient.cancelQueries({ queryKey: databaseKeys.list() });
      const previous = queryClient.getQueryData(databaseKeys.list());
      queryClient.setQueryData(
        databaseKeys.list(),
        (old: any) => ({
          ...old,
          databases: old.databases.filter((db: any) => db.name !== name)
        })
      );
      return { previous };
    },
    onError: (err, name, context) => {
      // 失败时回滚
      queryClient.setQueryData(databaseKeys.list(), context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: databaseKeys.list() });
    },
  });

  return {
    databases,
    isLoading,
    error,
    createDatabase: createMutation.mutate,
    deleteDatabase: deleteMutation.mutate,
  };
}
```

##### useMetadata.ts - 元数据管理

```typescript
export function useMetadata() {
  const queryClient = useQueryClient();
  const [selectedDatabaseName, setSelectedDatabaseName] = useState<string | null>(null);

  // 条件查询：只有选中数据库时才查询
  const {
    data: selectedDatabase,
    isLoading,
  } = useQuery({
    queryKey: metadataKeys.detail(selectedDatabaseName!),
    queryFn: () => api.getDatabase(selectedDatabaseName!),
    enabled: !!selectedDatabaseName,  // 条件启用
    staleTime: 10 * 60 * 1000,  // 10 分钟
  });

  const selectDatabase = useCallback((name: string) => {
    setSelectedDatabaseName(name);
  }, []);

  const refreshMetadata = useCallback(() => {
    if (selectedDatabaseName) {
      queryClient.invalidateQueries({
        queryKey: metadataKeys.detail(selectedDatabaseName)
      });
    }
  }, [selectedDatabaseName, queryClient]);

  const deleteDatabase = useCallback(async (name: string) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除数据库 "${name}" 吗？此操作不可撤销。`,
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        await api.deleteDatabase(name);
        if (selectedDatabaseName === name) {
          setSelectedDatabaseName(null);
        }
        queryClient.invalidateQueries({ queryKey: databaseKeys.list() });
        message.success('数据库已删除');
      },
    });
  }, [selectedDatabaseName, queryClient]);

  return {
    selectedDatabase,
    selectedDatabaseName,
    selectDatabase,
    clearDatabase: () => setSelectedDatabaseName(null),
    deleteDatabase,
    refreshMetadata,
    isLoading,
  };
}
```

##### useQueryExecution.ts - 查询执行

```typescript
export function useQueryExecution() {
  const [sql, setSql] = useState('');
  const [queryResult, setQueryResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const executeQueryMutation = useMutation({
    mutationFn: ({ databaseName, sql }: { databaseName: string; sql: string }) =>
      api.executeQuery(databaseName, sql),
    onSuccess: (result) => {
      setQueryResult(result);
      setError(null);
    },
    onError: (err: any) => {
      setError(err.error?.message || '查询失败');
      setQueryResult(null);
    },
  });

  const executeQuery = useCallback(() => {
    if (!sql.trim()) {
      message.warning('请输入 SQL 查询');
      return;
    }
    executeQueryMutation.mutate({ databaseName, sql: sql.trim() });
  }, [sql, databaseName, executeQueryMutation]);

  const handleQueryGenerated = useCallback((generatedSql: string) => {
    setSql(generatedSql);
    // 切换到 SQL 标签页
    setActiveTab('sql');
  }, []);

  const clearQuery = useCallback(() => {
    setSql('');
    setQueryResult(null);
    setError(null);
  }, []);

  return {
    sql,
    setSql,
    queryResult,
    error,
    executeQuery,
    handleQueryGenerated,
    clearQuery,
  };
}
```

##### usePerformance.ts - 性能监控

```typescript
export function usePerformance() {
  // === 系统指标（5 秒刷新） ===
  const useSystemMetrics = () => useQuery({
    queryKey: ['system-metrics'],
    queryFn: () => performanceApi.getSystemMetrics(),
    refetchInterval: 5 * 1000,
  });

  // === 系统指标历史（30 秒刷新） ===
  const useSystemMetricsHistory = (limit = 100) => useQuery({
    queryKey: ['system-metrics-history', limit],
    queryFn: () => performanceApi.getSystemMetricsHistory(limit),
    refetchInterval: 30 * 1000,
  });

  // === 慢查询列表（10 秒刷新） ===
  const useSlowQueries = (params?: SlowQueryParams) => useQuery({
    queryKey: ['slow-queries', params],
    queryFn: () => performanceApi.getSlowQueries(params),
    refetchInterval: 10 * 1000,
  });

  // === 查询性能统计（15 秒刷新） ===
  const useQueryPerformanceStats = (params?: PerformanceStatsParams) => useQuery({
    queryKey: ['query-performance', params],
    queryFn: () => performanceApi.getQueryPerformanceStats(params),
    refetchInterval: 15 * 1000,
  });

  // === 健康状态（10 秒刷新） ===
  const useHealthDetailed = () => useQuery({
    queryKey: ['health-detailed'],
    queryFn: () => performanceApi.getHealthDetailed(),
    refetchInterval: 10 * 1000,
  });

  // === 组合 Hook ===
  const usePerformanceDashboard = () => {
    return {
      system: useSystemMetrics(),
      history: useSystemMetricsHistory(),
      slowQueries: useSlowQueries(),
      stats: useQueryPerformanceStats(),
      health: useHealthDetailed(),
    };
  };

  return {
    useSystemMetrics,
    useSystemMetricsHistory,
    useSlowQueries,
    useQueryPerformanceStats,
    useHealthDetailed,
    usePerformanceDashboard,
  };
}
```

#### 组件层 (`src/components/`)

##### query/SqlEditor.tsx - Monaco 编辑器

```typescript
import Editor from '@monaco-editor/react';

export function SqlEditor({
  sql,
  onChange,
  onExecute,
  result,
}: SqlEditorProps) {
  const editorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    // 注册 SQL 语言
    monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: () => ({
        suggestions: [
          {
            label: 'SELECT',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'SELECT ',
          },
          // ... 更多关键字
        ],
      }),
    });

    // 快捷键：Ctrl+Enter 执行
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onExecute();
    });
  };

  return (
    <div className="flex flex-col h-full">
      <Toolbar>
        <Button onClick={() => editorRef.current?.getAction('editor.action.formatDocument')?.run()}>
          格式化
        </Button>
        <Button type="primary" onClick={onExecute}>
          执行 (Ctrl+Enter)
        </Button>
      </Toolbar>

      <Editor
        height="400px"
        defaultLanguage="sql"
        value={sql}
        onChange={(value) => onChange(value ?? '')}
        onMount={handleEditorDidMount}
        options={{
          fontSize: 14,
          wordWrap: 'on',
          minimap: { enabled: false },
          automaticLayout: true,
          scrollBeyondLastLine: false,
        }}
      />

      <QueryResults result={result} />
    </div>
  );
}
```

##### query/NaturalQueryInput.tsx - AI 查询输入

```typescript
export function NaturalQueryInput({
  databaseName,
  onQueryGenerated,
  onQueryExecuted,
}: NaturalQueryInputProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [generatedResult, setGeneratedResult] = useState<NaturalQueryResponse | null>(null);

  // 获取查询建议
  const { data: suggestedQueries } = useQuery({
    queryKey: ['suggested-queries', databaseName],
    queryFn: () => api.getSuggestedQueries(databaseName, 6),
    staleTime: 5 * 60 * 1000,
  });

  // 生成 SQL
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      message.warning('请输入查询描述');
      return;
    }

    setLoading(true);
    try {
      const result = await api.naturalQuery(databaseName, prompt, false);
      setGeneratedResult(result);

      if (result.isValid) {
        Modal.success({
          title: 'SQL 生成成功',
          content: (
            <div>
              <p><strong>生成的 SQL：</strong></p>
              <pre>{result.generatedSql}</pre>
              {result.explanation && (
                <p><strong>说明：</strong>{result.explanation}</p>
              )}
            </div>
          ),
          okText: '立即执行',
          onOk: () => onQueryExecuted?.(result.generatedSql),
          cancelText: '在编辑器中查看',
          onCancel: () => onQueryGenerated(result.generatedSql),
        });
      }
    } catch (err: any) {
      message.error(err.error?.message || '生成失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gradient-bg">
      <div className="glass-card">
        <Title>AI 智能查询</Title>

        {/* 猜你想搜 */}
        <div className="suggestions">
          <Text>猜你想搜：</Text>
          {suggestedQueries?.map((query, index) => (
            <Tag
              key={index}
              onClick={() => setPrompt(query)}
              style={{ cursor: 'pointer' }}
            >
              {query}
            </Tag>
          ))}
          <Button type="link" onClick={() => refetch()}>
            换一批
          </Button>
        </div>

        {/* 输入框 */}
        <TextArea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              handleGenerate();
            }
          }}
          placeholder="用自然语言描述你想要查询的数据..."
          autoSize={{ minRows: 3, maxRows: 6 }}
        />

        <Button
          type="primary"
          size="large"
          onClick={handleGenerate}
          loading={loading}
          block
        >
          生成 SQL (Enter)
        </Button>
      </div>
    </div>
  );
}
```

##### query/QueryResults.tsx - 结果展示

```typescript
export function QueryResults({ result }: { result: QueryResponse | null }) {
  if (!result) {
    return <Empty description="执行查询以查看结果" />;
  }

  const columns = result.columns.map((col) => ({
    title: (
      <Space>
        <span>{col.name}</span>
        <Tag color={getTypeColor(col.dataType)}>
          {col.dataType}
        </Tag>
      </Space>
    ),
    dataIndex: col.name,
    key: col.name,
    width: 200,
    render: (value: any) => {
      if (value === null) return <Text type="secondary">NULL</Text>;
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    },
  }));

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const data = await api.exportQueryResults(
        databaseName,
        result.executedSql,
        format,
        true
      );
      const blob = new Blob([data.content], { type: data.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
      message.success(`已导出 ${format.toUpperCase()}`);
    } catch (err) {
      message.error('导出失败');
    }
  };

  return (
    <div>
      <Space className="mb-4">
        <Text strong>结果：{result.rowCount} 行</Text>
        <Text>耗时：{result.executionTimeMs} ms</Text>
        {!result.hasLimit && (
          <Tag color="warning">无 LIMIT 限制</Tag>
        )}
        <Button
          icon={<DownloadOutlined />}
          onClick={() => handleExport('csv')}
        >
          导出 CSV
        </Button>
        <Button
          icon={<DownloadOutlined />}
          onClick={() => handleExport('json')}
        >
          导出 JSON
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={result.rows}
        scroll={{ y: 400 }}
        pagination={{
          pageSizeOptions: ['20', '50', '100', '200'],
          showSizeChanger: true,
          defaultPageSize: 20,
        }}
        size="small"
      />
    </div>
  );
}
```

### 3.2 状态管理

#### React Query 策略

**Query Key 工厂模式**

```typescript
// 数据库相关
const databaseKeys = {
  all: ['databases'] as const,
  list: () => [...databaseKeys.all, 'list'] as const,
  detail: (name: string) => [...databaseKeys.all, 'detail', name] as const,
};

// 元数据相关
const metadataKeys = {
  all: ['metadata'] as const,
  detail: (name: string) => [...metadataKeys.all, 'detail', name] as const,
};

// 查询历史相关
const historyKeys = {
  all: ['history'] as const,
  list: (dbName: string, page: number, pageSize: number) =>
    [...historyKeys.all, 'list', dbName, page, pageSize] as const,
  summary: (dbName: string) =>
    [...historyKeys.all, 'summary', dbName] as const,
};
```

**缓存时间配置**

| 查询类型 | staleTime | gcTime | 理由 |
|----------|-----------|--------|------|
| 数据库列表 | 2 分钟 | 10 分钟 | 不常变化 |
| 元数据详情 | 10 分钟 | 1 小时 | 很少变化 |
| 查询历史 | 0 | 5 分钟 | 频繁更新 |
| 查询建议 | 5 分钟 | 30 分钟 | AI 生成较慢 |
| 系统指标 | 0 | 1 分钟 | 实时数据 |

**自动失效策略**

```typescript
// 创建数据库后失效列表
const createMutation = useMutation({
  mutationFn: api.createDatabase,
  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: databaseKeys.list()
    });
  },
});

// 删除数据库后失效相关缓存
const deleteMutation = useMutation({
  mutationFn: api.deleteDatabase,
  onSuccess: (_, name) => {
    queryClient.invalidateQueries({
      queryKey: databaseKeys.list()
    });
    queryClient.removeQueries({
      queryKey: metadataKeys.detail(name)
    });
    queryClient.removeQueries({
      queryKey: historyKeys.all
    });
  },
});
```

### 3.3 API 客户端

#### src/services/api.ts - 主 API 客户端

```typescript
class ApiClient {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();
      throw error;
    }

    return response.json();
  }

  // === 数据库操作 ===
  async listDatabases(): Promise<DatabaseListResponse> {
    return this.request('/api/v1/dbs');
  }

  async createDatabase(name: string, url: string): Promise<DatabaseDetail> {
    return this.request(`/api/v1/dbs/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify({ name, url }),
    });
  }

  async getDatabase(name: string, refresh = false): Promise<DatabaseDetail> {
    const params = refresh ? '?refresh=true' : '';
    return this.request(`/api/v1/dbs/${encodeURIComponent(name)}${params}`);
  }

  async deleteDatabase(name: string): Promise<void> {
    return this.request(`/api/v1/dbs/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
  }

  // === 查询操作 ===
  async executeQuery(databaseName: string, sql: string): Promise<QueryResponse> {
    return this.request(`/api/v1/dbs/${encodeURIComponent(databaseName)}/query`, {
      method: 'POST',
      body: JSON.stringify({ sql }),
    });
  }

  async naturalQuery(
    databaseName: string,
    prompt: string,
    executeImmediately: boolean
  ): Promise<NaturalQueryResponse> {
    return this.request(`/api/v1/dbs/${encodeURIComponent(databaseName)}/query/natural`, {
      method: 'POST',
      body: JSON.stringify({ prompt, executeImmediately }),
    });
  }

  async getSuggestedQueries(
    databaseName: string,
    limit: number,
    options?: { seed?: number; exclude?: string[] }
  ): Promise<string[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...(options?.seed && { seed: options.seed.toString() }),
      ...(options?.exclude && { exclude: options.exclude.join(',') }),
    });
    return this.request(`/api/v1/dbs/${encodeURIComponent(databaseName)}/suggested-queries?${params}`);
  }

  async getQueryHistory(
    databaseName: string,
    page = 1,
    pageSize = 20
  ): Promise<QueryHistoryResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    return this.request(`/api/v1/dbs/${encodeURIComponent(databaseName)}/history?${params}`);
  }

  async deleteQueryHistory(
    databaseName: string,
    ids: number[]
  ): Promise<void> {
    return this.request(`/api/v1/dbs/${encodeURIComponent(databaseName)}/history`, {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    });
  }

  async exportQueryResults(
    databaseName: string,
    sql: string,
    format: 'csv' | 'json',
    includeHeaders = true
  ): Promise<ExportResponse> {
    return this.request(`/api/v1/dbs/${encodeURIComponent(databaseName)}/query/export`, {
      method: 'POST',
      body: JSON.stringify({ sql, format, includeHeaders }),
    });
  }
}

// 单例导出
export const api = new ApiClient();
```

---

## 第四部分：数据流与通信

### 4.1 前后端通信

#### API 端点完整列表

**数据库管理**

| 方法 | 路径 | 请求体 | 响应 | 说明 |
|------|------|--------|------|------|
| GET | `/api/v1/dbs` | - | `DatabaseListResponse` | 列出所有数据库 |
| PUT | `/api/v1/dbs/{name}` | `DatabaseCreateRequest` | `DatabaseDetail` | 创建数据库连接 |
| GET | `/api/v1/dbs/{name}` | - | `DatabaseDetail` | 获取数据库详情 |
| GET | `/api/v1/dbs/{name}?refresh=true` | - | `DatabaseDetail` | 强制刷新元数据 |
| PATCH | `/api/v1/dbs/{name}` | `DatabaseUpdateRequest` | `DatabaseDetail` | 更新数据库连接 |
| DELETE | `/api/v1/dbs/{name}` | - | - | 删除数据库连接 |
| GET | `/api/v1/dbs/{name}/metadata` | - | `MetadataResponse` | 获取元数据 |

**查询执行**

| 方法 | 路径 | 请求体 | 响应 | 速率限制 |
|------|------|--------|------|----------|
| POST | `/api/v1/dbs/{name}/query` | `QueryRequest` | `QueryResponse` | 30/分钟 |
| POST | `/api/v1/dbs/{name}/query/natural` | `NaturalQueryRequest` | `NaturalQueryResponse` | 10/分钟 |
| GET | `/api/v1/dbs/{name}/history` | - | `QueryHistoryResponse` | - |
| GET | `/api/v1/dbs/{name}/history?page=1&pageSize=20` | - | `QueryHistoryResponse` | - |
| DELETE | `/api/v1/dbs/{name}/history` | `{ ids: number[] }` | - | - |
| GET | `/api/v1/dbs/{name}/history/summary` | - | `{ total: number, success: number, failed: number }` | - |
| POST | `/api/v1/dbs/{name}/query/export` | `ExportRequest` | `ExportResponse` | 20/分钟 |
| GET | `/api/v1/dbs/{name}/suggested-queries?limit=6` | - | `string[]` | 10/分钟 |

**性能监控**

| 方法 | 路径 | 响应 | 说明 |
|------|------|------|------|
| GET | `/api/v1/performance` | `PerformanceMetrics` | HTTP 请求性能 |
| GET | `/api/v1/slow-queries` | `SlowQuery[]` | 慢查询记录 |
| GET | `/api/v1/query-performance?hours=24` | `QueryPerformanceStats` | 查询性能统计 |
| GET | `/api/v1/system` | `SystemMetrics` | 当前系统指标 |
| GET | `/api/v1/system/history?limit=100` | `SystemMetrics[]` | 系统指标历史 |
| GET | `/api/v1/health-detailed` | `HealthStatus` | 详细健康状态 |
| POST | `/api/v1/cleanup?days=30` | - | 清理旧指标 |
| GET | `/api/v1/thresholds` | `PerformanceThresholds` | 性能阈值配置 |

#### 请求/响应格式

**请求格式（JSON camelCase）**

```json
{
  "sql": "SELECT * FROM users LIMIT 10;",
  "prompt": "查询最近注册的 10 个用户",
  "format": "csv",
  "includeHeaders": true
}
```

**成功响应格式**

```json
{
  "success": true,
  "executedSql": "SELECT * FROM users LIMIT 10;",
  "rowCount": 10,
  "executionTimeMs": 45,
  "columns": [
    {
      "name": "id",
      "dataType": "INTEGER",
      "isNullable": false,
      "isPrimaryKey": true
    },
    {
      "name": "username",
      "dataType": "TEXT",
      "isNullable": false,
      "isPrimaryKey": false
    }
  ],
  "rows": [
    { "id": 1, "username": "alice" },
    { "id": 2, "username": "bob" }
  ],
  "hasLimit": true,
  "limitValue": 10
}
```

**错误响应格式**

```json
{
  "success": false,
  "error": {
    "code": "SQL_SYNTAX_ERROR",
    "message": "SQL 语法错误",
    "details": "unexpected token 'FROM' at line 1, position 10"
  }
}
```

#### 速率限制策略

```python
# 速率限制配置
RATE_LIMITS = {
    "query": "30/minute",       # SQL 查询
    "ai_query": "10/minute",    # AI 查询
    "export": "20/minute",      # 导出
    "suggested": "10/minute",   # 查询建议
}

# 响应头（超限时）
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1704067200
Retry-After: 60

{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "超过速率限制，请稍后再试",
    "details": "每分钟最多 30 次查询"
  }
}
```

### 4.2 数据库交互

#### 用户数据库连接流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant F as 前端
    participant A as FastAPI
    participant D as DatabaseService
    participant DB as 用户数据库

    U->>F: 1. 输入连接字符串
    F->>A: 2. PUT /api/v1/dbs/mydb
    A->>D: 3. create_database(name, url)
    D->>D: 4. 检测数据库类型
    D->>D: 5. 解析连接字符串
    D->>DB: 6. 测试连接
    DB-->>D: 7. 连接成功
    D->>D: 8. 保存到内部 SQLite
    D-->>A: 9. 返回 DatabaseDetail
    A-->>F: 10. JSON 响应
    F-->>U: 11. 显示成功
```

#### 内部 SQLite 使用

```mermaid
flowchart TD
    DB[(内部 SQLite)]

    DB --> T1[databases 表]
    DB --> T2[query_history 表]

    T1 --> T1F1[id, name, url, db_type]
    T1 --> T1F2[created_at, last_connected_at]
    T1 --> T1F3[metadata_json 缓存]

    T2 --> T2F1[id, database_id, query_type]
    T2 --> T2F2[input_text, executed_sql]
    T2 --> T2F3[row_count, execution_time_ms]
    T2 --> T2F4[status, error_message]
    T2 --> T2F5[created_at]

    style DB fill:#e1f5fe,stroke:#01579b,stroke-width:3px
    style T1 fill:#fff3e0
    style T2 fill:#f3e5f5
```

#### 连接池管理

```python
# 引擎缓存结构
_engines: dict[int, tuple[Engine, float]] = {}
# 格式: { db_id: (Engine, last_used_timestamp) }

def get_engine(self, db_id: int, url: str) -> Engine:
    """获取或创建引擎"""
    if db_id in self._engines:
        engine, last_used = self._engines[db_id]
        if time.time() - last_used < 3600:  # 1 小时内
            self._engines[db_id] = (engine, time.time())  # 更新时间
            return engine
        else:
            engine.dispose()  # 超时则释放
            del self._engines[db_id]

    # 创建新引擎
    engine = create_engine(url, pool_pre_ping=True)
    self._engines[db_id] = (engine, time.time())
    return engine
```

### 4.3 外部服务

#### 智谱 AI API 调用

```python
from zai import ZAI

class LLMService:
    def __init__(self) -> None:
        self.client = ZAI(api_key=get_config().zai_api_key)

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
    async def generate_sql(
        self,
        natural_query: str,
        tables: list[TableMetadata],
        views: list[ViewMetadata],
        db_type: str
    ) -> tuple[str, str | None]:
        """调用智谱 AI 生成 SQL"""
        prompt = self._build_prompt(natural_query, tables, views, db_type)

        try:
            response = self.client.chat.completions.create(
                model="glm-4-flash",
                messages=[
                    {"role": "system", "content": "你是 SQL 专家..."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=2000,
            )

            content = response.choices[0].message.content
            return self._parse_llm_response(content)

        except TimeoutError:
            raise TransientLLMError("请求超时")
        except ConnectionError:
            raise TransientLLMError("连接失败")
        except RateLimitError:
            raise TransientLLMError("超过速率限制")
```

#### 重试机制

```python
@retry(
    stop=stop_after_attempt(3),              # 最多 3 次
    wait=wait_exponential(
        multiplier=1,                        # 1s, 2s, 4s, 8s...
        min=2,                               # 最小 2 秒
        max=10                               # 最大 10 秒
    ),
    retry=retry_if_exception_type(TransientLLMError),
    before_sleep=lambda retry_state: logger.info(
        "retrying_llm",
        attempt=retry_state.attempt_number,
        wait_time=retry_state.next_action.sleep
    )
)
async def generate_sql(...) -> tuple[str, str | None]:
    # ...
```

**重试策略表**

| 尝试 | 等待时间 | 条件 |
|------|----------|------|
| 1 | 0 秒 | 首次尝试 |
| 2 | 2 秒 | 瞬态错误后 |
| 3 | 4 秒 | 再次瞬态错误 |
| - | 放弃 | 3 次后或持久错误 |

---

## 第五部分：安全设计

### 5.1 后端安全

#### SQL 注入防护

**多层防御策略**

```python
# 1. 标识符验证
def _validate_identifier(self, identifier: str) -> None:
    """验证 SQL 标识符"""
    if not re.match(r'^[a-zA-Z0-9_\.$]+$', identifier):
        raise SQLValidationError(f"无效标识符: {identifier}")

# 2. 只允许 SELECT
def validate_select_only(self, sql: str) -> None:
    """验证是否为 SELECT"""
    ast = self.parse(sql)
    if not isinstance(ast, exp.Select):
        raise SQLValidationError("只允许 SELECT 查询")

# 3. 参数化查询（实际执行时）
async def _execute_with_engine(
    self,
    engine: Engine,
    sql: str
) -> tuple[list[dict], list[ColumnMetadata]]:
    async with engine.connect() as conn:
        result = await conn.execute(text(sql))
        # SQLAlchemy 自动处理参数化
```

**安全检查清单**

| 检查项 | 实现方式 |
|--------|----------|
| 标识符过滤 | 正则验证 `^[a-zA-Z0-9_\.$]+$` |
| 查询类型限制 | sqlglot AST 检查 `isinstance(ast, exp.Select)` |
| 关键词黑名单 | 自动拒绝 INSERT/UPDATE/DELETE/DROP 等 |
| LIMIT 保护 | 自动添加 LIMIT 1000 |
| 超时保护 | 30 秒查询超时 |

#### 只读查询限制

```python
# SQLParser 验证
class SQLParser:
    def validate_select_only(self, sql: str) -> None:
        """只允许 SELECT 查询"""
        ast = self.parse(sql)

        # 检查是否为 SELECT
        if not isinstance(ast, exp.Select):
            raise SQLValidationError(
                f"不允许的查询类型: {type(ast).__name__}。只允许 SELECT 查询。"
            )

        # 检查是否有子查询非法操作
        for sub_query in ast.find_all(exp.Select):
            # 递归检查所有子查询
            pass
```

#### 速率限制

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# 应用到路由
@router.post(
    "/query",
    dependencies=[Depends(limiter.limit("30/minute"))]
)
async def execute_query(...):
    pass

@router.post(
    "/query/natural",
    dependencies=[Depends(limiter.limit("10/minute"))]
)
async def natural_query(...):
    pass
```

**限制策略表**

| 端点 | 限制 | 理由 |
|------|------|------|
| `/query` | 30/分钟 | 防止频繁查询 |
| `/query/natural` | 10/分钟 | AI 调用成本高 |
| `/query/export` | 20/分钟 | 防止大量导出 |
| `/suggested-queries` | 10/分钟 | AI 调用成本高 |

#### 密码脱敏

```python
def _mask_password(self, url: str) -> str:
    """隐藏连接字符串中的密码"""
    import re

    # 匹配 user:password@host
    pattern = r'://([^:]+):([^@]+)@'
    masked = re.sub(pattern, r'://\1:****@', url)
    return masked

# 在 API 响应中应用
class DatabaseConnection(CamelModel):
    url: str  # 已脱敏

    @field_serializer('url')
    def serialize_url(self, value: str) -> str:
        return _mask_password(value)
```

#### CORS 配置

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # 开发环境
        "https://your-domain.com",  # 生产环境
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "PUT"],
    allow_headers=["Content-Type", "Authorization"],
)
```

### 5.2 前端安全

#### React XSS 防护

```typescript
// React 自动转义 JSX 中的内容
function QueryResults({ result }: { result: QueryResponse }) {
  return (
    <Table
      columns={result.columns.map(col => ({
        title: col.name,  // 自动转义
        dataIndex: col.name,
        render: (value: any) => {
          // 危险：如果直接渲染 HTML
          // return <div dangerouslySetInnerHTML={{ __html: value }} />;  // ❌

          // 安全：React 自动转义
          return String(value);  // ✅
        },
      }))}
      dataSource={result.rows}
    />
  );
}
```

#### 输入验证

```typescript
// 前端验证示例
function AddDatabaseForm() {
  const [form] = Form.useForm();

  const validateUrl = (_: Rule, value: string) => {
    if (!value) return Promise.reject('请输入连接字符串');

    // 格式验证
    const validPrefixes = ['postgresql://', 'mysql://', 'sqlite://'];
    const isValid = validPrefixes.some(prefix => value.startsWith(prefix));

    if (!isValid) {
      return Promise.reject('连接字符串格式无效');
    }

    return Promise.resolve();
  };

  return (
    <Form form={form}>
      <Form.Item
        name="url"
        rules={[{ validator: validateUrl }]}
      >
        <Input placeholder="postgresql://user:pass@host:5432/db" />
      </Form.Item>
    </Form>
  );
}
```

---

## 第六部分：性能优化

### 6.1 后端优化

#### 连接池缓存

```python
# 引擎缓存实现
class DatabaseService:
    _engines: ClassVar[dict[int, tuple[Engine, float]]] = {}

    def get_engine(self, db_id: int, url: str) -> Engine:
        """LRU 缓存策略"""
        now = time.time()

        if db_id in self._engines:
            engine, last_used = self._engines[db_id]
            if now - last_used < 3600:  # 1 小时 TTL
                self._engines[db_id] = (engine, now)
                return engine

        # 创建新引擎（带连接池配置）
        engine = create_engine(
            url,
            pool_size=5,              # 连接池大小
            max_overflow=10,          # 最大溢出
            pool_timeout=30,          # 获取连接超时
            pool_recycle=3600,        # 连接回收时间
            pool_pre_ping=True,       # 连接前检查
        )
        self._engines[db_id] = (engine, now)
        return engine
```

#### 元数据缓存

```python
class MetadataService:
    _cache: ClassVar[dict[int, tuple[MetadataResponse, float]]] = {}

    async def fetch_metadata(
        self,
        database: DatabaseDetail,
        engine: Engine,
        force_refresh: bool = False
    ) -> MetadataResponse:
        """带 TTL 的缓存"""
        now = time.time()
        cache_ttl = constants.Metadata.CACHE_TTL.total_seconds()

        # 检查缓存
        if not force_refresh and database.id in self._cache:
            cached, timestamp = self._cache[database.id]
            if now - timestamp < cache_ttl:
                return cached

        # 获取新数据
        tables = await self._fetch_tables(engine, database.db_type)
        views = await self._fetch_views(engine, database.db_type)

        response = MetadataResponse(
            databaseName=database.name,
            dbType=database.dbType,
            tables=tables,
            views=views,
            updatedAt=datetime.now().isoformat()
        )

        # 更新缓存
        self._cache[database.id] = (response, now)
        return response
```

#### 批量查询优化

```python
async def _fetch_all_columns(
    self,
    conn: Any,
    table_list: list[tuple[str, str | None]],
    db_type: str
) -> dict[tuple[str, str], list[ColumnMetadata]]:
    """批量获取所有表的列信息（避免 N+1 查询）"""

    if db_type == "postgresql":
        # 单次查询获取所有列
        query = text("""
            SELECT
                table_schema,
                table_name,
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_schema = ANY(:schemas)
            ORDER BY table_schema, table_name, ordinal_position
        """)
        schemas = list({schema for _, schema in table_list if schema})
        result = await conn.execute(query, {"schemas": schemas})

    # 解析结果并按表分组
    columns_by_table: dict[tuple[str, str], list[ColumnMetadata]] = {}
    for row in result:
        key = (row.table_name, row.table_schema)
        if key not in columns_by_table:
            columns_by_table[key] = []
        columns_by_table[key].append(ColumnMetadata(...))

    return columns_by_table
```

### 6.2 前端优化

#### React Query 缓存

```typescript
// 缓存配置策略
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // 5 分钟内数据视为新鲜
      gcTime: 10 * 60 * 1000,       // 10 分钟后垃圾回收
      refetchOnWindowFocus: false,  // 窗口聚焦不刷新
      retry: 1,                     // 失败重试 1 次
    },
  },
});

// 特定查询覆盖默认配置
useQuery({
  queryKey: ['databases'],
  queryFn: fetchDatabases,
  staleTime: 2 * 60 * 1000,  // 数据库列表 2 分钟
});

useQuery({
  queryKey: ['metadata', databaseName],
  queryFn: fetchMetadata,
  staleTime: 10 * 60 * 1000,  // 元数据 10 分钟
});
```

#### 代码分割

```typescript
// 使用 React.lazy 懒加载组件
const PerformanceDashboard = lazy(() =>
  import('./components/performance/PerformanceDashboard')
);

// 在路由中使用
<Suspense fallback={<Spin size="large" />}>
  <Routes>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/performance" element={<PerformanceDashboard />} />
  </Routes>
</Suspense>
```

#### 虚拟滚动

```typescript
import { List } from 'react-virtualized';

function LargeResultTable({ rows }: { rows: any[] }) {
  const rowRenderer = ({ index, key, style }: any) => (
    <div key={key} style={style}>
      {rows[index].name}
    </div>
  );

  return (
    <List
      width={800}
      height={400}
      rowCount={rows.length}
      rowHeight={35}
      rowRenderer={rowRenderer}
    />
  );
}
```

---

## 第七部分：部署与运维

### 7.1 环境配置

#### 环境变量列表

| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `ZAI_API_KEY` | ✅ | - | 智谱 AI API 密钥 |
| `DB_PATH` | ❌ | `~/.db_query/db_query.db` | 内部 SQLite 路径 |
| `LOG_LEVEL` | ❌ | `INFO` | 日志级别 |
| `JSON_LOGS` | ❌ | `false` | JSON 格式日志 |
| `LOG_FILE` | ❌ | `null` | 日志文件路径 |
| `CORS_ORIGINS` | ❌ | `["*"]` | CORS 允许的源 |
| `MAX_REQUEST_SIZE` | ❌ | `1048576` | 最大请求大小（字节） |

#### 配置文件示例

**后端 `.env`**

```bash
# 必需配置
ZAI_API_KEY=your_zai_api_key_here

# 可选配置
DB_PATH=./data/db_query.db
LOG_LEVEL=INFO
JSON_LOGS=true
LOG_FILE=logs/app.log
CORS_ORIGINS=["http://localhost:5173","https://your-domain.com"]
MAX_REQUEST_SIZE=1048576
```

**前端 `.env.development`**

```bash
VITE_API_URL=http://localhost:8000
```

**前端 `.env.production`**

```bash
VITE_API_URL=https://api.your-domain.com
```

### 7.2 运行命令

#### Makefile 命令

```makefile
.PHONY: dev backend-run frontend-run stop install lint format test clean

# 同时启动前后端
dev:
	@make -j2 backend-run frontend-run

# 后端开发服务器
backend-run:
	cd backend && uv run uvicorn src.api.main:app --reload --port 8000

# 前端开发服务器
frontend-run:
	cd frontend && npm run dev

# 停止所有服务
stop:
	@pkill -f "uvicorn" || true
	@pkill -f "vite" || true

# 安装所有依赖
install:
	cd backend && uv sync
	cd frontend && npm install

# 代码检查
lint:
	cd backend && uv run ruff check src
	cd frontend && npm run type-check

# 代码格式化
format:
	cd backend && uv run ruff format src
	cd frontend && npm run format

# 运行测试
test:
	cd backend && uv run pytest
```

#### 开发/生产环境差异

| 特性 | 开发环境 | 生产环境 |
|------|----------|----------|
| 后端服务器 | uvicorn --reload | gunicorn + uvicorn |
| 前端构建 | Vite dev server | 静态文件 + Nginx |
| 日志级别 | DEBUG | INFO |
| 源映射 | 启用 | 禁用 |
| CORS | 允许 localhost | 特定域名 |
| 热重载 | 启用 | 禁用 |

### 7.3 监控与日志

#### 结构化日志

```python
# 日志配置
import structlog

logger = structlog.get_logger()

# 使用示例
logger.info(
    "query_executed",
    database_name="mydb",
    query_type="sql",
    row_count=100,
    execution_time_ms=45,
    status="success"
)

# 输出（JSON 格式）
{
  "event": "query_executed",
  "database_name": "mydb",
  "query_type": "sql",
  "row_count": 100,
  "execution_time_ms": 45,
  "status": "success",
  "timestamp": "2025-01-17T10:30:00Z",
  "level": "info",
  "logger": "src.services.query_service"
}
```

#### 性能监控

```python
# 慢查询记录
await metrics_service.record_slow_query(
    database_name="mydb",
    query_type="sql",
    sql="SELECT * FROM large_table;",
    execution_time_ms=3500,
    row_count=50000
)

# 查询性能统计
stats = await metrics_service.get_query_performance_stats(
    database_name="mydb",
    hours=24
)

# 返回
{
  "totalQueries": 1250,
  "successfulQueries": 1200,
  "failedQueries": 50,
  "successRate": 0.96,
  "averageExecutionTimeMs": 245,
  "slowQueries": 25,
  "slowQueryRate": 0.02
}
```

#### 健康检查

```python
# 简单健康检查
GET /health
{
  "status": "healthy",
  "timestamp": "2025-01-17T10:30:00Z"
}

# 详细健康检查
GET /api/v1/health-detailed
{
  "status": "healthy",
  "timestamp": "2025-01-17T10:30:00Z",
  "system": {
    "cpuPercent": 45.2,
    "memoryPercent": 68.5,
    "diskPercent": 72.1
  },
  "issues": [],
  "warnings": [
    "Memory usage is above 60%"
  ]
}
```

---

## 第八部分：扩展与维护

### 8.1 代码规范

#### Python 代码风格（Ruff + mypy）

**配置文件**

```toml
[tool.ruff]
line-length = 100
target-version = "py314"

[tool.ruff.lint]
select = [
  "E",   # pycodestyle errors
  "W",   # pycodestyle warnings
  "F",   # pyflakes
  "I",   # isort
  "B",   # flake8-bugbear
  "C4",  # flake8-comprehensions
  "UP",  # pyupgrade
  "ARG", # flake8-unused-arguments
]
ignore = []

[tool.mypy]
python_version = "3.14"
strict = true
warn_return_any = true
warn_unused_ignores = true
```

**代码示例**

```python
# 类型注解完整
async def execute_query(
    database: DatabaseDetail,
    engine: Engine,
    sql: str,
    timeout: int = 30,
    query_type: str = "sql",
    input_text: str | None = None,
) -> QueryResponse:
    """执行 SQL 查询。

    Args:
        database: 数据库详情
        engine: SQLAlchemy 引擎
        sql: SQL 查询语句
        timeout: 查询超时时间（秒）
        query_type: 查询类型（sql/natural）
        input_text: 用户输入（自然语言查询时）

    Returns:
        QueryResponse: 查询结果

    Raises:
        QueryExecutionError: 查询执行失败
        QueryTimeoutError: 查询超时
    """
    ...
```

#### TypeScript 代码风格（ESLint + Prettier）

**配置文件**

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true
  },
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/no-explicit-any": "error"
  }
}
```

**代码示例**

```typescript
// 类型完整
interface QueryResult {
  readonly success: boolean;
  readonly executedSql: string;
  readonly rowCount: number;
  readonly executionTimeMs: number;
  readonly columns: readonly ColumnMetadata[];
  readonly rows: readonly Record<string, unknown>[];
}

// 组件类型
interface SqlEditorProps {
  readonly sql: string;
  readonly onChange: (value: string) => void;
  readonly onExecute: () => void;
  readonly result: QueryResult | null;
}

export function SqlEditor({ sql, onChange, onExecute, result }: SqlEditorProps) {
  // ...
}
```

### 8.2 测试策略

#### 后端测试结构

```
tests/
├── conftest.py              # 测试配置
├── test_utils.py            # 测试工具
├── api/                     # API 测试
│   ├── test_databases.py
│   ├── test_queries.py
│   └── test_metrics.py
├── services/                # 服务测试
│   ├── test_db_service.py
│   ├── test_query_service.py
│   ├── test_llm_service.py
│   └── test_metadata_service.py
└── core/                    # 核心测试
    ├── test_sql_parser.py
    └── test_constants.py
```

**测试示例**

```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_database(client: AsyncClient):
    response = await client.put(
        "/api/v1/dbs/testdb",
        json={"name": "testdb", "url": "sqlite:///test.db"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "testdb"
    assert data["dbType"] == "sqlite"

@pytest.mark.asyncio
async def test_sql_select_only(client: AsyncClient):
    response = await client.post(
        "/api/v1/dbs/testdb/query",
        json={"sql": "DROP TABLE users;"}
    )
    assert response.status_code == 400
    assert "只允许 SELECT" in response.json()["detail"]["message"]
```

#### 前端测试结构

```
frontend/
├── src/
│   └── __tests__/
│       ├── components/      # 组件测试
│       │   ├── SqlEditor.test.tsx
│       │   └── QueryResults.test.tsx
│       ├── hooks/           # Hook 测试
│       │   ├── useDatabases.test.ts
│       │   └── useQueryExecution.test.ts
│       └── services/        # API 测试
│           └── api.test.ts
```

**测试示例**

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useDatabases } from './useDatabases';

describe('useDatabases', () => {
  it('should fetch databases on mount', async () => {
    const { result } = renderHook(() => useDatabases());

    await waitFor(() => {
      expect(result.current.databases).toBeDefined();
      expect(result.current.databases.length).toBeGreaterThan(0);
    });
  });

  it('should create database', async () => {
    const { result } = renderHook(() => useDatabases());

    await act(async () => {
      await result.current.createDatabase({
        name: 'testdb',
        url: 'sqlite:///test.db',
      });
    });

    expect(result.current.databases).toContainEqual(
      expect.objectContaining({ name: 'testdb' })
    );
  });
});
```

### 8.3 扩展建议

#### 新增数据库类型支持

```python
# 1. 在 constants.py 添加类型
class DatabaseType(str, Enum):
    MYSQL = "mysql"
    POSTGRESQL = "postgresql"
    SQLITE = "sqlite"
    # 新增
    MARIADB = "mariadb"
    SNOWFLAKE = "snowflake"

# 2. 在 db_service.py 添加驱动检测
SUPPORTED_DRIVERS = {
    "postgresql": "postgresql+psycopg2://",
    "mysql": "mysql+pymysql://",
    "sqlite": "sqlite://",
    "mariadb": "mariadb+pymysql://",
    "snowflake": "snowflake://",
}

# 3. 更新 SQLParser 方言支持
SUPPORTED_DIALECTS = {
    "mysql": "mysql",
    "postgresql": "postgres",
    "sqlite": "sqlite",
    "mariadb": "mysql",
    "snowflake": "snowflake",
}
```

#### 新增查询功能

```python
# 示例：添加 EXPLAIN 功能
@router.post("/api/v1/dbs/{name}/explain")
async def explain_query(
    name: str,
    request: QueryRequest,
    db_service: DatabaseService = Depends(get_db_service)
) -> ExplainResponse:
    """分析查询执行计划"""
    database = await db_service.get_database_by_name(name)
    engine = db_service.get_engine(database.id, database.url)

    explain_sql = f"EXPLAIN {request.sql}"
    result = await execute_query_raw(engine, explain_sql)

    return ExplainResponse(
        plan=result.rows,
        analyzed=True
    )
```

#### 性能优化方向

| 优化项 | 当前状态 | 改进方向 |
|--------|----------|----------|
| 查询结果序列化 | 逐行转换 | 批量处理、使用或 Pandas |
| 元数据缓存 | 单机内存 | Redis 分布式缓存 |
| 前端渲染 | 全量渲染 | 虚拟滚动、分页加载 |
| AI 响应速度 | 3-5 秒 | 本地模型缓存、流式响应 |

---

## 附录

### 快速参考

#### 常用命令

```bash
# 安装依赖
make install

# 启动开发服务器
make dev

# 代码检查
make lint

# 运行测试
make test

# 停止服务
make stop
```

#### 目录结构

```
db_query/
├── backend/               # 后端代码
│   ├── src/
│   │   ├── api/          # API 层
│   │   ├── services/     # 服务层
│   │   ├── models/       # 数据模型
│   │   ├── core/         # 核心模块
│   │   └── middleware/   # 中间件
│   ├── tests/            # 测试
│   └── pyproject.toml
├── frontend/             # 前端代码
│   ├── src/
│   │   ├── pages/        # 页面
│   │   ├── components/   # 组件
│   │   ├── hooks/        # Hooks
│   │   └── services/     # API 客户端
│   └── package.json
└── README.md             # 本文档
```

#### 相关文档

- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [React Query 文档](https://tanstack.com/query/latest)
- [sqlglot 文档](https://github.com/tobymao/sqlglot)
- [智谱 AI 文档](https://open.bigmodel.cn/)

---

**文档版本**: 1.0.0
**最后更新**: 2025-01-17
**维护者**: 开发团队
