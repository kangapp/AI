# Data Model: Database Query Tool

**Feature**: Database Query Tool (001-db-query)
**Date**: 2026-01-07
**Purpose**: Define data entities and their relationships

## Overview

This document describes the data models for the Database Query Tool. The system stores:
1. Database connections (connection strings, metadata)
2. Cached table and view metadata
3. Query history

All models use Pydantic for validation and serialization with camelCase JSON output.

---

## Storage Schema

### SQLite Schema (~/.db_query/db_query.db)

```sql
-- Database connections
CREATE TABLE databases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    db_type TEXT NOT NULL,  -- 'mysql', 'postgresql', 'sqlite'
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_connected_at TIMESTAMP,
    metadata_json TEXT,  -- Cached metadata as JSON
    is_active BOOLEAN NOT NULL DEFAULT 1
);

-- Query history
CREATE TABLE query_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    database_id INTEGER NOT NULL,
    query_type TEXT NOT NULL,  -- 'sql' or 'natural'
    input_text TEXT NOT NULL,  -- Original SQL or natural language prompt
    generated_sql TEXT,  -- Generated SQL (for natural language queries)
    executed_sql TEXT,  -- Final SQL executed (with LIMIT added if needed)
    row_count INTEGER,
    execution_time_ms INTEGER,
    status TEXT NOT NULL,  -- 'success', 'error'
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (database_id) REFERENCES databases(id) ON DELETE CASCADE
);

CREATE INDEX idx_query_history_db_id ON query_history(database_id);
CREATE INDEX idx_query_history_created_at ON query_history(created_at DESC);
```

---

## Pydantic Models

### Base Model

All models inherit from a base model that configures camelCase aliases:

```python
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from datetime import datetime
from typing import Literal

class CamelModel(BaseModel):
    """Base model with camelCase JSON output."""
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True
    )
```

---

### Database Models

#### DatabaseConnection

Represents a stored database connection.

```python
class DatabaseConnection(CamelModel):
    """A database connection configuration."""
    id: int
    name: str
    url: str  # Connection string (credentials partially redacted in responses)
    db_type: Literal["mysql", "postgresql", "sqlite"]
    created_at: datetime
    last_connected_at: datetime | None = None
    is_active: bool = True
```

#### DatabaseCreateRequest

Request model for creating a new database connection.

```python
class DatabaseCreateRequest(CamelModel):
    """Request to create a new database connection."""
    name: str  # User-friendly name, must be unique
    url: str  # Full connection string
```

#### DatabaseDetail

Database connection with cached metadata.

```python
class DatabaseDetail(DatabaseConnection):
    """Database connection with metadata."""
    tables: list["TableMetadata"] = []
    views: list["ViewMetadata"] = []
    metadata_updated_at: datetime | None = None
```

#### DatabaseListResponse

Response model for listing all databases.

```python
class DatabaseListResponse(CamelModel):
    """Response containing all database connections."""
    databases: list[DatabaseConnection]
    total_count: int
```

---

### Metadata Models

#### ColumnMetadata

Column information within a table or view.

```python
class ColumnMetadata(CamelModel):
    """Column metadata."""
    name: str
    data_type: str  # Native database type (VARCHAR, INTEGER, etc.)
    is_nullable: bool
    default_value: str | None = None
    is_primary_key: bool = False
```

#### TableMetadata

Table structure information.

```python
class TableMetadata(CamelModel):
    """Table metadata."""
    name: str
    schema: str | None = None  # Schema name (e.g., 'public', 'dbo')
    columns: list[ColumnMetadata]
    row_count_estimate: int | None = None
    description: str | None = None
```

#### ViewMetadata

View structure information.

```python
class ViewMetadata(CamelModel):
    """View metadata."""
    name: str
    schema: str | None = None
    columns: list[ColumnMetadata]
    definition: str | None = None  # View definition SQL (if available)
    description: str | None = None
```

#### MetadataResponse

Response containing all metadata for a database.

```python
class MetadataResponse(CamelModel):
    """Response with database metadata."""
    database_name: str
    db_type: str
    tables: list[TableMetadata]
    views: list[ViewMetadata]
    updated_at: datetime
```

---

### Query Models

#### QueryRequest

Request to execute a SQL query.

```python
class QueryRequest(CamelModel):
    """Request to execute a SQL query."""
    sql: str  # The SQL query to execute
```

#### NaturalQueryRequest

Request to generate and execute SQL from natural language.

```python
class NaturalQueryRequest(CamelModel):
    """Request to generate SQL from natural language."""
    prompt: str  # Natural language query description
    execute_immediately: bool = False  # If True, execute without confirmation
```

#### QueryResult

Single row of query results (dynamic columns).

```python
from typing import Any

class QueryResultRow(CamelModel):
    """A single row in query results."""
    # Dynamic columns represented as dict
    __root__: dict[str, Any]
```

#### QueryResponse

Response from a successful query execution.

```python
class QueryResponse(CamelModel):
    """Response from query execution."""
    success: bool = True
    executed_sql: str  # The SQL that was executed (may have LIMIT added)
    row_count: int
    execution_time_ms: int
    columns: list[ColumnMetadata]  # Column definitions
    rows: list[dict[str, Any]]  # Result rows
    has_limit: bool  # True if LIMIT was present or added
    limit_value: int | None  # The LIMIT value used
```

#### NaturalQueryResponse

Response from natural language query generation.

```python
class NaturalQueryResponse(CamelModel):
    """Response from natural language to SQL generation."""
    success: bool = True
    generated_sql: str  # The generated SQL query
    explanation: str | None = None  # Optional explanation of the query
    is_valid: bool  # Whether the SQL is syntactically valid
    validation_message: str | None = None  # Validation error if invalid
```

---

### Error Models

#### ErrorDetail

Error information in error responses.

```python
class ErrorDetail(CamelModel):
    """Error detail."""
    code: str  # Error code (e.g., "SQL_SYNTAX_ERROR", "CONNECTION_FAILED")
    message: str  # Human-readable error message
    details: str | None = None  # Additional error details
```

#### ErrorResponse

Standard error response format.

```python
class ErrorResponse(CamelModel):
    """Error response."""
    success: bool = False
    error: ErrorDetail
```

---

### Query History Models

#### QueryHistoryItem

Item in query history.

```python
class QueryHistoryItem(CamelModel):
    """A query history item."""
    id: int
    database_id: int
    database_name: str
    query_type: Literal["sql", "natural"]
    input_text: str
    executed_sql: str
    row_count: int | None
    execution_time_ms: int | None
    status: Literal["success", "error"]
    error_message: str | None = None
    created_at: datetime
```

#### QueryHistoryResponse

Response containing query history.

```python
class QueryHistoryResponse(CamelModel):
    """Query history response."""
    items: list[QueryHistoryItem]
    total_count: int
    page: int
    page_size: int
```

---

## Model Relationships

```
DatabaseConnection (1) ----< (1) QueryHistoryItem
         |
         | (1)
         |
         +----< (many) TableMetadata
         |
         +----< (many) ViewMetadata
                         |
                         | (1)
                         |
                         +----< (many) ColumnMetadata
```

---

## Type Aliases for Convenience

```python
# Common type aliases
DatabaseType = Literal["mysql", "postgresql", "sqlite"]
QueryType = Literal["sql", "natural"]
QueryStatus = Literal["success", "error"]
```

---

## Notes

1. **All models use camelCase for JSON serialization** per Constitution Principle IV
2. **All fields are typed** per Constitution Principle II
3. **Validation is automatic** through Pydantic
4. **OpenAPI docs are auto-generated** from these models in FastAPI
5. **SQL results use dynamic dicts** to handle arbitrary column structures
