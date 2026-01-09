---

description: "Task list for Database Query Tool implementation"
---

# Tasks: Database Query Tool

**Input**: Design documents from `/specs/001-db-query/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/api.yaml

**Tests**: Tests are OPTIONAL - not explicitly requested in feature specification.

**Organization**: Tasks organized into 3 phases as requested by user. Each phase combines multiple user stories to enable incremental delivery.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/`

<!-- ============================================================================
   IMPORTANT: Tasks are organized into 3 phases combining user stories.
   Each phase is independently testable and delivers value.
   ============================================================================

   Phase 1: Core Infrastructure + User Story 1 (Database Connections)
   - Setup backend and frontend projects
   - Implement database connection management
   - Deliver: Users can add/manage databases and view metadata

   Phase 2: SQL Query Execution + User Story 2
   - Implement SQL parsing and validation
   - Implement query execution
   - Deliver: Users can execute SQL queries and see results

   Phase 3: Natural Language Queries + User Story 3 + Polish
   - Implement LLM integration
   - Implement natural language to SQL
   - Deliver: Users can query using natural language
   - Final polish and cross-cutting concerns
-->

---

## Phase 1: Infrastructure + Database Connections (US1)

**Purpose**: Project setup, core infrastructure, and database connection management

**Goal**: Users can add database connections and view their metadata

**Independent Test**: Add a test database connection, verify metadata is fetched and displayed correctly

### Backend Setup

- [X] T001 Create backend directory structure in backend/src/{api,models,services,core,lib}
- [X] T002 [P] Initialize Python project with uv and create backend/pyproject.toml
- [X] T003 [P] Configure mypy, ruff for linting and formatting in backend/pyproject.toml
- [X] T004 Create .env.example file in backend with ZAI_API_KEY and DB_PATH variables

### Core Infrastructure

- [X] T005 [P] Create CamelModel base class in backend/src/lib/json_encoder.py with camelCase alias generator
- [X] T006 [P] Create config module in backend/src/core/config.py loading environment variables
- [X] T007 [P] Create SQLite database layer in backend/src/core/sqlite_db.py with connection management
- [X] T008 [P] Create SQL parser using sqlglot in backend/src/core/sql_parser.py with SELECT-only validation
- [X] T009 [P] Initialize database schema in backend/src/core/sqlite_db.py (databases and query_history tables)

### Data Models

- [X] T010 [P] [US1] Create database models in backend/src/models/database.py (DatabaseConnection, DatabaseCreateRequest, DatabaseDetail, DatabaseListResponse)
- [X] T011 [P] [US1] Create metadata models in backend/src/models/metadata.py (ColumnMetadata, TableMetadata, ViewMetadata, MetadataResponse)
- [X] T012 [P] [US1] Create error models in backend/src/models/query.py (ErrorResponse, ErrorDetail)

### Database Service

- [X] T013 [US1] Implement DatabaseService in backend/src/services/db_service.py with methods for create, get, list, delete database connections
- [X] T014 [US1] Implement connection string parsing and db_type detection in backend/src/services/db_service.py
- [X] T015 [US1] Implement connection testing with SQLAlchemy in backend/src/services/db_service.py

### Metadata Service

- [X] T016 [US1] Implement MetadataService in backend/src/services/metadata_service.py with fetch_metadata method
- [X] T017 [US1] Implement Information Schema queries for MySQL/PostgreSQL/SQLite in backend/src/services/metadata_service.py
- [X] T018 [US1] Implement metadata caching to SQLite in backend/src/services/metadata_service.py

### API Endpoints - Databases

- [X] T019 [P] Create FastAPI app setup with CORS in backend/src/api/main.py
- [X] T020 [P] Create API router module in backend/src/api/v1/__init__.py
- [X] T021 [US1] Implement GET /api/v1/dbs endpoint in backend/src/api/v1/databases.py
- [X] T022 [US1] Implement PUT /api/v1/dbs endpoint in backend/src/api/v1/databases.py
- [X] T023 [US1] Implement GET /api/v1/dbs/{name} endpoint in backend/src/api/v1/databases.py
- [X] T024 [US1] Implement DELETE /api/v1/dbs/{name} endpoint in backend/src/api/v1/databases.py
- [X] T025 [US1] Add error handlers for connection failures in backend/src/api/v1/databases.py

### Frontend Setup

- [X] T026 [P] Create frontend directory structure in frontend/src/{components,pages,services,types}
- [X] T027 [P] Initialize React + Vite project and create frontend/package.json with refine, tailwind, antd dependencies
- [X] T028 [P] Configure TypeScript strict mode in frontend/tsconfig.json
- [X] T029 [P] Create Vite configuration in frontend/vite.config.ts
- [X] T030 [P] Create .env.development in frontend with VITE_API_URL
- [X] T031 [P] Setup Tailwind CSS and Ant Design in frontend/src/index.css

### Frontend Types and API Client

- [X] T032 [P] [US1] Create TypeScript types in frontend/src/types/index.ts matching backend Pydantic models
- [X] T033 [US1] Create API client in frontend/src/services/api.ts with fetch wrappers for all endpoints

### Frontend Components - Database Management

- [X] T034 [P] [US1] Create DatabaseList component in frontend/src/components/database/DatabaseList.tsx
- [X] T035 [P] [US1] Create AddDatabaseForm component in frontend/src/components/database/AddDatabaseForm.tsx
- [X] T036 [P] [US1] Create DatabaseDetail component in frontend/src/components/database/DatabaseDetail.tsx
- [X] T037 [P] [US1] Create TableList component in frontend/src/components/metadata/TableList.tsx
- [X] T038 [P] [US1] Create TableSchema component in frontend/src/components/metadata/TableSchema.tsx

### Frontend Pages

- [X] T039 [US1] Create Dashboard page in frontend/src/pages/Dashboard.tsx showing all databases
- [X] T040 [US1] Create DatabasePage page in frontend/src/pages/DatabasePage.tsx with database detail view
- [X] T041 [US1] Update App.tsx and main.tsx in frontend/src/ to setup routing

**Checkpoint**: At this point, users can add database connections, view their metadata (tables and views), and see table schemas. This is a complete MVP for database management.

---

## Phase 2: SQL Query Execution (US2)

**Purpose**: Implement SQL query validation and execution

**Goal**: Users can execute SQL queries (SELECT only) and see results in tables

**Independent Test**: Connect to a test database, execute various SQL queries, verify results display correctly

### Query Data Models

- [ ] T042 [P] [US2] Create query request/response models in backend/src/models/query.py (QueryRequest, QueryResponse)

### Query Service

- [ ] T043 [US2] Implement SQL validation with sqlglot in backend/src/core/sql_parser.py (check SELECT-only, add LIMIT)
- [ ] T044 [US2] Implement QueryService execute method in backend/src/services/query_service.py
- [ ] T045 [US2] Implement query timeout handling in backend/src/services/query_service.py
- [ ] T046 [US2] Implement query result serialization in backend/src/services/query_service.py
- [ ] T047 [US2] Implement query history logging in backend/src/services/query_service.py

### API Endpoints - Queries

- [ ] T048 [US2] Implement POST /api/v1/dbs/{name}/query endpoint in backend/src/api/v1/queries.py
- [ ] T049 [US2] Add SQL syntax error handling in backend/src/api/v1/queries.py
- [ ] T050 [US2] Add non-SELECT query rejection in backend/src/api/v1/queries.py
- [ ] T051 [US2] Implement GET /api/v1/dbs/{name}/history endpoint in backend/src/api/v1/queries.py

### Frontend Components - SQL Query

- [ ] T052 [P] [US2] Create SqlEditor component with Monaco Editor in frontend/src/components/query/SqlEditor.tsx
- [ ] T053 [P] [US2] Create QueryResults component with Ant Design Table in frontend/src/components/query/QueryResults.tsx
- [ ] T054 [P] [US2] Create QueryHistory component in frontend/src/components/query/QueryHistory.tsx

### Frontend Integration

- [ ] T055 [US2] Add SQL query UI to DatabasePage in frontend/src/pages/DatabasePage.tsx
- [ ] T056 [US2] Add query results display with pagination/virtual scrolling in frontend/src/pages/DatabasePage.tsx

**Checkpoint**: At this point, users can execute SQL queries (SELECT only), see results formatted as tables, and view query history. Phase 1 + 2 is a complete functional application for SQL querying.

---

## Phase 3: Natural Language Queries + Polish (US3)

**Purpose**: LLM integration for natural language to SQL and final polish

**Goal**: Users can query databases using natural language

**Independent Test**: Input natural language queries, verify SQL generation and execution

### LLM Service

- [X] T057 [P] [US3] Create zai-sdk integration in backend/src/services/llm_service.py
- [X] T058 [US3] Implement metadata context formatting for LLM in backend/src/services/llm_service.py
- [X] T059 [US3] Implement natural language to SQL generation in backend/src/services/llm_service.py
- [X] T060 [US3] Add LLM error handling and graceful degradation in backend/src/services/llm_service.py

### Natural Language API

- [X] T061 [US3] Create NaturalQueryRequest/Response models in backend/src/models/query.py
- [X] T062 [US3] Implement POST /api/v1/dbs/{name}/query/natural endpoint in backend/src/api/v1/queries.py
- [X] T063 [US3] Add SQL validation for generated queries in backend/src/api/v1/queries.py

### Frontend Components - Natural Language

- [X] T064 [P] [US3] Create NaturalQueryInput component in frontend/src/components/query/NaturalQueryInput.tsx
- [X] T065 [US3] Add generated SQL confirmation dialog in frontend/src/components/query/NaturalQueryInput.tsx
- [X] T066 [US3] Add natural language query UI to DatabasePage in frontend/src/pages/DatabasePage.tsx

### Polish & Cross-Cutting Concerns

- [X] T067 [P] Add connection string redaction in API responses in backend/src/models/database.py
- [X] T068 [P] Implement metadata refresh functionality in backend/src/services/metadata_service.py
- [X] T069 [P] Add query result export (CSV/JSON) in backend/src/services/query_service.py
- [X] T070 [P] Add loading states and error messages in frontend components
- [X] T071 [P] Add responsive design adjustments in frontend/src/components/
- [X] T072 [P] Add keyboard shortcuts in frontend/src/pages/DatabasePage.tsx
- [X] T073 Update README.md with setup and usage instructions
- [X] T074 Run quickstart.md validation to ensure setup guide is accurate
- [X] T075 Final code cleanup and refactoring

**Checkpoint**: All features complete. Users can manage databases, execute SQL queries, and use natural language to generate queries.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Infrastructure + US1)**: No dependencies - can start immediately
- **Phase 2 (US2 - SQL Queries)**: Depends on Phase 1 completion - requires database connections
- **Phase 3 (US3 - Natural Language + Polish)**: Depends on Phase 2 completion - requires query infrastructure

### Within Each Phase

**Phase 1**:
- Backend setup (T001-T004) can run in parallel
- Core infrastructure (T005-T009) depends on backend setup
- Data models (T010-T012) can run in parallel after core infrastructure
- Services (T013-T018) depend on data models
- API endpoints (T019-T025) depend on services
- Frontend setup (T026-T031) can run in parallel with backend
- Frontend types (T032-T033) depend on backend models
- Frontend components (T034-T038) can run in parallel after types
- Frontend pages (T039-T041) depend on components

**Phase 2**:
- Query models (T042) can start after Phase 1
- Query service (T043-T047) depends on models
- API endpoints (T048-T051) depend on service
- Frontend components (T052-T054) can run in parallel
- Frontend integration (T055-T056) depends on components

**Phase 3**:
- LLM service (T057-T060) can run in parallel
- Natural language API (T061-T063) depends on LLM service
- Frontend components (T064-T066) can run in parallel
- Polish tasks (T067-T075) can run in parallel after all features

### Parallel Opportunities

**Phase 1 Parallel Batch 1**:
- T001, T002, T003, T004 (backend setup)
- T026, T027, T028, T029, T030, T031 (frontend setup)

**Phase 1 Parallel Batch 2** (after setup):
- T005, T006, T007, T008, T009 (core infrastructure)

**Phase 1 Parallel Batch 3** (after infrastructure):
- T010, T011, T012 (data models)

**Phase 1 Parallel Batch 4** (after models):
- T032, T033 (frontend types)
- T034, T035, T036, T037, T038 (frontend components)

**Phase 2 Parallel Batch**:
- T052, T053, T054 (frontend components)

**Phase 3 Parallel Batch**:
- T057, T058, T059, T060 (LLM service iterations)
- T064 (frontend component)
- T067, T068, T069, T070, T071, T072 (polish tasks)

---

## Implementation Strategy

### MVP First (Phase 1 Only)

1. Complete Phase 1: Infrastructure + Database Connections
2. **STOP and VALIDATE**: Test adding databases and viewing metadata
3. Deploy/demo database management MVP

### Incremental Delivery

1. **Iteration 1 (Phase 1)**: Database connection management → Deploy/Demo (MVP!)
2. **Iteration 2 (Phase 2)**: Add SQL query execution → Deploy/Demo
3. **Iteration 3 (Phase 3)**: Add natural language queries → Deploy/Demo (Complete!)

Each iteration adds value without breaking previous functionality.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each phase should be independently completable and testable
- Verify backend APIs work with curl or Swagger UI before frontend integration
- Commit after each task or logical group
- Stop at any checkpoint to validate phase independently
- Total: 75 tasks across 3 phases
