# Research: Database Query Tool

**Feature**: Database Query Tool (001-db-query)
**Date**: 2026-01-07
**Purpose**: Research technology choices and best practices for implementation

## Overview

This document captures research findings for the Database Query Tool implementation. Key areas investigated include database connection handling, SQL parsing/validation, metadata extraction, LLM integration for natural language to SQL, and frontend patterns.

---

## 1. Database Connection Management

### Decision: Use SQLAlchemy with dynamic engine creation

**Rationale**:
- SQLAlchemy is the de facto standard for Python database connectivity
- Supports MySQL, PostgreSQL, and SQLite out of the box
- Connection pooling built-in
- Excellent type annotation support with SQLAlchemy 2.0
- Works well with Pydantic for data modeling

**Alternatives Considered**:
- **asyncpg/aiomysql**: Async-first but adds complexity; not needed for single-user tool
- **psycopg2/mysql-client directly**: Too low-level, reinvents connection management
- **databases library**: Good for async but SQLAlchemy 2.0 makes it less necessary

**Implementation Notes**:
- Create engines dynamically per stored database connection
- Store connection strings encrypted at rest (consider using cryptography library)
- Test connection on add, reuse engines for subsequent queries
- Support connection string formats: `postgresql://`, `mysql://`, `sqlite://`

---

## 2. SQL Parsing and Validation

### Decision: Use sqlglot for SQL parsing and validation

**Rationale**:
- sqlglot is a pure Python SQL parser, transpiler, and optimizer
- Supports MySQL, PostgreSQL, SQLite dialects
- Can parse SQL and detect statement types (SELECT vs others)
- Can validate syntax without executing
- Can add LIMIT clauses via AST manipulation
- Lightweight, no heavy dependencies

**Alternatives Considered**:
- **sqlparse**: Simpler but less powerful for AST manipulation
- **moz-sql-parser**: Less maintained, limited dialect support
- **Database-native validation**: Would require executing queries, not safe for validation-only

**Implementation Notes**:
- Parse user SQL with sqlglot using the appropriate dialect
- Check if the parsed statement is a SELECT expression
- If no LIMIT clause, use sqlglot to add `LIMIT 1000`
- Provide helpful error messages from parse errors
- Transpile between dialects if needed (e.g., for natural language generation)

---

## 3. Metadata Extraction

### Decision: Use Information Schema queries + LLM-assisted JSON transformation

**Rationale**:
- Information Schema is ANSI SQL standard for metadata
- MySQL, PostgreSQL, SQLite all support it (with minor variations)
- Get raw metadata via standard queries, then use LLM to structure
- LLM can normalize differences between database types
- Caching in SQLite avoids repeated queries

**Information Schema Queries**:
```sql
-- Tables and views
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema IN ('public', 'dbo') OR table_schema = database();

-- Columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = ?
ORDER BY ordinal_position;

-- Indexes (if available)
SELECT index_name, column_name
FROM information_schema.statistics
WHERE table_name = ?
ORDER BY index_name, seq_in_index;
```

**Alternatives Considered**:
- **Database-specific introspection APIs**: More code to maintain per database type
- **Full ORM introspection**: Overkill, we don't need full schema modeling

**Implementation Notes**:
- Fetch metadata on initial connection, cache in SQLite
- Use zai-sdk to convert raw metadata to structured JSON
- Store table schemas as JSON for quick retrieval
- Provide "refresh metadata" option to update cache

---

## 4. Natural Language to SQL

### Decision: Use zai-sdk with metadata context

**Rationale**:
- zai-sdk is specified in requirements
- Can send database schema as context for accurate SQL generation
- Supports multiple dialects via sqlglot integration
- Returns generated SQL that can be validated before execution

**Implementation Pattern**:
```python
prompt = f"""
Generate a SQL query for: {user_query}

Available tables:
{formatted_metadata}

Database type: {db_type}
Rules:
- Only SELECT queries allowed
- If no LIMIT specified, add LIMIT 1000
"""

generated_sql = zai_sdk.generate(prompt)
```

**Alternatives Considered**:
- **OpenAI API directly**: Would require custom prompt engineering
- **LangChain with SQLDatabaseToolkit**: Heavy dependency for this use case
- **Text2SQL specialized libraries**: Less flexible for custom requirements

**Implementation Notes**:
- Format metadata as clean, readable text for LLM context
- Include table names, column names, types, and relationships
- Validate generated SQL with sqlglot before showing user
- Allow user to edit generated SQL before execution
- Handle LLM failures gracefully (show error, fall back to manual SQL)

---

## 5. JSON camelCase Conversion

### Decision: Use Pydantic's `alias` generator with `to_camel` function

**Rationale**:
- Pydantic v2 has built-in support for field aliases
- Can automatically convert snake_case field names to camelCase in JSON
- Consistent with Constitution Principle IV
- No custom serialization logic needed

**Implementation**:
```python
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True
    )
```

**Alternatives Considered**:
- **Custom JSON encoder**: More maintenance, error-prone
- **Frontend conversion**: Inconsistent, violates constitution

---

## 6. CORS Configuration

### Decision: Use FastAPI CORSMiddleware with allow all origins

**Rationale**:
- Spec requires "allow all origin"
- Simple configuration for development tool
- Single-user context reduces security concerns

**Implementation**:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 7. Frontend Patterns

### Decision: Use refine 5 framework with Ant Design components

**Rationale**:
- refine 5 is designed for admin/data-heavy applications
- Built-in data providers, hooks for CRUD operations
- Ant Design components for consistent UI
- Monaco Editor for SQL editing with syntax highlighting
- TypeScript-first with excellent type safety

**Key Patterns**:
- Use `useList` hook for database list
- Use `useShow` hook for database detail
- Custom routes for query execution
- Monacon Editor for SQL input
- Ant Design Table for results display

**Alternatives Considered**:
- **Raw React + generic UI library**: More boilerplate, less structure
- **Material-UI**: Less suited for data-heavy admin interfaces

---

## 8. Configuration Management

### Decision: Store config in ~/.db_query/config.toml, API key in environment

**Rationale**:
- User home directory is standard for app config
- TOML is human-readable and editable
- API key in env var for security (don't commit to git)
- Easy to override for development

**Implementation**:
```python
from pathlib import Path
import tomli

CONFIG_DIR = Path.home() / ".db_query"
CONFIG_FILE = CONFIG_DIR / "config.toml"
DATABASE_FILE = CONFIG_DIR / "db_query.db"

config = {
    "api_key": os.getenv("ZAI_API_KEY", "default-key"),
    "database_path": str(DATABASE_FILE),
    "log_level": "INFO"
}
```

---

## 9. Error Handling Strategy

### Decision: Structured error responses with detailed messages

**Rationale**:
- Users need clear feedback on what went wrong
- Distinguish between connection errors, SQL errors, and system errors
- Include actionable suggestions when possible

**Error Response Format** (camelCase):
```json
{
  "success": false,
  "error": {
    "code": "SQL_SYNTAX_ERROR",
    "message": "Unexpected token near line 3, column 5",
    "details": "Expected FROM clause but found ';'"
  }
}
```

---

## 10. OpenAPI Documentation

### Decision: Auto-generate from Pydantic models with FastAPI

**Rationale**:
- FastAPI automatically generates OpenAPI schema
- Pydantic models document request/response shapes
- Swagger UI available at /docs
- Redoc available at /redoc
- No separate documentation maintenance

---

## Summary

All technical decisions align with:
- **Constitution requirements**: Python type hints, Pydantic models, camelCase JSON
- **User requirements**: MySQL/PostgreSQL/SQLite support, natural language queries
- **Performance goals**: Sub-2s queries, efficient caching
- **Security**: Read-only SELECT enforcement, input validation

**Ready for Phase 1**: Design data models, API contracts, and quickstart guide.
