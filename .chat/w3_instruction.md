## 生成重构计划
根据@.claude/commands/deep-code-review.md 对 @project/db_query/ 按照其中的建议按重要程度排序,生成详细的代码重构计划,放在@specs/002-db-query/refactoring_plan.md下

## README.md 重构
请为以下全栈数据库查询工具项目生成一份详尽的技术文档，要求既包含宏观的架构设计，也包含微观的代码实现细节。

  ---

  ## 文档结构要求

  ### 第一部分：项目概览
  1. **项目背景与目标**
     - 解决的核心问题
     - 主要功能特性
     - 技术选型理由

  2. **整体架构图**
     - 前后端分离架构
     - 数据流向图
     - 部署架构

  ### 第二部分：后端架构详解

  #### 2.1 架构分层
  - **API 层** (`src/api/`)
    - FastAPI 应用入口 (`main.py`)
      - 生命周期管理（startup/shutdown）
      - CORS 配置
      - 中间件注册
      - 全局异常处理
    - 依赖注入系统 (`dependencies.py`)
      - 服务工厂函数设计
      - 依赖注入的优势
    - 错误处理机制 (`errors.py`)
      - ErrorCode 枚举定义
      - APIError 基类
      - handle_api_error 转换函数

  - **路由层** (`src/api/v1/`)
    - `databases.py` - 数据库管理端点
      - 每个端点的请求/响应模型
      - 业务逻辑调用链
      - 速率限制配置
    - `queries.py` - 查询执行端点
      - SQL 查询流程
      - 自然语言转 SQL 流程
      - 历史记录管理
      - 导出功能实现
    - `metrics.py` - 性能监控端点
      - 系统指标收集
      - 慢查询追踪
      - 健康检查

  - **服务层** (`src/services/`)
    - `DatabaseService` - 数据库连接管理
      - 连接池设计（引擎缓存、超时清理）
      - 驱动注入机制（MySQL/PostgreSQL）
      - 连接字符串解析与密码脱敏
      - 核心函数签名与实现细节

    - `QueryService` - 查询执行服务
      - SQL 验证流程（只允许 SELECT）
      - LIMIT 保护机制
      - 结果序列化与类型推断
      - 慢查询监控集成
      - 查询历史记录

    - `LLMService` - AI 服务
      - Prompt 工程设计
      - 智谱 AI 调用（glm-4-flash）
      - Tenacity 重试机制
      - SQL 验证与修复
      - 建议查询生成

    - `MetadataService` - 元数据服务
      - 元数据提取策略（批量优化）
      - 缓存机制（TTL=1小时）
      - SQL 注入防护（标识符验证）

    - `MetricsService` - 性能监控服务
      - 后台任务调度
      - 系统指标收集（CPU/内存/磁盘）
      - 慢查询分级记录
      - 健康状态评估

  - **数据模型层** (`src/models/`)
    - `CamelModel` 基类设计
    - 数据库模型（`database.py`）
    - 查询模型（`query.py`）
    - 元数据模型（`metadata.py`）
    - Pydantic 验证规则

  - **核心模块** (`src/core/`)
    - `constants.py` - 常量定义
      - 数据库常量（连接池、超时）
      - 查询常量（LIMIT、超时）
      - 性能阈值（慢查询分级）
      - 分页配置
    - `sqlite_db.py` - 内部数据库
      - 表结构设计
      - 连接管理（外键、行工厂）
      - CRUD 操作封装
    - `sql_parser.py` - SQL 解析器
      - sqlglot 封装
      - SELECT 验证
      - LIMIT 注入
    - `logging.py` - 结构化日志
      - structlog 配置
      - JSON 格式输出

  - **中间件** (`src/middleware/`)
    - `rate_limit.py` - 速率限制
      - slowapi 集成
      - IP 级别限制
      - 不同端点的限制策略

  #### 2.2 函数调用链分析
  对每个核心功能，详细描绘：
  - 入口函数
  - 中间处理函数
  - 底层依赖函数
  - 数据流转过程

  例如：自然语言查询的完整调用链
  POST /api/v1/dbs/{name}/query/natural
    └─> natural_query() [queries.py]
         ├─> get_database_by_name() [DatabaseService]
         ├─> get_connection_url_with_driver() [DatabaseService]
         ├─> get_engine() [DatabaseService]
         ├─> fetch_metadata() [MetadataService]
         ├─> generate_and_validate() [LLMService]
         │    ├─> generate_sql() [LLMService]
         │    │    └─> _build_prompt() [私有方法]
         │    │    └─> zai-sdk 调用
         │    └─> validate_and_fix_sql() [LLMService]
         │         └─> validate_select_only() [SQLParser]
         │         └─> ensure_limit() [SQLParser]
         └─> execute_query() [QueryService]
              ├─> _execute_with_engine()
              ├─> _serialize_results()
              └─> _log_query()

  ### 第三部分：前端架构详解

  #### 3.1 组件架构
  - **页面层** (`src/pages/Dashboard/`)
    - `index.tsx` - 主仪表板
      - 状态管理策略
      - 子组件协调
      - Hooks 组合

  - **自定义 Hooks** (`src/pages/Dashboard/hooks/`)
    - `useDatabases.ts` - 数据库列表管理
      - React Query 配置
      - Query Key 设计
      - Mutation 处理
      - 缓存失效策略

    - `useMetadata.ts` - 元数据管理
      - 条件查询（enabled）
      - 乐观更新（onMutate）
      - 状态联动

    - `useQueryExecution.ts` - 查询执行
      - 混合状态管理（React Query + useState）
      - 错误处理
      - AI 查询集成

    - `usePerformance.ts` - 性能监控
      - 轮询机制（refetchInterval）
      - 组合 Hook 模式

  - **组件层** (`src/components/`)
    - `query/SqlEditor.tsx` - SQL 编辑器
      - Monaco Editor 集成
      - 自动补全配置
      - 快捷键绑定

    - `query/NaturalQueryInput.tsx` - AI 查询输入
      - 确认弹窗流程
      - 建议查询获取
      - 执行模式选择

    - `query/QueryResults.tsx` - 结果展示
      - Ant Design Table 配置
      - 分页处理
      - 导出功能

    - `query/QueryHistoryTab.tsx` - 查询历史
      - 分页加载
      - 重新执行流程
      - 批量删除

    - `database/DatabaseList.tsx` - 数据库列表
    - `database/AddDatabaseForm.tsx` - 添加表单
    - `database/EditDatabaseForm.tsx` - 编辑表单
    - `performance/PerformanceDashboard.tsx` - 性能仪表盘

  #### 3.2 状态管理
  - **React Query 策略**
    - Query Key 工厂模式
    - 缓存时间配置（staleTime）
    - 自动失效策略
    - 轮询配置

  - **本地状态管理**
    - useState 使用场景
    - Context 使用场景（如有）

  #### 3.3 API 客户端
  - `src/services/api.ts` - 主 API 客户端
    - 单例模式
    - fetch 封装
    - 错误处理
    - 类型定义

  - `src/services/performanceApi.ts` - 性能监控 API

  ### 第四部分：数据流与通信

  #### 4.1 前后端通信
  - API 端点完整列表
  - 请求/响应格式（JSON camelCase）
  - 错误响应格式
  - 速率限制策略

  #### 4.2 数据库交互
  - 用户数据库连接流程
  - 内部 SQLite 使用
  - 连接池管理

  #### 4.3 外部服务
  - 智谱 AI API 调用
  - 重试机制
  - 错误处理

  ### 第五部分：安全设计

  #### 5.1 后端安全
  - SQL 注入防护（标识符验证）
  - 只读查询限制（SELECT only）
  - 速率限制
  - 密码脱敏
  - 请求大小限制
  - CORS 配置

  #### 5.2 前端安全
  - React XSS 防护
  - 输入验证

  ### 第六部分：性能优化

  #### 6.1 后端优化
  - 连接池缓存
  - 元数据缓存
  - 批量查询优化
  - 异步处理

  #### 6.2 前端优化
  - React Query 缓存
  - 代码分割（如有）
  - 虚拟滚动（如有）

  ### 第七部分：部署与运维

  #### 7.1 环境配置
  - 环境变量列表
  - 默认值说明

  #### 7.2 运行命令
  - Makefile 命令
  - 开发/生产环境差异

  #### 7.3 监控与日志
  - 结构化日志
  - 性能监控
  - 健康检查

  ### 第八部分：扩展与维护

  #### 8.1 代码规范
  - Python 代码风格（Ruff + mypy）
  - TypeScript 代码风格（ESLint + Prettier）

  #### 8.2 测试策略
  - 后端测试结构
  - 前端测试结构

  #### 8.3 扩展建议
  - 新增数据库类型支持
  - 新增查询功能
  - 性能优化方向

  ---

  ## 输出格式要求

  1. 使用 Markdown 格式
  2. 包含 Mermaid 架构图
  3. 代码块使用语法高亮
  4. 使用表格进行对比说明
  5. 关键概念使用加粗强调
  6. 文件路径使用代码格式
  7. 函数签名使用 TypeScript/Python 类型注解

  ---

  ## 参考项目路径

  项目根目录：`/Users/liufukang/workplace/AI/project/db_query`

  后端关键目录：
  - `backend/src/api/` - API 层
  - `backend/src/services/` - 服务层
  - `backend/src/models/` - 数据模型
  - `backend/src/core/` - 核心模块
  - `backend/src/middleware/` - 中间件

  前端关键目录：
  - `frontend/src/pages/Dashboard/` - 页面组件
  - `frontend/src/components/` - 业务组件
  - `frontend/src/services/` - API 客户端

  ---

  请基于以上要求，生成一份详尽的技术文档,覆盖在 @project/db_query/README.MD文件上 。文档应适合开发者阅读，帮助他们快速理解项目架构、找到相关代码、进行功能扩展或问题排查