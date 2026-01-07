# Implementation Plan: Database Query Tool

**Branch**: `001-db-query` | **Date**: 2026-01-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-db-query/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Database Query Tool 是一个 Web 应用，允许用户添加数据库连接，浏览数据库元数据（表和视图），通过 SQL 查询或自然语言查询数据。技术栈采用后端 Python/FastAPI + sqlglot/zai-sdk，前端 React/refine 5 + Tailwind/Ant Design + Monaco Editor。数据存储使用 SQLite（~/.db_query/db_query.db），API 支持 CORS，所有响应使用 camelCase JSON 格式。

## Technical Context

**Language/Version**: Python 3.14+, TypeScript 5+
**Primary Dependencies**:
  - Backend: FastAPI, uv, sqlglot, zai-sdk, Pydantic, SQLAlchemy
  - Frontend: React, refine 5, Tailwind CSS, Ant Design, Monaco Editor
**Storage**: SQLite (~/.db_query/db_query.db) for metadata; external databases for user queries
**Testing**: pytest (backend), Vitest/Jest (frontend)
**Target Platform**: Web browser (modern browsers)
**Project Type**: web (backend + frontend)
**Performance Goals**:
  - SQL query validation: <100ms
  - Query execution: <2s for typical queries (per spec)
  - Metadata fetch: <5s for large databases
  - Frontend table render: <1s for 1000 rows (per spec)
**Constraints**:
  - Read-only queries (SELECT only)
  - Default LIMIT 1000 on queries
  - Strict type annotations required
  - camelCase JSON output (Constitution Principle IV)
**Scale/Scope**:
  - Single-user, single-page application
  - Support 10+ database connections per user
  - 3 database types: MySQL, PostgreSQL, SQLite

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Ergonomic Python Style ✅
- Backend uses Python 3.14+ with modern features
- FastAPI + Pydantic naturally aligns with ergonomic patterns
- Code will follow PEP 8 with emphasis on readability

### Principle II: Strict Type Annotations ✅
- Python: All functions use type hints (mypy strict mode)
- TypeScript: Frontend uses strict mode
- Pydantic models enforce type safety at runtime

### Principle III: Pydantic Data Models ✅
- All API request/response models use Pydantic BaseModel
- Domain models for database connections, metadata, queries use Pydantic
- Auto-generates OpenAPI documentation

### Principle IV: camelCase JSON Convention ✅
- All API responses use camelCase (Pydantic alias support)
- Consistent with JavaScript/TypeScript frontend conventions

### Principle V: Open Access Policy ✅
- No authentication implemented
- All endpoints publicly accessible
- Matches spec requirements

**Gate Status**: ✅ PASSED - No violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-db-query/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── api/
│   │   ├── __init__.py
│   │   ├── main.py           # FastAPI application entry
│   │   ├── deps.py           # Dependencies (database, config)
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── databases.py  # Database endpoints
│   │       └── queries.py    # Query endpoints
│   ├── models/
│   │   ├── __init__.py
│   │   ├── database.py       # Database connection models
│   │   ├── metadata.py       # Table/View metadata models
│   │   └── query.py          # Query and result models
│   ├── services/
│   │   ├── __init__.py
│   │   ├── db_service.py     # Database connection management
│   │   ├── metadata_service.py  # Metadata extraction
│   │   ├── query_service.py  # Query execution and validation
│   │   └── llm_service.py    # Natural language to SQL
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py         # Configuration (API key, paths)
│   │   ├── sqlite_db.py      # SQLite storage layer
│   │   └── sql_parser.py     # SQL validation using sqlglot
│   └── lib/
│       ├── __init__.py
│       └── json_encoder.py   # camelCase JSON encoding utilities
├── tests/
│   ├── contract/
│   │   ├── test_databases_api.py
│   │   └── test_queries_api.py
│   ├── integration/
│   │   ├── test_query_flow.py
│   │   └── test_metadata_sync.py
│   └── unit/
│       ├── test_sql_parser.py
│       └── test_llm_service.py
├── pyproject.toml
└── uv.lock

frontend/
├── src/
│   ├── components/
│   │   ├── database/
│   │   │   ├── DatabaseList.tsx
│   │   │   ├── AddDatabaseForm.tsx
│   │   │   └── DatabaseDetail.tsx
│   │   ├── query/
│   │   │   ├── SqlEditor.tsx      # Monaco Editor wrapper
│   │   │   ├── NaturalQueryInput.tsx
│   │   │   ├── QueryResults.tsx    # Table display
│   │   │   └── QueryHistory.tsx
│   │   └── metadata/
│   │       ├── TableList.tsx
│   │       └── TableSchema.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   └── DatabasePage.tsx
│   ├── services/
│   │   └── api.ts                # API client with TypeScript types
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces
│   ├── App.tsx
│   └── main.tsx
├── tests/
│   ├── components/
│   └── services/
├── package.json
├── tsconfig.json
└── vite.config.ts
```

**Structure Decision**: Web application structure (Option 2) selected because the feature has both backend (FastAPI) and frontend (React) components. Backend manages database connections and query execution; frontend provides UI for database management and querying.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations - this section is not applicable.
