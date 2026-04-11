# Docker + CI/CD 自动化部署实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在根目录创建统一的 docker-compose.yml 和 CI/CD 流程，实现选择性构建和自动化部署到自定义服务器。

**Architecture:** 混合方案 - 根目录统一 docker-compose.yml 编排 + GitHub Actions workflow 调度 + 各子项目提供 Dockerfile 和 .env.example

**Tech Stack:** Docker, docker-compose, GitHub Actions, SSH

---

## 文件结构

```
AI/
├── docker-compose.yml                    # [Task 1]
├── .dockerignore                         # [Task 1]
├── .github/
│   ├── workflows/
│   │   └── deploy.yml                   # [Task 2]
│   └── scripts/
│       ├── deploy.sh                     # [Task 3]
│       └── cleanup.sh                    # [Task 3]
└── project/
    ├── db_query/
    │   ├── Dockerfile                    # [Task 4]
    │   ├── .env.example                  # [Task 4]
    │   └── .dockerignore                # [Task 4]
    ├── simple-agent/
    │   ├── Dockerfile                    # [Task 5]
    │   ├── .env.example                  # [Task 5]
    │   └── .dockerignore                # [Task 5]
    ├── GenSlides/
    │   ├── Dockerfile                    # [Task 6]
    │   ├── .env.example                  # [Task 6]
    │   └── .dockerignore                # [Task 6]
    ├── llm-log-visualizer/
    │   ├── Dockerfile                    # [Task 7]
    │   ├── .env.example                  # [Task 7]
    │   └── .dockerignore                # [Task 7]
    ├── code-review-agent/
    │   ├── Dockerfile                    # [Task 8]
    │   ├── .env.example                  # [Task 8]
    │   └── .dockerignore                # [Task 8]
    └── raflow/
        ├── Dockerfile                    # [Task 9]
        ├── .env.example                  # [Task 9]
        └── .dockerignore                # [Task 9]
```

---

## Task 1: 根目录基础设施

**Files:**
- Create: `docker-compose.yml`
- Create: `.dockerignore`

- [ ] **Step 1: 创建 docker-compose.yml**

```yaml
version: '3.8'

services:
  db_query:
    build:
      context: ./project/db_query
      dockerfile: Dockerfile
    container_name: db_query
    restart: unless-stopped
    ports:
      - "8000:8000"
    env_file:
      - ./project/db_query/.env
    networks:
      - app_network

  simple_agent:
    build:
      context: ./project/simple-agent
      dockerfile: Dockerfile
    container_name: simple_agent
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - ./project/simple-agent/.env
    networks:
      - app_network

  gen_slides:
    build:
      context: ./project/GenSlides
      dockerfile: Dockerfile
    container_name: gen_slides
    restart: unless-stopped
    ports:
      - "8080:8080"
    env_file:
      - ./project/GenSlides/.env
    networks:
      - app_network

  llm_log_visualizer:
    build:
      context: ./project/llm-log-visualizer
      dockerfile: Dockerfile
    container_name: llm_log_visualizer
    restart: unless-stopped
    ports:
      - "5173:5173"
    env_file:
      - ./project/llm-log-visualizer/.env
    networks:
      - app_network

  code_review_agent:
    build:
      context: ./project/code-review-agent
      dockerfile: Dockerfile
    container_name: code_review_agent
    restart: unless-stopped
    ports:
      - "4000:4000"
    env_file:
      - ./project/code-review-agent/.env
    networks:
      - app_network

  raflow:
    build:
      context: ./project/raflow
      dockerfile: Dockerfile
    container_name: raflow
    restart: unless-stopped
    ports:
      - "1420:1420"
    env_file:
      - ./project/raflow/.env
    networks:
      - app_network

networks:
  app_network:
    driver: bridge
```

- [ ] **Step 2: 创建 .dockerignore**

```dockerignore
# Git
.git
.gitignore
.gitmodules

# Node_modules
project/*/node_modules
project/*/frontend/node_modules
project/*/dist

# Python 虚拟环境
project/*/.venv
project/*/venv

# IDE
.idea
.vscode
*.swp
*.swo

# 环境文件
.env
.env.*
!.env.example

# 文档和配置
*.md
!README.md
docs
*.log

# CI/CD (不上镜像)
.github
.github/workflows
.github/scripts

# Docker 相关
docker-compose*.yml
Dockerfile*
.dockerignore

# 测试
*_test.py
*.test.ts
*.spec.ts
__tests__
coverage

# OS
.DS_Store
Thumbs.db
```

- [ ] **Step 3: 提交**

```bash
git add docker-compose.yml .dockerignore
git commit -m "feat: add root docker-compose.yml and .dockerignore"
```

---

## Task 2: GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: 创建 .github/workflows/deploy.yml**

```yaml
name: Deploy Services

on:
  workflow_dispatch:
    inputs:
      project:
        type: choice
        options:
          - db_query
          - simple_agent
          - gen_slides
          - llm_log_visualizer
          - code_review_agent
          - raflow
        required: true
        description: 选择要部署的项目
  push:
    paths:
      - 'project/**'
      - 'docker-compose.yml'
      - '.github/workflows/**'
      - '.github/scripts/**'

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      project: ${{ steps.detect.outputs.project }}
    steps:
      - uses: actions/checkout@v4

      - name: 检测变更项目
        id: detect
        run: |
          if [ "${{ github.event.inputs.project }}" != "" ]; then
            echo "project=${{ github.event.inputs.project }}" >> $GITHUB_OUTPUT
          else
            changed=$(git diff --name-only ${{ github.event.before }} HEAD | cut -d/ -f2 | sort -u | head -1)
            echo "project=${changed}" >> $GITHUB_OUTPUT
          fi

      - name: 构建 Docker 镜像
        run: |
          docker-compose build ${{ steps.detect.outputs.project }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: 部署到服务器
        env:
          PROJECT: ${{ needs.build.outputs.project }}
          SERVER_HOST: ${{ secrets.SERVER_HOST }}
          SERVER_USER: ${{ secrets.SERVER_USER }}
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
        run: |
          mkdir -p ~/.ssh
          echo "$SSH_PRIVATE_KEY" > ~/.ssh/id_rsa
          chmod 600 ~/.ssh/id_rsa

          # 复制部署脚本和 compose 文件
          scp .github/scripts/deploy.sh ${SERVER_USER}@${SERVER_HOST}:/opt/app/
          scp docker-compose.yml ${SERVER_USER}@${SERVER_HOST}:/opt/app/

          # 执行部署 (包含清理)
          ssh ${SERVER_USER}@${SERVER_HOST} "
            cd /opt/app
            chmod +x deploy.sh
            ./deploy.sh ${PROJECT} up
          "
```

- [ ] **Step 2: 提交**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: add GitHub Actions deploy workflow"
```

---

## Task 3: 部署脚本

**Files:**
- Create: `.github/scripts/deploy.sh`
- Create: `.github/scripts/cleanup.sh`

- [ ] **Step 1: 创建 deploy.sh**

```bash
#!/bin/bash
set -e

PROJECT=${1:-""}
ACTION=${2:-"up"}

if [ -z "$PROJECT" ]; then
  echo "用法: ./deploy.sh <项目名> [up|down|restart]"
  exit 1
fi

echo "=== 部署项目: $PROJECT ==="

# 1. 服务器磁盘清理 (部署前)
echo ">>> 清理服务器旧镜像和悬空镜像..."
docker image prune -af --filter "dangling=true" 2>/dev/null || true

# 2. 停止旧容器 (如果存在)
echo ">>> 停止旧容器..."
docker-compose stop ${PROJECT} 2>/dev/null || true
docker-compose rm -f ${PROJECT} 2>/dev/null || true

# 3. 启动服务
echo ">>> 启动服务..."
docker-compose up -d ${PROJECT}

# 4. 等待服务启动
echo ">>> 等待服务启动..."
sleep 5

# 5. 容器内缓存清理 (启动后执行)
echo ">>> 清理容器内缓存..."
docker exec ${PROJECT} sh -c "
  # 通用清理
  rm -rf /tmp/* 2>/dev/null || true
  find /var/cache -type f -delete 2>/dev/null || true

  # Python 项目清理
  if command -v python3 &> /dev/null; then
    find /app -name '__pycache__' -type d -exec rm -rf {} + 2>/dev/null || true
    find /app -name '*.pyc' -delete 2>/dev/null || true
  fi

  # Node.js 项目清理
  if command -v npm &> /dev/null; then
    rm -rf /root/.npm/_cacache 2>/dev/null || true
    rm -rf /tmp/v8-compile-cache-* 2>/dev/null || true
  fi
"

echo "=== $PROJECT 部署完成 ==="
```

- [ ] **Step 2: 创建 cleanup.sh**

```bash
#!/bin/bash
# 服务器全面清理脚本 (可单独运行)

echo "=== 服务器清理开始 ==="

# 停止所有相关容器
docker-compose down 2>/dev/null || true

# 删除悬空镜像
echo ">>> 删除悬空镜像..."
docker image prune -af --filter "dangling=true"

# 删除未使用的镜像
echo ">>> 删除未使用的镜像..."
docker image prune -af

# 删除停止的容器
echo ">>> 删除已停止的容器..."
docker container prune -f

# 删除未使用的网络
echo ">>> 删除未使用的网络..."
docker network prune -f

echo "=== 清理完成 ==="
docker system df
```

- [ ] **Step 3: 提交**

```bash
git add .github/scripts/deploy.sh .github/scripts/cleanup.sh
git commit -m "feat: add deploy and cleanup scripts"
```

---

## Task 4: db_query 项目配置

**Files:**
- Create: `project/db_query/Dockerfile`
- Create: `project/db_query/.env.example`
- Create: `project/db_query/.dockerignore`

**分析:** db_query 是 Python 后端 + 前端项目，主入口是 `main.py`

- [ ] **Step 1: 创建 Dockerfile (Python 后端)**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt* ./
RUN pip install --no-cache-dir -r requirements.txt 2>/dev/null || \
    (pip install fastapi uvicorn && echo "Using default deps")

# 复制代码
COPY . .

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["python", "main.py"]
```

- [ ] **Step 2: 创建 .env.example**

```env
# 数据库配置
DATABASE_URL=sqlite:///./db_query.db

# API 配置
API_HOST=0.0.0.0
API_PORT=8000

# 前端配置
FRONTEND_URL=http://localhost:8000
```

- [ ] **Step 3: 创建 .dockerignore**

```dockerignore
# Python 缓存
__pycache__
*.pyc
*.pyo
.venv
*.egg-info

# 前端
frontend/node_modules
frontend/dist

# 测试
test_frontend.py
fixtures
temp_data
```

- [ ] **Step 4: 提交**

```bash
git add project/db_query/Dockerfile project/db_query/.env.example project/db_query/.dockerignore
git commit -m "feat(db_query): add Dockerfile and env.example"
```

---

## Task 5: simple-agent 项目配置

**Files:**
- Create: `project/simple-agent/Dockerfile`
- Create: `project/simple-agent/.env.example`
- Create: `project/simple-agent/.dockerignore`

**分析:** Bun + TypeScript 项目

- [ ] **Step 1: 创建 Dockerfile**

```dockerfile
FROM node:20-alpine

WORKDIR /app

# 安装 bun
RUN npm install -g bun

# 复制 package.json
COPY package.json ./
COPY bun.lock* ./

# 安装依赖
RUN bun install --frozen-lockfile

# 复制源码
COPY . .

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["bun", "run", "src/index.ts"]
```

- [ ] **Step 2: 创建 .env.example**

```env
# API 配置
API_PORT=3000
API_HOST=0.0.0.0

# 会话配置
SESSION_DIR=/app/.sessions
UPLOAD_DIR=/app/.uploads
```

- [ ] **Step 3: 创建 .dockerignore**

```dockerignore
# Bun
node_modules
.bun
.bun.lock

# 本地文件
.sessions
.uploads
*.lock

# 日志
*.log
```

- [ ] **Step 4: 提交**

```bash
git add project/simple-agent/Dockerfile project/simple-agent/.env.example project/simple-agent/.dockerignore
git commit -m "feat(simple-agent): add Dockerfile and env.example"
```

---

## Task 6: GenSlides 项目配置

**Files:**
- Create: `project/GenSlides/Dockerfile`
- Create: `project/GenSlides/.env.example`
- Create: `project/GenSlides/.dockerignore`

**分析:** Node.js 后端 + 前端项目

- [ ] **Step 1: 创建 Dockerfile**

```dockerfile
FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package.json ./
RUN npm install

# 复制源码
COPY . .

# 暴露端口
EXPOSE 8080

# 启动命令 (需要查看 package.json 确认启动命令)
CMD ["node", "backend/index.js"]
```

- [ ] **Step 2: 创建 .env.example**

```env
# 服务配置
PORT=8080
HOST=0.0.0.0

# 项目配置
PROJECTS_DIR=/app/projects
SLIDES_DIR=/app/slides
```

- [ ] **Step 3: 创建 .dockerignore**

```dockerignore
# 依赖
node_modules

# 前端
frontend/node_modules
frontend/dist

# 项目文件
projects
slides

# 日志
*.log
```

- [ ] **Step 4: 提交**

```bash
git add project/GenSlides/Dockerfile project/GenSlides/.env.example project/GenSlides/.dockerignore
git commit -m "feat(GenSlides): add Dockerfile and env.example"
```

---

## Task 7: llm-log-visualizer 项目配置

**Files:**
- Create: `project/llm-log-visualizer/Dockerfile`
- Create: `project/llm-log-visualizer/.env.example`
- Create: `project/llm-log-visualizer/.dockerignore`

**分析:** Vite + TypeScript 单页应用

- [ ] **Step 1: 创建 Dockerfile**

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
COPY package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 2: 创建 nginx.conf**

```nginx
server {
    listen 5173;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 3: 创建 .env.example**

```env
# Vite 配置
VITE_API_URL=http://localhost:8000/api
```

- [ ] **Step 4: 创建 .dockerignore**

```dockerignore
# 依赖
node_modules

# 构建输出
dist

# 开发文件
*.log
.env
.env.*
```

- [ ] **Step 5: 提交**

```bash
git add project/llm-log-visualizer/Dockerfile project/llm-log-visualizer/.env.example project/llm-log-visualizer/.dockerignore project/llm-log-visualizer/nginx.conf
git commit -m "feat(llm-log-visualizer): add Dockerfile, nginx.conf and env.example"
```

---

## Task 8: code-review-agent 项目配置

**Files:**
- Create: `project/code-review-agent/Dockerfile`
- Create: `project/code-review-agent/.env.example`
- Create: `project/code-review-agent/.dockerignore`

**分析:** Bun + TypeScript 项目

- [ ] **Step 1: 创建 Dockerfile**

```dockerfile
FROM node:20-alpine

WORKDIR /app

RUN npm install -g bun

COPY package.json ./
COPY bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .

EXPOSE 4000

CMD ["bun", "run", "src/index.ts"]
```

- [ ] **Step 2: 创建 .env.example**

```env
# API 配置
API_PORT=4000
API_HOST=0.0.0.0

# Claude API (敏感信息不提交)
ANTHROPIC_API_KEY=your_api_key_here
```

- [ ] **Step 3: 创建 .dockerignore**

```dockerignore
# Bun
node_modules
.bun
.bun.lock

# 本地文件
reviews
*.lock
*.log
```

- [ ] **Step 4: 提交**

```bash
git add project/code-review-agent/Dockerfile project/code-review-agent/.env.example project/code-review-agent/.dockerignore
git commit -m "feat(code-review-agent): add Dockerfile and env.example"
```

---

## Task 9: raflow 项目配置

**Files:**
- Create: `project/raflow/Dockerfile`
- Create: `project/raflow/.env.example`
- Create: `project/raflow/.dockerignore`

**分析:** Tauri (Rust + TypeScript)，需要先构建前端再打包

- [ ] **Step 1: 创建 Dockerfile**

```dockerfile
# 前端构建阶段
FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Tauri 构建阶段 (需要 Rust)
FROM rust:1.75-slim AS tauri-builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libwebkit2gtk-4.1-dev \
    libappindicator3-dev \
    librsvg2-dev \
    patchelf \
    && rm -rf /var/lib/apt/lists/*

COPY --from=frontend-builder /app/dist ./dist
COPY src-tauri ./src-tauri
COPY package.json pnpm-lock.yaml ./

RUN cargo build --release --manifest-path=src-tauri/Cargo.toml

# 运行阶段
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    libwebkit2gtk-4.1-0 \
    libappindicator3-1 \
    librsvg2-2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=tauri-builder /app/src-tauri/target/release/raflow ./raflow
COPY --from=frontend-builder /app/dist ./dist

EXPOSE 1420

CMD ["./raflow"]
```

- [ ] **Step 2: 创建 .env.example**

```env
# Raflow 配置
RAFT_HOST=0.0.0.0
RAFT_PORT=1420
```

- [ ] **Step 3: 创建 .dockerignore**

```dockerignore
# Rust 构建产物
src-tauri/target

# 前端依赖
node_modules

# 构建输出
dist

# 日志
*.log
progress.md
findings.md
```

- [ ] **Step 4: 提交**

```bash
git add project/raflow/Dockerfile project/raflow/.env.example project/raflow/.dockerignore
git commit -m "feat(raflow): add Dockerfile and env.example"
```

---

## 实施后配置

完成所有任务后，需要在 GitHub 仓库设置以下 Secrets:

| Secret 名称 | 说明 |
|-------------|------|
| `SERVER_HOST` | 服务器 IP 地址 |
| `SERVER_USER` | SSH 用户名 |
| `SSH_PRIVATE_KEY` | SSH 私钥 |

**服务器端准备:**
```bash
# 在服务器上创建部署目录
mkdir -p /opt/app

# 确保 docker 和 docker-compose 已安装
```

---

## 依赖关系

```
Task 1 (根目录基础设施)
    │
    ├── Task 2 (GitHub Actions)
    │
    └── Task 3 (部署脚本)
            │
            ├── Task 4 (db_query)
            ├── Task 5 (simple-agent)
            ├── Task 6 (GenSlides)
            ├── Task 7 (llm-log-visualizer)
            ├── Task 8 (code-review-agent)
            └── Task 9 (raflow)
```

Task 4-9 可并行执行。
