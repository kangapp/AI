# 数据库查询工具 (DB Query Tool)

> 一个基于 AI 的智能数据库查询工具，支持自然语言转 SQL、多数据库连接、查询历史管理等功能。

## 目录

- [项目概述](#项目概述)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [技术栈](#技术栈)
- [系统架构](#系统架构)
- [性能监控模块](#性能监控模块)
- [测试模块](#测试模块)
- [技术要点](#技术要点)
- [核心功能实现](#核心功能实现)
- [完整调用链路详解](#完整调用链路详解)
- [开发指南](#开发指南)
- [API 文档](#api-文档)
- [Hooks 机制详解](#hooks-机制详解)
- [常见问题](#常见问题)
- [许可证](#许可证)

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
- **性能监控**：实时系统指标监控（CPU、内存、磁盘）、慢查询跟踪、HTTP 请求性能分析
- **Web 性能监控**：Core Web Vitals 收集（LCP、FID、CLS、FCP）、性能评分和评级
- **连接池管理**：自动管理数据库连接，空闲超时清理
- **速率限制**：API 级别速率限制，防止滥用
- **结构化日志**：JSON 格式日志，便于分析和监控
- **完整测试覆盖**：单元测试、集成测试、性能测试、E2E 测试

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
│   │   │       ├── queries.py       # 查询执行端点
│   │   │       └── metrics.py       # 性能监控端点
│   │   ├── core/                    # 核心模块
│   │   │   ├── config.py            # 配置管理
│   │   │   ├── constants.py         # 常量定义（含性能阈值）
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
│   │   │   ├── metadata_service.py  # 元数据服务
│   │   │   └── metrics_service.py   # 性能监控服务
│   │   ├── lib/                     # 工具库
│   │   │   └── json_encoder.py      # 驼峰命名编码器
│   │   └── middleware/              # 中间件
│   │       ├── rate_limit.py        # 速率限制
│   │       └── performance.py       # 性能监控中间件
│   ├── tests/                       # 测试目录
│   │   ├── api/                     # API 测试
│   │   │   ├── test_dependencies.py
│   │   │   └── test_errors.py
│   │   ├── services/                # 服务测试
│   │   │   ├── test_services_basic.py
│   │   │   ├── test_query_service_simple.py
│   │   │   ├── test_database_service_simple.py
│   │   │   └── test_metadata_service.py
│   │   ├── conftest.py              # Pytest 配置
│   │   └── test_utils.py            # 测试工具
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
│   │   │       ├── hooks/
│   │   │       │   ├── useDatabases.ts    # 数据库 Hook
│   │   │       │   ├── useMetadata.ts     # 元数据 Hook
│   │   │       │   ├── useQueryExecution.ts # 查询执行 Hook
│   │   │       │   └── usePerformance.ts  # 性能监控 Hook
│   │   │       ├── Dashboard.tsx     # 仪表板组件
│   │   │       ├── DatabaseList.tsx # 数据库列表
│   │   │       └── QueryTabs.tsx    # 查询标签页
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
│   │   │   ├── performance/         # 性能监控组件
│   │   │   │   ├── PerformanceDashboard.tsx # 性能仪表盘
│   │   │   │   └── PerformanceMonitor.tsx   # Web 性能监控
│   │   │   └── shared/              # 共享组件
│   │   │       ├── SchemaTree.tsx
│   │   │       └── ErrorBoundary.tsx
│   │   ├── hooks/                   # 自定义 Hooks
│   │   │   ├── useDatabaseQuery.ts
│   │   │   └── useTreeData.tsx
│   │   ├── services/                # API 服务
│   │   │   ├── api.ts               # 主 API 客户端
│   │   │   └── performanceApi.ts    # 性能监控 API
│   │   ├── utils/                   # 工具函数
│   │   │   └── performance.ts       # Web 性能监控工具
│   │   ├── types/                   # 类型定义
│   │   │   └── index.ts
│   │   ├── App.tsx                  # 应用根组件
│   │   └── main.tsx                 # 应用入口
│   ├── tests/                       # 前端测试
│   │   └── performance.spec.ts      # 性能测试
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
| psutil | 6.1.0+ | 系统指标收集 |
| pytest | 8.3.0+ | 测试框架 |

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
| web-vitals | 5.1.0+ | Web 性能监控 |
| @playwright/test | 1.57.0+ | E2E 测试 |

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

## 性能监控模块

### 后端性能监控

#### MetricsService - 核心指标服务

**路径**: `backend/src/services/metrics_service.py`

**主要功能**:
- **系统指标收集**: CPU、内存、磁盘、进程资源监控
- **慢查询监控**: 自动记录执行时间超过阈值的查询
- **查询性能统计**: 按数据库和时间范围统计查询性能
- **健康状态检查**: 综合评估系统健康状况
- **历史数据清理**: 自动清理过期的监控数据

**关键方法**:
```python
class MetricsService:
    async def start_collection(self) -> None
    async def stop_collection(self) -> None
    async def record_slow_query(
        database_name: str,
        sql: str,
        execution_time_ms: int,
        row_count: int
    ) -> None
    async def get_slow_queries(
        min_execution_time_ms: int = 1000,
        limit: int = 100
    ) -> List[SlowQueryRecord]
    async def get_query_performance_stats(
        database_name: str | None = None,
        hours: int = 24
    ) -> QueryPerformanceStats
    async def get_current_system_metrics(self) -> SystemMetrics
    async def get_system_metrics(self, limit: int = 100) -> List[SystemMetrics]
    async def get_health_status(self) -> HealthStatus
    async def cleanup_old_metrics(self, days: int = 30) -> int
```

**性能阈值配置** (`backend/src/core/constants.py`):
```python
class Performance:
    # 慢查询阈值（毫秒）
    SLOW_QUERY_THRESHOLD = 1000  # 1秒
    VERY_SLOW_QUERY_THRESHOLD = 5000  # 5秒
    CRITICAL_SLOW_QUERY_THRESHOLD = 10000  # 10秒

    # 请求性能阈值（毫秒）
    FAST_REQUEST_THRESHOLD = 100  # <100ms为快速
    NORMAL_REQUEST_THRESHOLD = 500  # <500ms为正常
    SLOW_REQUEST_THRESHOLD = 1000  # >=1s为慢

    # 内存监控
    MEMORY_WARNING_THRESHOLD = 80  # 80%内存使用警告
    MEMORY_CRITICAL_THRESHOLD = 90  # 90%内存使用危急

    # 性能指标保留
    METRICS_RETENTION_DAYS = 30  # 保留30天
    PERFORMANCE_HISTORY_LIMIT = 1000  # 内存中最多保留1000条记录

    # 告警阈值
    HIGH_ERROR_RATE_THRESHOLD = 0.05  # 5%错误率
    HIGH_LATENCY_P95_THRESHOLD = 2000  # P95延迟>2秒

    # 监控间隔
    SYSTEM_METRICS_INTERVAL = 60  # 每60秒收集系统指标
    PERFORMANCE_STATS_INTERVAL = 300  # 每5分钟计算性能统计
```

#### PerformanceMiddleware - HTTP 请求性能监控

**路径**: `backend/src/middleware/performance.py`

**主要功能**:
- 跟踪所有 HTTP 请求的性能指标
- 记录请求延迟、状态码、路径
- 计算百分位数（P50、P95、P99）
- 识别慢请求

**跟踪的指标**:
- 总请求数
- 按路径统计的请求
- 按方法统计的请求
- 按状态码统计的请求
- 延迟百分位数（P50、P95、P99）
- 平均延迟
- 最近 100 条请求历史

#### 性能监控 API 端点

**路径**: `backend/src/api/v1/metrics.py`

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/v1/metrics/performance` | GET | 获取 HTTP 请求性能指标 |
| `/api/v1/metrics/slow-queries` | GET | 获取慢查询列表 |
| `/api/v1/metrics/query-performance` | GET | 获取查询性能统计 |
| `/api/v1/metrics/system` | GET | 获取当前系统指标 |
| `/api/v1/metrics/system/history` | GET | 获取历史系统指标 |
| `/api/v1/metrics/health-detailed` | GET | 获取详细健康状态 |
| `/api/v1/metrics/cleanup` | POST | 清理历史指标数据 |
| `/api/v1/metrics/thresholds` | GET | 获取性能阈值配置 |

### 前端性能监控

#### Web 性能监控工具

**路径**: `frontend/src/utils/performance.ts`

**主要功能**:
- 使用 `web-vitals` 库收集核心 Web 指标
- 计算性能评分和评级
- 提供性能指标回调机制

**收集的指标**:
- **LCP** (Largest Contentful Paint) - 最大内容绘制
- **FID** (First Input Delay) - 首次输入延迟
- **CLS** (Cumulative Layout Shift) - 累积布局偏移
- **FCP** (First Contentful Paint) - 首次内容绘制
- **TTFB** (Time to First Byte) - 首字节时间
- 页面加载时间
- DOM 内容加载完成时间
- 内存使用情况

**性能评分**:
- 总分范围：0-100 分
- 评级：优秀（90+）、良好（75-89）、一般（60-74）、较差（<60）

#### 性能监控 API 客户端

**路径**: `frontend/src/services/performanceApi.ts`

**TypeScript 类型定义**:
```typescript
interface SystemMetrics {
  cpuPercent: number;
  memory: MemoryMetrics;
  disk: DiskMetrics;
  process: ProcessMetrics;
  timestamp: string;
}

interface SlowQuery {
  id: number;
  databaseName: string;
  sql: string;
  executionTimeMs: number;
  rowCount: number;
  createdAt: string;
}

interface QueryPerformanceStats {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  successRate: number;
  avgExecutionTimeMs: number;
  slowQueries: number;
  verySlowQueries: number;
  criticalSlowQueries: number;
}

interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
  systemMetrics: SystemMetrics;
  slowQueriesCount: number;
  timestamp: string;
}
```

**API 方法**:
- `getSystemMetrics()` - 获取当前系统指标
- `getSystemMetricsHistory(limit)` - 获取系统指标历史
- `getSlowQueries(params)` - 获取慢查询列表
- `getQueryPerformanceStats(params)` - 获取查询性能统计
- `getHealthDetailed()` - 获取详细健康状态
- `getPerformanceThresholds()` - 获取性能阈值配置
- `getPerformanceMetrics()` - 获取 HTTP 请求性能统计
- `cleanupMetrics(days)` - 清理历史数据

#### 性能监控 React Hooks

**路径**: `frontend/src/pages/Dashboard/hooks/usePerformance.ts`

**自定义 Hooks**:
```typescript
// 获取系统指标（默认5秒刷新）
const { data: systemMetrics, isLoading } = useSystemMetrics(refetchInterval);

// 获取系统指标历史（默认30秒刷新）
const { data: history } = useSystemMetricsHistory(limit);

// 获取慢查询列表（默认10秒刷新）
const { data: slowQueries } = useSlowQueries(params, refetchInterval);

// 获取查询性能统计（默认15秒刷新）
const { data: stats } = useQueryPerformanceStats(params, refetchInterval);

// 获取健康状态（默认10秒刷新）
const { data: health } = useHealthDetailed(refetchInterval);

// 获取性能阈值配置
const { data: thresholds } = usePerformanceThresholds();

// 获取HTTP请求性能统计（默认5秒刷新）
const { data: perfMetrics } = usePerformanceMetrics(refetchInterval);

// 清理历史数据（mutation）
const cleanupMutation = useCleanupMetrics();

// 组合hook，获取所有性能监控数据
const { systemMetrics, slowQueries, stats, health } = usePerformanceDashboard();
```

#### 性能监控组件

**PerformanceDashboard** - 性能仪表盘

**路径**: `frontend/src/components/performance/PerformanceDashboard.tsx`

**组件结构**:
- 头部状态栏（显示健康状态标签）
- 系统资源指标卡片（CPU、内存、磁盘、进程内存）
- 查询性能统计卡片（总查询数、成功率、平均执行时间、慢查询数）
- 慢查询记录列表
- 性能阈值配置说明

**PerformanceMonitor** - Web 性能监控

**路径**: `frontend/src/components/performance/PerformanceMonitor.tsx`

**组件结构**:
- 性能评分总分（0-100 分）
- Core Web Vitals 指标卡片（LCP、FID、CLS、FCP）
- 其他性能指标（TTFB、页面加载时间、DOM 加载完成、内存使用）
- 系统资源指标（CPU、内存、磁盘）
- 性能指标说明

### 性能监控数据流

```mermaid
sequenceDiagram
    participant User as 用户
    participant Dashboard as 性能仪表盘
    participant API as 性能API
    participant Metrics as MetricsService
    participant System as 系统资源
    participant DB as 应用数据库

    User->>Dashboard: 访问性能监控页面
    Dashboard->>API: GET /metrics/system
    API->>Metrics: get_current_system_metrics()
    Metrics->>System: 读取 CPU、内存、磁盘
    System-->>Metrics: 系统指标
    Metrics-->>API: SystemMetrics
    API-->>Dashboard: 实时系统指标

    Dashboard->>API: GET /metrics/slow-queries
    API->>Metrics: get_slow_queries()
    Metrics->>DB: 查询慢查询记录
    DB-->>Metrics: 慢查询列表
    Metrics-->>API: SlowQuery[]
    API-->>Dashboard: 慢查询数据

    Dashboard->>API: GET /metrics/query-performance
    API->>Metrics: get_query_performance_stats()
    Metrics->>DB: 统计查询性能
    DB-->>Metrics: 性能统计数据
    Metrics-->>API: QueryPerformanceStats
    API-->>Dashboard: 查询性能统计

    Dashboard->>API: GET /metrics/health-detailed
    API->>Metrics: get_health_status()
    Metrics->>Metrics: 评估系统健康状态
    Metrics-->>API: HealthStatus
    API-->>Dashboard: 健康状态
```

---

## 测试模块

### 后端测试

#### 测试目录结构

```
backend/tests/
├── api/                              # API 测试
│   ├── test_dependencies.py          # 依赖注入测试
│   └── test_errors.py                # 错误处理测试
├── services/                         # 服务测试
│   ├── test_services_basic.py        # 基础服务测试
│   ├── test_query_service_simple.py  # 查询服务测试
│   ├── test_database_service_simple.py # 数据库服务测试
│   └── test_metadata_service.py      # 元数据服务测试
├── conftest.py                       # Pytest 配置和 Fixtures
└── test_utils.py                     # 测试辅助工具
```

#### Pytest 配置

**路径**: `backend/tests/conftest.py`

**Fixtures**:
- `temp_db_path` - 临时数据库文件路径
- `mock_engine` - 模拟 SQLAlchemy 引擎
- `mock_database` - 模拟数据库对象
- `initialize_test_db` - 初始化应用数据库（自动使用）
- `reset_database` - 测试间重置数据库
- `mock_llm_response` - 模拟 LLM 响应
- `sample_query_response` - 示例查询响应
- `sample_metadata` - 示例元数据

**环境变量设置**:
```python
import os
os.environ["ZAI_API_KEY"] = "test_api_key"
os.environ["LOG_LEVEL"] = "WARNING"
```

#### 测试辅助工具

**路径**: `backend/tests/test_utils.py`

**辅助类**:
```python
class DatabaseTestHelper:
    @staticmethod
    def create_in_memory_database() -> aiosqlite.Connection
    @staticmethod
    def create_sample_query_result() -> List[Dict[str, Any]]

class APITestHelper:
    @staticmethod
    def create_mock_request(
        method: str = "GET",
        path: str = "/",
        headers: dict = None
    ) -> Request
    @staticmethod
    def assert_error_response(
        response: Response,
        expected_code: str,
        expected_status: int
    ) -> None

class DateTimeTestHelper:
    @staticmethod
    def assert_datetime_close(
        actual: datetime,
        expected: datetime,
        delta_seconds: int = 1
    ) -> None
```

#### 测试用例示例

**API 测试** (`test_dependencies.py`):
```python
async def test_get_db_service():
    service = get_db_service()
    assert isinstance(service, DatabaseService)

async def test_get_query_service():
    service = get_query_service()
    assert isinstance(service, QueryService)
```

**服务测试** (`test_metadata_service.py`):
```python
async def test_validate_identifier_valid():
    result = MetadataService._validate_identifier("valid_name")
    assert result == "valid_name"

async def test_validate_identifier_invalid():
    with pytest.raises(ValueError):
        MetadataService._validate_identifier("123_invalid")

async def test_fetch_metadata_with_cache(
    mock_engine,
    initialize_test_db,
    sample_metadata
):
    # 测试元数据缓存
    service = MetadataService()
    metadata1 = await service.fetch_metadata(
        sample_metadata,
        mock_engine,
        force_refresh=False
    )
    metadata2 = await service.fetch_metadata(
        sample_metadata,
        mock_engine,
        force_refresh=False
    )
    # 第二次调用应该返回缓存
    assert metadata1 == metadata2
```

### 前端测试

#### 测试文件

**路径**: `frontend/tests/performance.spec.ts`

**测试套件**:

1. **后端性能监控 API 测试**:
   - 健康检查端点返回系统状态
   - 获取性能阈值配置
   - 获取系统指标
   - 获取慢查询列表
   - 获取查询性能统计
   - 详细健康状态检查

2. **前端 Web 性能测试**:
   - 页面加载性能指标
   - Core Web Vitals 收集
   - API 响应时间测试
   - 多次请求验证性能监控中间件

3. **性能监控集成测试**:
   - 完整性能监控流程测试
   - 性能监控中间件记录请求

**测试框架**: Playwright Test

**示例测试用例**:
```typescript
test('should return health status with system metrics', async ({ request }) => {
  const response = await request.get('/api/v1/metrics/health-detailed');
  expect(response.status()).toBe(200);

  const health = await response.json();
  expect(health).toHaveProperty('status');
  expect(health).toHaveProperty('systemMetrics');
  expect(health).toHaveProperty('issues');
  expect(health.systemMetrics).toHaveProperty('cpuPercent');
  expect(health.systemMetrics).toHaveProperty('memory');
});

test('should collect Core Web Vitals', async ({ page }) => {
  const metrics = await page.evaluate(() => {
    return new Promise((resolve) => {
      // 模拟 web-vitals 收集
      const vitals = {
        LCP: 1200,
        FID: 45,
        CLS: 0.05,
        FCP: 800
      };
      resolve(vitals);
    });
  });

  expect(metrics.LCP).toBeLessThan(2500); // LCP < 2.5s
  expect(metrics.FID).toBeLessThan(100);  // FID < 100ms
  expect(metrics.CLS).toBeLessThan(0.1);  // CLS < 0.1
});
```

### 运行测试

**后端测试**:
```bash
cd backend

# 运行所有测试
uv run pytest

# 运行特定测试文件
uv run pytest tests/services/test_metadata_service.py

# 运行带标记的测试
uv run pytest -m "unit"

# 生成覆盖率报告
uv run pytest --cov=src --cov-report=html

# 详细输出
uv run pytest -v
```

**前端测试**:
```bash
cd frontend

# 运行所有测试
npm run test

# 运行性能测试
npx playwright test tests/performance.spec.ts

# 运行测试并查看报告
npx playwright test --reporter=html

# 调试模式
npx playwright test --debug
```

### 测试覆盖范围

| 模块 | 测试文件 | 覆盖内容 |
|------|----------|----------|
| API 层 | test_dependencies.py, test_errors.py | 依赖注入、错误处理 |
| 服务层 | test_services_*.py | 数据库、查询、元数据服务 |
| 性能监控 | performance.spec.ts | 系统指标、慢查询、健康检查 |
| Web 性能 | performance.spec.ts | Core Web Vitals、页面加载 |

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
graph TD
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
graph TD
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
graph TD
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
graph TD
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
graph LR
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
graph TD
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
graph LR
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
graph TD
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

### 性能监控 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/metrics/performance | 获取 HTTP 请求性能指标 |
| GET | /api/v1/metrics/slow-queries | 获取慢查询列表 |
| GET | /api/v1/metrics/query-performance | 获取查询性能统计 |
| GET | /api/v1/metrics/system | 获取当前系统指标 |
| GET | /api/v1/metrics/system/history | 获取历史系统指标 |
| GET | /api/v1/metrics/health-detailed | 获取详细健康状态 |
| POST | /api/v1/metrics/cleanup | 清理历史指标数据 |
| GET | /api/v1/metrics/thresholds | 获取性能阈值配置 |
| GET | /health | 增强的健康检查端点 |

**性能监控 API 请求示例**:

获取系统指标：
```json
GET /api/v1/metrics/system

响应：
{
  "cpuPercent": 45.2,
  "memory": {
    "total": 17179869184,
    "available": 8589934592,
    "percent": 50.0,
    "used": 8589934592
  },
  "disk": {
    "total": 500000000000,
    "used": 200000000000,
    "percent": 40.0
  },
  "process": {
    "memoryMb": 256,
    "cpuPercent": 12.5,
    "numThreads": 8,
    "numFds": 32
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

获取慢查询列表：
```json
GET /api/v1/metrics/slow-queries?min_execution_time_ms=1000&limit=10

响应：
{
  "slowQueries": [
    {
      "id": 1,
      "databaseName": "mydb",
      "sql": "SELECT * FROM large_table JOIN another_table...",
      "executionTimeMs": 5234,
      "rowCount": 15000,
      "createdAt": "2024-01-15T10:25:00Z"
    }
  ],
  "total": 1
}
```

获取查询性能统计：
```json
GET /api/v1/metrics/query-performance?database_name=mydb&hours=24

响应：
{
  "totalQueries": 1234,
  "successfulQueries": 1200,
  "failedQueries": 34,
  "successRate": 0.972,
  "avgExecutionTimeMs": 245,
  "slowQueries": 23,
  "verySlowQueries": 5,
  "criticalSlowQueries": 1
}
```

获取健康状态：
```json
GET /api/v1/metrics/health-detailed

响应：
{
  "status": "healthy",
  "issues": [],
  "systemMetrics": {
    "cpuPercent": 45.2,
    "memory": { "percent": 50.0 },
    "disk": { "percent": 40.0 }
  },
  "slowQueriesCount": 3,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

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

## Hooks 机制详解

### 目录

- [概述](#hooks-概述)
- [前端 React Hooks](#前端-react-hooks)
    - [核心原理](#核心原理)
    - [useDatabases](#usedatabases-数据库列表管理)
    - [useMetadata](#usemetadata-元数据管理)
    - [useQueryExecution](#usequeryexecution-查询执行状态管理)
    - [usePerformance](#useperformance-性能监控)
    - [useTreeData](#usetreedata-架构树数据转换)
- [后端依赖注入钩子](#后端依赖注入钩子)
    - [FastAPI 依赖注入原理](#fastapi-依赖注入原理)
    - [服务工厂函数](#服务工厂函数)
- [生命周期钩子](#生命周期钩子)
- [Hook 联动机制](#hook-联动机制)
- [Hooks 最佳实践](#hooks-最佳实践)

---

### Hooks 概述

本项目中的 **Hooks** 是指两类机制：

1. **前端 React Hooks**：基于 React Query (TanStack Query) 的自定义 Hooks，封装了服务端状态管理
2. **后端依赖注入钩子**：FastAPI 的依赖注入系统，用于服务实例的创建和生命周期管理

```mermaid
graph TB
    subgraph "前端层 - React Hooks"
        A[useDatabases<br/>数据库列表管理]
        B[useMetadata<br/>元数据管理]
        C[useQueryExecution<br/>查询执行状态]
        D[usePerformance<br/>性能监控]
        E[useTreeData<br/>树形数据转换]
    end

    subgraph "状态管理层"
        F[React Query<br/>QueryClient]
        G[本地 useState<br/>UI特定状态]
    end

    subgraph "API层"
        H[api.ts<br/>API客户端单例]
        I[performanceApi.ts<br/>性能监控API]
    end

    subgraph "后端层 - 依赖注入"
        J[get_db_service<br/>数据库服务工厂]
        K[get_query_service<br/>查询服务工厂]
        L[get_metadata_service<br/>元数据服务工厂]
        M[get_llm_service<br/>LLM服务工厂]
    end

    subgraph "生命周期钩子"
        N[lifespan<br/>启动/关闭管理]
        O[MetricsService<br/>性能收集启动]
    end

    A --> F
    B --> F
    C --> F
    D --> F
    E --> G
    F --> H
    D --> I

    J --> L
    K --> J

    N --> O
```

---

### 前端 React Hooks

#### 核心原理

**React Query 状态管理模式**：

```mermaid
sequenceDiagram
    participant Component as 组件
    participant Hook as 自定义Hook
    participant QueryClient as QueryClient
    participant API as API客户端
    participant Backend as 后端服务

    Component->>Hook: const { data, isLoading } = useXxx()
    Hook->>QueryClient: useQuery({ queryKey, queryFn })
    QueryClient->>QueryClient: 检查缓存

    alt 缓存有效且未过期
        QueryClient-->>Component: 返回缓存数据
    else 缓存无效或不存在
        QueryClient->>API: 调用 queryFn
        API->>Backend: fetch 请求
        Backend-->>API: JSON响应
        API-->>QueryClient: 数据
        QueryClient->>QueryClient: 更新缓存
        QueryClient-->>Component: 返回新数据
    end

    Note over Component: 触发重新渲染
```

**Query Key 设计模式**：

```typescript
// 层级化 Query Key 结构
const databaseKeys = {
  all: ["databases"] as const,                          // 基础层级
  lists: () => [...databaseKeys.all, "list"] as const, // 列表层级
  list: () => [...databaseKeys.lists()] as const,      // 具体列表
  details: () => [...databaseKeys.all, "detail"] as const,
  detail: (name: string) => [...databaseKeys.details(), name] as const,
};

// 使用场景
queryKey: databaseKeys.list()           // ["databases", "list"]
queryKey: databaseKeys.detail("mydb")   // ["databases", "detail", "mydb"]
```

---

#### useDatabases - 数据库列表管理

**路径**: `frontend/src/pages/Dashboard/hooks/useDatabases.ts`

**功能职责**：
- 管理数据库连接列表的状态
- 提供 CRUD 操作的封装
- 自动缓存失效和刷新

**代码结构**：

```typescript
export function useDatabases() {
  const queryClient = useQueryClient();

  // 1. 数据列表查询
  const query = useQuery({
    queryKey: databaseKeys.list(),
    queryFn: async () => {
      const response = await api.listDatabases();
      return response.databases;
    },
    staleTime: 2 * 60 * 1000, // 2分钟缓存
  });

  // 2. 创建数据库 Mutation
  const createDatabaseMutation = useMutation({
    mutationFn: async (request: DatabaseCreateRequest) => {
      return await api.createDatabase(request.name, request.url);
    },
    onSuccess: () => {
      // 自动失效相关查询，触发重新获取
      queryClient.invalidateQueries({ queryKey: databaseKeys.list() });
      message.success("数据库创建成功");
    },
    onError: (error: Error) => {
      message.error(error.message || "创建数据库失败");
    },
  });

  // 3. 删除数据库 Mutation
  const deleteDatabaseMutation = useMutation({
    mutationFn: async (name: string) => {
      return await api.deleteDatabase(name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: databaseKeys.list() });
      message.success("数据库删除成功");
    },
  });

  // 4. 更新数据库 Mutation
  const updateDatabaseMutation = useMutation({
    mutationFn: async ({ name, request }: { name: string; request: { name?: string; url?: string } }) => {
      return await api.updateDatabase(name, request);
    },
    onSuccess: (_, variables) => {
      // 失效列表和详情缓存
      queryClient.invalidateQueries({ queryKey: databaseKeys.list() });
      queryClient.invalidateQueries({ queryKey: databaseKeys.detail(variables.name) });
      message.success("数据库更新成功");
    },
  });

  return {
    databases: query.data ?? [],
    loading: query.isLoading,
    createDatabase: createDatabaseMutation.mutateAsync,
    deleteDatabase: deleteDatabaseMutation.mutateAsync,
    updateDatabase: updateDatabaseMutation.mutateAsync,
    refreshDatabases: () => queryClient.invalidateQueries({ queryKey: databaseKeys.list() }),
    isCreating: createDatabaseMutation.isPending,
    isDeleting: deleteDatabaseMutation.isPending,
    isUpdating: updateDatabaseMutation.isPending,
  };
}
```

**触发机制**：

```mermaid
graph TD
    A[组件挂载] --> B[useQuery 触发]
    B --> C{检查缓存}
    C -->|有效且未过期| D[返回缓存数据]
    C -->|无效或不存在| E[调用 api.listDatabases]
    E --> F[GET /api/v1/dbs]
    F --> G[更新缓存]
    G --> H[组件重新渲染]

    I[用户创建数据库] --> J[createDatabase]
    J --> K["PUT /api/v1/dbs/{name}"]
    K --> L[onSuccess 回调]
    L --> M[invalidateQueries]
    M --> N[自动重新获取列表]
    N --> H
```

**使用示例**：

```typescript
// 在组件中使用
function DatabaseList() {
  const {
    databases,
    loading,
    createDatabase,
    deleteDatabase,
    isCreating,
    isDeleting,
  } = useDatabases();

  if (loading) return <Spin />;

  return (
    <List
      dataSource={databases}
      renderItem={(db) => (
        <List.Item
          actions={[
            <Button
              danger
              loading={isDeleting}
              onClick={() => deleteDatabase(db.name)}
            >
              删除
            </Button>,
          ]}
        >
          {db.name}
        </List.Item>
      )}
    />
  );
}
```

---

#### useMetadata - 元数据管理

**路径**: `frontend/src/pages/Dashboard/hooks/useMetadata.ts`

**功能职责**：
- 管理选中数据库的元数据状态
- 提供数据库选择和切换功能
- 处理元数据缓存和刷新

**关键特性**：

1. **条件查询 (Conditional Querying)**

```typescript
const metadataQuery = useQuery({
  queryKey: selectedDatabaseName
    ? metadataKeys.detail(selectedDatabaseName)
    : ["metadata", "none"],
  queryFn: async () => {
    if (!selectedDatabaseName) {
      throw new Error("No database selected");
    }
    return await api.getDatabase(selectedDatabaseName);
  },
  enabled: !!selectedDatabaseName,  // 只有选中数据库时才执行查询
  staleTime: 10 * 60 * 1000,        // 10分钟缓存（元数据变化较少）
  retry: 1,
});
```

2. **乐观更新 (Optimistic Updates)**

```typescript
const deleteDatabaseMutation = useMutation({
  mutationFn: async (name: string) => {
    return await api.deleteDatabase(name);
  },
  onMutate: async (name) => {
    // 1. 取消相关查询
    await queryClient.cancelQueries({ queryKey: metadataKeys.detail(name) });

    // 2. 保存当前值（快照）
    const previousDatabase = queryClient.getQueryData(metadataKeys.detail(name));

    return { previousDatabase };
  },
  onSuccess: (_, name) => {
    // 3. 失效元数据查询
    queryClient.invalidateQueries({ queryKey: metadataKeys.detail(name) });
    queryClient.invalidateQueries({ queryKey: ["databases", "list"] });

    // 4. 如果删除的是当前选中数据库，清空选择
    if (selectedDatabaseName === name) {
      setSelectedDatabaseName(null);
    }
  },
  onError: (error: Error, _, context) => {
    // 5. 出错时恢复快照
    if (context?.previousDatabase) {
      queryClient.setQueryData(
        metadataKeys.detail(selectedDatabaseName || ""),
        context.previousDatabase
      );
    }
    message.error(error.message || "删除数据库失败");
  },
});
```

**状态流转**：

```mermaid
stateDiagram-v2
    [*] --> 未选择数据库
    未选择数据库 --> 已选择数据库: selectDatabase(name)
    已选择数据库 --> 加载中: enabled=true, 触发查询
    加载中 --> 已选择数据库: 查询成功
    加载中 --> 错误状态: 查询失败
    已选择数据库 --> 已选择数据库: refreshMetadata()
    已选择数据库 --> 未选择数据库: clearDatabase() 或删除当前库
    错误状态 --> 已选择数据库: 重试成功
    错误状态 --> 未选择数据库: clearDatabase()
```

---

#### useQueryExecution - 查询执行状态管理

**路径**: `frontend/src/pages/Dashboard/hooks/useQueryExecution.ts`

**功能职责**：
- 管理 SQL 查询和 AI 查询的执行状态
- 维护查询结果和错误信息
- 处理查询历史失效

**混合状态管理**：

```typescript
export function useQueryExecution() {
  // React Query 管理服务端状态（Mutation）
  const executeQueryMutation = useMutation({
    mutationFn: async ({ databaseName, sql }: { databaseName: string; sql: string }) => {
      return await api.executeQuery(databaseName, sql);
    },
    onMutate: () => {
      setError(null);
      setQueryResult(null);
    },
    onSuccess: (result) => {
      setQueryResult(result);
      message.success(`查询返回 ${result.rowCount} 行，耗时 ${result.executionTimeMs}ms`);
    },
    onError: (err: Error) => {
      const errorMsg = err.message || "查询执行失败";
      setError(errorMsg);
      message.error(errorMsg);
    },
  });

  // 本地 useState 管理 UI 特定状态
  const [sql, setSql] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("sql");

  return {
    sql,
    setSql,
    queryResult,
    setQueryResult,
    loading: executeQueryMutation.isPending || naturalQueryMutation.isPending,
    error,
    activeTab,
    setActiveTab,
    executeQuery,
    handleQueryGenerated,
    clearQuery,
    invalidateQueryHistory,
  };
}
```

**为什么使用混合状态管理？**

| 状态类型 | 管理方式 | 原因 |
|---------|---------|------|
| 查询结果 (服务端) | Mutation | 需要发送请求，管理加载/错误状态 |
| SQL 输入值 | useState | 纯 UI 状态，不需要持久化 |
| 活动标签 | useState | 纯 UI 状态，组件内部使用 |
| 查询历史 | QueryClient | 多组件共享，需要缓存失效 |

**AI 查询执行流程**：

```mermaid
sequenceDiagram
    participant User as 用户
    participant Hook as useQueryExecution
    participant Mutation as naturalQueryMutation
    participant API as api.naturalQuery
    participant Backend as 后端 AI 服务

    User->>Hook: 输入自然语言查询
    Hook->>Mutation: mutateAsync({ databaseName, prompt })
    Mutation->>API: POST /api/v1/dbs/{name}/query/natural
    API->>Backend: 发送 prompt
    Backend->>Backend: LLM 生成 SQL
    Backend-->>API: 返回 generatedSql + results
    API-->>Mutation: NaturalQueryResponse
    Mutation->>Hook: onSuccess 回调

    Hook->>Hook: setSql(generatedSql)
    Hook->>Hook: setActiveTab("sql")
    Hook->>Hook: setQueryResult(results)
    Hook->>User: 显示成功消息
```

---

#### usePerformance - 性能监控

**路径**: `frontend/src/pages/Dashboard/hooks/usePerformance.ts`

**功能职责**：
- 提供多个性能监控相关的 React Query Hooks
- 支持自动轮询 (Polling) 获取实时数据
- 组合多个 Hook 聚合数据

**核心 Hooks 列表**：

```typescript
// 1. 系统指标（默认5秒刷新）
export function useSystemMetrics(refetchInterval = 5000) {
  return useQuery({
    queryKey: ['performance', 'system-metrics'],
    queryFn: () => performanceApi.getSystemMetrics(),
    refetchInterval,  // 自动轮询
    staleTime: 1000,
  });
}

// 2. 系统指标历史（默认30秒刷新）
export function useSystemMetricsHistory(limit = 100) {
  return useQuery({
    queryKey: ['performance', 'system-metrics-history', limit],
    queryFn: () => performanceApi.getSystemMetricsHistory(limit),
    refetchInterval: 30000,
    staleTime: 10000,
  });
}

// 3. 慢查询列表（默认10秒刷新）
export function useSlowQueries(params?: {...}, refetchInterval = 10000) {
  return useQuery({
    queryKey: ['performance', 'slow-queries', params],
    queryFn: () => performanceApi.getSlowQueries(params),
    refetchInterval,
    staleTime: 5000,
  });
}

// 4. 查询性能统计（默认15秒刷新）
export function useQueryPerformanceStats(params?: {...}, refetchInterval = 15000) {
  return useQuery({
    queryKey: ['performance', 'query-stats', params],
    queryFn: () => performanceApi.getQueryPerformanceStats(params),
    refetchInterval,
    staleTime: 10000,
  });
}

// 5. 健康状态（默认10秒刷新）
export function useHealthDetailed(refetchInterval = 10000) {
  return useQuery({
    queryKey: ['performance', 'health-detailed'],
    queryFn: () => performanceApi.getHealthDetailed(),
    refetchInterval,
    staleTime: 5000,
  });
}

// 6. 性能阈值（很少变化，不自动刷新）
export function usePerformanceThresholds() {
  return useQuery({
    queryKey: ['performance', 'thresholds'],
    queryFn: () => performanceApi.getPerformanceThresholds(),
    staleTime: Infinity,  // 永久有效
  });
}
```

**组合 Hook 模式**：

```typescript
// 组合 hook: 获取所有性能监控数据
export function usePerformanceDashboard() {
  const systemMetrics = useSystemMetrics();
  const healthStatus = useHealthDetailed();
  const slowQueries = useSlowQueries();
  const queryStats = useQueryPerformanceStats();
  const performanceMetrics = usePerformanceMetrics();
  const thresholds = usePerformanceThresholds();

  // 聚合加载状态
  const isLoading =
    systemMetrics.isLoading ||
    healthStatus.isLoading ||
    slowQueries.isLoading ||
    queryStats.isLoading ||
    performanceMetrics.isLoading ||
    thresholds.isLoading;

  return {
    data: {
      systemMetrics: systemMetrics.data,
      healthStatus: healthStatus.data,
      slowQueries: slowQueries.data || [],
      queryStats: queryStats.data,
      performanceMetrics: performanceMetrics.data,
      thresholds: thresholds.data,
    },
    isLoading,
    refetch: () => {
      systemMetrics.refetch();
      healthStatus.refetch();
      slowQueries.refetch();
      queryStats.refetch();
      performanceMetrics.refetch();
    },
  };
}
```

**自动轮询机制**：

```mermaid
sequenceDiagram
    participant Component as 组件
    participant Hook as useSystemMetrics
    participant QueryClient as QueryClient
    participant API as Backend API

    Component->>Hook: 调用 useSystemMetrics(5000)
    Hook->>QueryClient: useQuery({ refetchInterval: 5000 })

    loop 每5秒
        QueryClient->>API: GET /api/v1/metrics/system
        API-->>QueryClient: 系统指标数据
        QueryClient->>QueryClient: 更新缓存
        QueryClient-->>Component: 触发重新渲染
    end
```

---

#### useTreeData - 架构树数据转换

**路径**: `frontend/src/hooks/useTreeData.tsx`

**功能职责**：
- 将元数据转换为 Ant Design Tree 组件所需的数据结构
- 按 Schema 分组表和视图
- 使用 useMemo 优化性能

**数据转换流程**：

```mermaid
graph LR
    subgraph "输入数据"
        A["TableMetadata[]"]
        B["ViewMetadata[]"]
    end

    subgraph "转换过程"
        C[groupBySchema<br/>按schema分组]
        D[buildObjectNode<br/>构建表/视图节点]
        E[buildSchemaGroupNodes<br/>构建schema分组节点]
    end

    subgraph "输出数据"
        F["DataNode[]<br/>Ant Design Tree数据"]
    end

    A --> C
    B --> C
    C --> D
    D --> E
    E --> F

    style F fill:#d4edda
```

**核心实现**：

```typescript
export function useTreeData(
  tables: TableMetadata[],
  views: ViewMetadata[]
): DataNode[] {
  return useMemo(() => {
    const nodes: DataNode[] = [];
    const { tablesBySchema, viewsBySchema } = groupBySchema(tables, views);

    // 构建表节点
    if (tables.length > 0) {
      const tableEntries = Object.entries(tablesBySchema);
      nodes.push(...buildSchemaGroupNodes(tableEntries, "table", "Tables"));
    }

    // 构建视图节点
    if (views.length > 0) {
      const viewEntries = Object.entries(viewsBySchema);
      nodes.push(...buildSchemaGroupNodes(viewEntries, "view", "Views"));
    }

    return nodes;
  }, [tables, views]);  // 依赖 tables 和 views
}
```

**数据结构示例**：

```typescript
// 输入
tables = [
  { name: "users", schema: "public", columns: [...] },
  { name: "orders", schema: "public", columns: [...] },
]

views = [
  { name: "user_orders", schema: "public", columns: [...] }
]

// 输出
treeData = [
  {
    title: "Tables (2)",
    key: "tables",
    icon: <DatabaseOutlined />,
    children: [
      {
        title: "users",
        key: "table-public-users",
        icon: <TableOutlined />,
        children: [
          { title: "id: INTEGER", key: "...", icon: <ColumnHeightOutlined /> },
          { title: "name: TEXT", key: "...", icon: <ColumnHeightOutlined /> },
        ]
      },
      // ... 更多表
    ]
  },
  {
    title: "Views (1)",
    key: "views",
    icon: <DatabaseOutlined />,
    children: [
      // ... 视图节点
    ]
  }
]
```

---

### 后端依赖注入钩子

#### FastAPI 依赖注入原理

**核心概念**：FastAPI 的依赖注入系统允许将函数作为依赖项注入到路由处理函数中。

```mermaid
sequenceDiagram
    participant Client as 客户端
    participant Router as 路由
    participant Depends as Depends()
    participant Factory as 服务工厂函数
    participant Service as 服务实例

    Client->>Router: POST /api/v1/dbs/{name}/query
    Router->>Depends: 执行依赖注入
    Depends->>Factory: get_query_service()
    Factory->>Service: new QueryService()
    Service-->>Factory: 返回实例
    Factory-->>Router: 注入 query_service 参数
    Router->>Service: query_service.execute_query(...)
    Service-->>Router: 返回结果
    Router-->>Client: HTTP Response
```

**依赖注入流程**：

```python
# 1. 定义服务工厂函数
def get_query_service() -> QueryService:
    """Get a QueryService instance.

    Returns:
        A QueryService instance.
    """
    return QueryService()

# 2. 在路由中使用 Depends 注入
from fastapi import Depends

@router.post("/{name}/query")
async def execute_query(
    name: str,
    request: QueryRequest,
    query_service: QueryService = Depends(get_query_service)
):
    """Execute a SQL query on the specified database."""
    # query_service 已自动注入
    return await query_service.execute_query(...)
```

---

#### 服务工厂函数

**路径**: `backend/src/api/dependencies.py`

**完整代码**：

```python
"""Dependency injection for service instances."""

from ..services.db_service import DatabaseService
from ..services.llm_service import LLMService
from ..services.metadata_service import MetadataService
from ..services.query_service import QueryService


def get_db_service() -> DatabaseService:
    """Get a DatabaseService instance.

    Returns:
        A DatabaseService instance.
    """
    return DatabaseService()


def get_query_service() -> QueryService:
    """Get a QueryService instance.

    Returns:
        A QueryService instance.
    """
    return QueryService()


def get_llm_service() -> LLMService:
    """Get an LLMService instance.

    Returns:
        An LLMService instance.
    """
    return LLMService()


def get_metadata_service() -> MetadataService:
    """Get a MetadataService instance.

    Returns:
        A MetadataService instance.
    """
    return MetadataService()


# Type aliases for dependency injection
DatabaseServiceDep = DatabaseService
QueryServiceDep = QueryService
LLMServiceDep = LLMService
MetadataServiceDep = MetadataService
```

**类型别名的作用**：

```python
# 类型别名提供更清晰的类型注解
async def execute_query(
    query_service: QueryServiceDep = Depends(get_query_service)
):
    # QueryServiceDep 等同于 QueryService
    # 但语义上明确表示这是一个依赖注入类型
    pass
```

**依赖注入的优势**：

| 优势 | 说明 |
|------|------|
| 解耦 | 路由处理函数不需要创建服务实例 |
| 测试友好 | 可以轻松注入 Mock 服务进行测试 |
| 单例模式 | 每次请求返回新实例，避免共享状态 |
| 类型安全 | 完整的类型注解支持 |

**使用示例**：

```python
# 单个依赖注入
@router.get("/{name}")
async def get_database(
    name: str,
    db_service: DatabaseService = Depends(get_db_service)
):
    return await db_service.get_database(name)

# 多个依赖注入
@router.post("/{name}/query/natural")
async def natural_query(
    name: str,
    request: NaturalQueryRequest,
    db_service: DatabaseService = Depends(get_db_service),
    metadata_service: MetadataService = Depends(get_metadata_service),
    llm_service: LLMService = Depends(get_llm_service),
    query_service: QueryService = Depends(get_query_service),
):
    # 使用多个服务协作完成请求
    database = await db_service.get_database_by_name(name)
    engine = db_service.get_engine(database.id, database.connection_url)
    metadata = await metadata_service.fetch_metadata(database, engine)
    generated_sql = await llm_service.generate_sql(request.prompt, metadata.tables)
    result = await query_service.execute_query(database, engine, generated_sql)
    return result
```

---

### 生命周期钩子

**路径**: `backend/src/api/main.py`

FastAPI 使用 `lifespan` 上下文管理器处理应用的启动和关闭事件。

```mermaid
stateDiagram-v2
    [*] --> 启动中: lifespan 开始
    启动中 --> 配置日志: configure_logging
    配置日志 --> 初始化数据库: initialize_database
    初始化数据库 --> 启动指标收集: MetricsService.start_collection
    启动指标收集 --> 运行中: yield

    运行中 --> 关闭中: 应用关闭
    关闭中 --> 关闭数据库连接: db_service.close
    关闭数据库连接 --> 停止指标收集: MetricsService.stop_collection
    停止指标收集 --> [*]: lifespan 结束
```

**完整代码**：

```python
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI

# Global reference to metrics service
_metrics_service: Any | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Lifespan context manager for startup and shutdown events.

    Args:
        app: The FastAPI application instance.

    Yields:
        None
    """
    global _metrics_service

    # ========== 启动阶段 ==========
    logger.info("application_starting", log_level=config.log_level)

    # 1. 初始化应用数据库
    await initialize_database()

    # 2. 启动性能监控服务
    from ..services.metrics_service import MetricsService

    _metrics_service = MetricsService()
    await _metrics_service.start_collection()
    logger.info("application_started")

    yield  # 应用运行中...

    # ========== 关闭阶段 ==========
    logger.info("application_shutting_down")

    # 3. 关闭数据库连接
    from ..services.db_service import DatabaseService

    db_service = DatabaseService()
    await db_service.close()

    # 4. 停止性能监控
    if _metrics_service:
        await _metrics_service.stop_collection()
    logger.info("database_connections_closed")


# 创建 FastAPI 应用，注册 lifespan
app = FastAPI(
    title="Database Query Tool API",
    description="API for managing database connections and executing queries",
    version="1.0.0",
    lifespan=lifespan,  # 注册生命周期钩子
    max_request_size=config.max_request_size,
)
```

**MetricsService 生命周期**：

```mermaid
sequenceDiagram
    participant App as FastAPI App
    participant Lifespan as lifespan
    participant DB as initialize_database
    participant Metrics as MetricsService
    participant Task as 后台收集任务

    App->>Lifespan: 启动应用
    Lifespan->>DB: initialize_database()
    DB-->>Lifespan: 数据库初始化完成

    Lifespan->>Metrics: new MetricsService()
    Lifespan->>Metrics: start_collection()
    Metrics->>Task: 创建后台任务 asyncio.create_task
    Task->>Task: 每60秒收集系统指标
    Metrics-->>Lifespan: 启动完成

    Lifespan->>App: yield (应用运行)
    Note over App,Task: 应用处理请求...

    App->>Lifespan: 关闭应用
    Lifespan->>Task: cancel()
    Task-->>Lifespan: 任务取消
    Lifespan->>Metrics: stop_collection()
    Lifespan->>DB: db_service.close()
    Lifespan->>App: 生命周期结束
```

**健康检查端点使用全局服务**：

```python
@app.get("/health")
async def health() -> dict[str, Any]:
    """Enhanced health check endpoint with system metrics.

    Returns:
        Health status including system metrics and any detected issues.
    """
    if _metrics_service:
        return _metrics_service.get_health_status()
    return {"status": "healthy", "timestamp": "unknown"}


def get_metrics_service() -> Any:
    """Get the global metrics service instance.

    Returns:
        The metrics service instance or None if not initialized.
    """
    return _metrics_service
```

---

### Hook 联动机制

#### 前后端联动流程

**完整查询流程中的 Hook 联动**：

```mermaid
sequenceDiagram
    participant User as 用户
    participant FE_Hook as useQueryExecution
    participant FE_Query as React Query
    participant API as Backend API
    participant BE_Depends as FastAPI Depends
    participant BE_Services as 后端服务层
    participant Lifespan as MetricsService

    User->>FE_Hook: 点击执行查询
    FE_Hook->>FE_Query: executeQueryMutation.mutateAsync()
    FE_Query->>API: POST /api/v1/dbs/{name}/query

    API->>BE_Depends: 注入 get_query_service()
    BE_Depends->>BE_Services: new QueryService()
    BE_Services-->>API: 服务实例

    API->>BE_Services: query_service.execute_query()

    par 并行操作
        BE_Services->>BE_Services: 执行 SQL 查询
    and
        BE_Services->>Lifespan: record_slow_query()
        Lifespan->>Lifespan: 记录慢查询到内存
    end

    BE_Services-->>API: QueryResponse
    API-->>FE_Query: JSON 响应
    FE_Query->>FE_Query: 更新缓存
    FE_Query->>FE_Hook: onSuccess 回调
    FE_Hook->>User: 显示结果

    Note over FE_Query: 自动失效查询历史缓存
    FE_Query->>FE_Query: invalidateQueries(['queries', 'history', databaseName])
```

#### 缓存联动

**跨 Hook 缓存失效**：

```typescript
// useMetadata Hook
const deleteDatabaseMutation = useMutation({
  onSuccess: (_, name) => {
    // 1. 失效元数据缓存
    queryClient.invalidateQueries({ queryKey: metadataKeys.detail(name) });

    // 2. 失效数据库列表缓存
    queryClient.invalidateQueries({ queryKey: ["databases", "list"] });

    // 3. 如果删除的是当前选中数据库，清空选择
    if (selectedDatabaseName === name) {
      setSelectedDatabaseName(null);
    }
  },
});
```

**依赖 Hook 级联刷新**：

```typescript
// Dashboard 组件中的 Hook 联动
function Dashboard() {
  const { selectedDatabase } = useMetadata();
  const { invalidateQueryHistory } = useQueryExecution();

  // 当选中数据库变化时，刷新查询历史
  useEffect(() => {
    if (selectedDatabase) {
      invalidateQueryHistory(selectedDatabase.name);
    }
  }, [selectedDatabase]);
}
```

#### 性能监控联动

**前后端性能数据同步**：

```mermaid
graph LR
    subgraph "后端"
        A[MetricsService<br/>收集系统指标]
        B[查询执行<br/>记录慢查询]
        C[API 端点<br/>暴露指标数据]
    end

    subgraph "前端"
        D[usePerformance<br/>轮询获取指标]
        E[PerformanceDashboard<br/>展示性能数据]
    end

    A --> C
    B --> C
    C --> D
    D --> E

    style A fill:#fff4e6
    style D fill:#e1f5ff
```

**自动刷新机制**：

```typescript
// 前端自动轮询（5秒间隔）
const systemMetrics = useSystemMetrics(5000);

// 后端定时收集（60秒间隔）
// MetricsService._collect_system_metrics() 每60秒执行一次
```

---

### Hooks 最佳实践

#### 1. Query Key 设计

```typescript
// ✅ 推荐：层级化、可预测的 key 结构
const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (filters: string) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, "detail"] as const,
  detail: (id: number) => [...userKeys.details(), id] as const,
};

// ❌ 避免：扁平化、不可预测的 key
const badKeys = {
  users: "users",
  userDetail: (id: number) => `user-${id}`,
};
```

#### 2. 缓存策略

```typescript
// ✅ 推荐：根据数据变化频率设置 staleTime
useQuery({
  queryKey: ["databases"],
  staleTime: 2 * 60 * 1000,  // 2分钟 - 数据库列表变化较少
});

useQuery({
  queryKey: ["metadata", databaseName],
  staleTime: 10 * 60 * 1000, // 10分钟 - 元数据变化最少
});

useQuery({
  queryKey: ["system-metrics"],
  staleTime: 1000,            // 1秒 - 系统指标频繁变化
});

// ❌ 避免：所有查询使用相同的 staleTime
useQuery({
  queryKey: ["anything"],
  staleTime: 0,  // 每次都重新请求，浪费资源
});
```

#### 3. 错误处理

```typescript
// ✅ 推荐：在 Mutation 中处理错误
const mutation = useMutation({
  mutationFn: async (data) => {
    return await api.createResource(data);
  },
  onError: (error: Error) => {
    // 统一错误处理
    message.error(error.message || "操作失败");
    // 可以添加错误上报
    trackError(error);
  },
});

// ❌ 避免：在每个调用处处理错误
try {
  await mutation.mutateAsync(data);
} catch (error) {
  message.error((error as Error).message);  // 重复代码
}
```

#### 4. 乐观更新

```typescript
// ✅ 推荐：使用乐观更新提升用户体验
const updateMutation = useMutation({
  mutationFn: updateResource,
  onMutate: async (newData) => {
    // 1. 取消相关查询
    await queryClient.cancelQueries({ queryKey: ["resource", newData.id] });

    // 2. 保存当前值
    const previousData = queryClient.getQueryData(["resource", newData.id]);

    // 3. 乐观更新 UI
    queryClient.setQueryData(["resource", newData.id], newData);

    return { previousData };
  },
  onError: (err, newData, context) => {
    // 4. 出错时回滚
    queryClient.setQueryData(["resource", newData.id], context?.previousData);
  },
  onSettled: () => {
    // 5. 无论成功失败都重新获取
    queryClient.invalidateQueries({ queryKey: ["resource"] });
  },
});
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
