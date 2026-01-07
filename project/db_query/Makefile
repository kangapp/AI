.PHONY: all install dev stop stop-backend stop-frontend lint lint-fix format check test test-cov run backend-run frontend-run clean help

# Default target
all: install

# Install dependencies
install:
	@echo "Installing backend dependencies..."
	cd backend && uv sync
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

# Development setup (runs servers in background)
dev:
	@echo "Starting development servers..."
	@make -j2 backend-run frontend-run

# Run backend server
backend-run:
	@echo "Starting backend server on http://localhost:8000"
	cd backend && uv run uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload

# Run frontend server
frontend-run:
	@echo "Starting frontend server on http://localhost:5173"
	cd frontend && npm run dev

# Stop all servers
stop:
	@echo "Stopping all development servers..."
	@pkill -f "uvicorn.*8000" || true
	@pkill -f "vite" || true
	@lsof -ti:8000 | xargs kill -9 2>/dev/null || true
	@lsof -ti:5173 | xargs kill -9 2>/dev/null || true
	@echo "All servers stopped"

# Stop backend server
stop-backend:
	@echo "Stopping backend server..."
	@pkill -f "uvicorn.*8000" || true
	@lsof -ti:8000 | xargs kill -9 2>/dev/null || true
	@echo "Backend server stopped"

# Stop frontend server
stop-frontend:
	@echo "Stopping frontend server..."
	@pkill -f "vite" || true
	@lsof -ti:5173 | xargs kill -9 2>/dev/null || true
	@echo "Frontend server stopped"

# Lint code
lint:
	@echo "Running linters..."
	cd backend && uv run ruff check src/
	cd backend && uv run mypy src/
	cd frontend && npm run lint

# Fix linting issues
lint-fix:
	@echo "Fixing linting issues..."
	cd backend && uv run ruff check --fix src/
	cd backend && uv run ruff format src/
	cd frontend && npm run lint:fix

# Format code
format:
	@echo "Formatting code..."
	cd backend && uv run ruff format src/
	cd frontend && npm run format

# Run type checking
check:
	@echo "Running type checks..."
	cd backend && uv run mypy src/

# Run tests
test:
	@echo "Running tests..."
	cd backend && uv run pytest

# Run tests with coverage
test-cov:
	@echo "Running tests with coverage..."
	cd backend && uv run pytest --cov=src --cov-report=html

# Run API
run: backend-run

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	cd backend && rm -rf .venv .pytest_cache .ruff_cache .coverage htmlcov
	cd frontend && rm -rf node_modules dist .vite
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true

# Database operations
db-init:
	@echo "Initializing SQLite database..."
	@mkdir -p ~/.db_query
	@touch ~/.db_query/db_query.db

db-clean:
	@echo "Cleaning database..."
	@rm -f ~/.db_query/db_query.db

db-reset: db-clean db-init
	@echo "Database reset complete"

# Help
help:
	@echo "Available targets:"
	@echo "  install         - Install all dependencies"
	@echo "  dev             - Start both backend and frontend servers"
	@echo "  stop            - Stop all development servers"
	@echo "  stop-backend    - Stop backend server only"
	@echo "  stop-frontend   - Stop frontend server only"
	@echo "  backend-run     - Start backend server only"
	@echo "  frontend-run    - Start frontend server only"
	@echo "  lint            - Run linters"
	@echo "  lint-fix        - Fix linting issues"
	@echo "  format          - Format code"
	@echo "  check           - Run type checking"
	@echo "  test            - Run tests"
	@echo "  test-cov        - Run tests with coverage"
	@echo "  run             - Alias for backend-run"
	@echo "  clean           - Clean build artifacts"
	@echo "  db-init         - Initialize SQLite database"
	@echo "  db-clean        - Remove database file"
	@echo "  db-reset        - Reset database"
	@echo "  help            - Show this help message"
