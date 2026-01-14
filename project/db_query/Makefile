.PHONY: all install dev stop stop-backend stop-frontend lint lint-fix format check test test-cov run backend-run frontend-run clean help \
        build build-frontend prod deps-backend deps-frontend deps-update env-check env-setup health-verify logs dev-verify

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

# Environment setup and validation
env-check:
	@echo "Checking environment configuration..."
	@if [ ! -f backend/.env ]; then \
		echo "⚠️  backend/.env not found. Run 'make env-setup' to create it."; \
	else \
		echo "✅ backend/.env exists"; \
	fi
	@if [ ! -f frontend/.env.development ]; then \
		echo "⚠️  frontend/.env.development not found. Run 'make env-setup' to create it."; \
	else \
		echo "✅ frontend/.env.development exists"; \
	fi

env-setup:
	@echo "Setting up environment files..."
	@if [ ! -f backend/.env ]; then \
		echo "Creating backend/.env..."; \
		echo "ZAI_API_KEY=your_api_key_here" > backend/.env; \
		echo "DB_PATH=~/.db_query/db_query.db" >> backend/.env; \
		echo "LOG_LEVEL=INFO" >> backend/.env; \
		echo "✅ backend/.env created. Please update ZAI_API_KEY."; \
	else \
		echo "✅ backend/.env already exists"; \
	fi
	@if [ ! -f frontend/.env.development ]; then \
		echo "Creating frontend/.env.development..."; \
		echo "VITE_API_URL=http://localhost:8000" > frontend/.env.development; \
		echo "✅ frontend/.env.development created"; \
	else \
		echo "✅ frontend/.env.development already exists"; \
	fi

# Dependency management
deps-backend:
	@echo "Installing backend dependencies..."
	@cd backend && uv sync

deps-frontend:
	@echo "Installing frontend dependencies..."
	@cd frontend && npm install

deps-update:
	@echo "Updating backend dependencies..."
	@cd backend && uv sync --upgrade
	@echo "Updating frontend dependencies..."
	@cd frontend && npm update

# Build for production
build-frontend:
	@echo "Building frontend for production..."
	@cd frontend && npm run build
	@echo "✅ Frontend build complete: frontend/dist/"

build: build-frontend

# Production run
prod: build
	@echo "Starting production server..."
	@cd backend && uv run uvicorn src.api.main:app --host 0.0.0.0 --port 8000

# Health checks
health-verify:
	@echo "Verifying services health..."
	@curl -sf http://localhost:8000/docs > /dev/null && echo "✅ Backend API is running" || echo "❌ Backend API is not running"
	@curl -sf http://localhost:5173 > /dev/null && echo "✅ Frontend dev server is running" || echo "❌ Frontend dev server is not running"

# Development environment verification
dev-verify:
	@echo "Verifying development environment..."
	@echo "Checking Python version..."
	@cd backend && python --version | grep -E "Python 3\.(1[4-9]|[2-9][0-9])" && echo "✅ Python version OK" || echo "❌ Python 3.14+ required"
	@echo "Checking uv..."
	@which uv > /dev/null && echo "✅ uv installed" || echo "❌ uv not installed"
	@echo "Checking Node.js..."
	@which node > /dev/null && echo "✅ Node.js installed" || echo "❌ Node.js not installed"
	@echo "Checking npm..."
	@which npm > /dev/null && echo "✅ npm installed" || echo "❌ npm not installed"
	@$(MAKE) env-check

# Logs
logs:
	@echo "Recent backend logs (if running via file output):"
	@if [ -f backend/logs/app.log ]; then \
		tail -n 100 backend/logs/app.log; \
	else \
		echo "No log file found at backend/logs/app.log"; \
		echo "Logs are written to this file when LOG_FILE is set in backend/.env"; \
		echo "Add this line to backend/.env to enable file logging:"; \
		echo "  LOG_FILE=logs/app.log"; \
	fi

# Enhanced check target (both backend and frontend)
check:
	@echo "Running type checks..."
	@cd backend && uv run mypy src/
	@cd frontend && npm run type-check

# Help
help:
	@echo "Available targets:"
	@echo ""
	@echo "📦 Installation & Dependencies:"
	@echo "  install         - Install all dependencies (backend + frontend)"
	@echo "  deps-backend    - Install backend dependencies only"
	@echo "  deps-frontend   - Install frontend dependencies only"
	@echo "  deps-update     - Update all dependencies"
	@echo ""
	@echo "🚀 Development:"
	@echo "  dev             - Start both backend and frontend servers (background)"
	@echo "  backend-run     - Start backend server only (http://localhost:8000)"
	@echo "  frontend-run    - Start frontend server only (http://localhost:5173)"
	@echo "  stop            - Stop all development servers"
	@echo "  stop-backend    - Stop backend server only"
	@echo "  stop-frontend   - Stop frontend server only"
	@echo ""
	@echo "🏗️  Production:"
	@echo "  build           - Build frontend for production"
	@echo "  build-frontend  - Build frontend only"
	@echo "  prod            - Run production server (requires build)"
	@echo ""
	@echo "🔍 Code Quality:"
	@echo "  lint            - Run linters (backend + frontend)"
	@echo "  lint-fix        - Fix linting issues automatically"
	@echo "  format          - Format code (backend + frontend)"
	@echo "  check           - Run type checking (backend + frontend)"
	@echo ""
	@echo "🧪 Testing:"
	@echo "  test            - Run backend tests"
	@echo "  test-cov        - Run tests with coverage report"
	@echo ""
	@echo "🗄️  Database:"
	@echo "  db-init         - Initialize SQLite database"
	@echo "  db-clean        - Remove database file"
	@echo "  db-reset        - Reset database (clean + init)"
	@echo ""
	@echo "🔧 Environment & Verification:"
	@echo "  env-check       - Check if .env files exist"
	@echo "  env-setup       - Create .env files with defaults"
	@echo "  dev-verify      - Verify development environment setup"
	@echo "  health-verify   - Check if services are running"
	@echo "  logs            - Show recent logs (if available)"
	@echo ""
	@echo "🧹 Maintenance:"
	@echo "  clean           - Clean all build artifacts"
	@echo "  run             - Alias for backend-run"
	@echo "  help            - Show this help message"
	@echo ""
