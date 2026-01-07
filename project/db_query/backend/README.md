# DB Query Backend

Backend service for the Database Query Tool.

## Features

- Database connection management
- Metadata extraction and caching
- SQL query validation and execution
- Natural language to SQL generation

## Development

### Setup

```bash
uv sync
```

### Run

```bash
uv run uvicorn src.api.main:app --reload
```

The API will be available at http://localhost:8000

### API Documentation

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
