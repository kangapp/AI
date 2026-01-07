# Quickstart Guide: Database Query Tool

**Feature**: Database Query Tool (001-db-query)
**Date**: 2026-01-07

## Prerequisites

- Python 3.14+
- Node.js 20+
- uv (Python package manager)
- A database to connect to (MySQL, PostgreSQL, or SQLite)

---

## 1. Clone and Setup

```bash
# Navigate to project directory
cd /Users/liufukang/workplace/AI

# Ensure we're on the feature branch
git checkout 001-db-query
```

---

## 2. Backend Setup

### 2.1 Install Dependencies

```bash
cd backend

# Install dependencies with uv
uv sync

# Activate virtual environment (optional, uv auto-activates)
source .venv/bin/activate  # macOS/Linux
# or
.venv\Scripts\activate     # Windows
```

### 2.2 Configure Environment

Create a `.env` file in the backend directory:

```bash
# Zai SDK API Key
ZAI_API_KEY=6e0d21390e624cc1b9e2ddfdd66cedb5.Gq1owoZCY5wuSQYV

# Database storage path (default: ~/.db_query/db_query.db)
DB_PATH=~/.db_query/db_query.db

# Log level
LOG_LEVEL=INFO
```

### 2.3 Run Development Server

```bash
# Start FastAPI server with auto-reload
uv run uvicorn src.api.main:app --reload --port 8000
```

Server will start at http://localhost:8000

- API Docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## 3. Frontend Setup

### 3.1 Install Dependencies

```bash
cd ../frontend

# Install with npm/yarn/pnpm
npm install
# or
yarn install
# or
pnpm install
```

### 3.2 Configure API Endpoint

Create `.env.development`:

```bash
# API base URL
VITE_API_URL=http://localhost:8000
```

### 3.3 Run Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Frontend will start at http://localhost:5173 (Vite default)

---

## 4. Quick Test

### 4.1 Add a Database Connection

Using curl:

```bash
curl -X PUT http://localhost:8000/api/v1/dbs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test DB",
    "url": "sqlite:///path/to/test.db"
  }'
```

Or use Swagger UI at http://localhost:8000/docs

### 4.2 List Databases

```bash
curl http://localhost:8000/api/v1/dbs
```

### 4.3 Get Database Metadata

```bash
curl http://localhost:8000/api/v1/dbs/Test DB
```

### 4.4 Execute a Query

```bash
curl -X POST http://localhost:8000/api/v1/dbs/Test DB/query \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "SELECT * FROM users LIMIT 10"
  }'
```

### 4.5 Natural Language Query

```bash
curl -X POST http://localhost:8000/api/v1/dbs/Test DB/query/natural \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Show me all users",
    "executeImmediately": true
  }'
```

---

## 5. Project Structure Reference

```
project/db_query/
├── backend/
│   ├── src/
│   │   ├── api/           # FastAPI endpoints
│   │   ├── models/        # Pydantic models
│   │   ├── services/      # Business logic
│   │   ├── core/          # Config, DB, utilities
│   │   └── lib/           # Shared utilities
│   ├── tests/             # pytest tests
│   ├── pyproject.toml     # Python dependencies
│   └── .env               # Environment variables
│
└── frontend/
    ├── src/
    │   ├── components/    # React components
    │   ├── pages/         # Page components
    │   ├── services/      # API client
    │   └── types/         # TypeScript types
    ├── tests/             # Vitest tests
    ├── package.json       # Node dependencies
    └── vite.config.ts     # Vite configuration
```

---

## 6. Development Workflow

### 6.1 Backend Development

```bash
# Run tests
uv run pytest

# Type checking
uv run mypy src

# Linting
uv run ruff check src

# Format code
uv run ruff format src
```

### 6.2 Frontend Development

```bash
# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint

# Format code
npm run format
```

### 6.3 Running Both Services

For development, run backend and frontend in separate terminals:

```bash
# Terminal 1: Backend
cd backend && uv run uvicorn src.api.main:app --reload

# Terminal 2: Frontend
cd frontend && npm run dev
```

---

## 7. Common Issues

### Issue: CORS errors

**Solution**: Backend should have CORS middleware configured with `allow_origins=["*"]`

### Issue: "Database not found"

**Solution**: Ensure the database connection was successfully added. Check with `GET /api/v1/dbs`

### Issue: SQL syntax errors

**Solution**: Use the `/query/natural` endpoint to generate SQL, then review before executing

### Issue: Metadata not showing

**Solution**: Call `GET /api/v1/dbs/{name}?refresh=true` to force metadata refresh

---

## 8. API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/dbs` | List all databases |
| PUT | `/api/v1/dbs` | Add new database |
| GET | `/api/v1/dbs/{name}` | Get database with metadata |
| DELETE | `/api/v1/dbs/{name}` | Delete database |
| POST | `/api/v1/dbs/{name}/query` | Execute SQL query |
| POST | `/api/v1/dbs/{name}/query/natural` | Natural language to SQL |
| GET | `/api/v1/dbs/{name}/history` | Query history |

---

## 9. Next Steps

1. Implement backend services per data model specification
2. Implement frontend components using refine 5
3. Add error handling and user feedback
4. Write tests for critical paths
5. Deploy and monitor

For detailed implementation tasks, see `tasks.md` (generated by `/speckit.tasks`).
