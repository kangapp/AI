# Docker + CI/CD 自动化部署方案

## 1. 概述

**目标**: 在根目录创建统一的 `docker-compose.yml`，管理 `project/` 下多个子项目的 Docker 部署，通过 GitHub Actions 实现选择性构建和自动化部署。

**策略**: 混合方案 - 根目录统一 CI/CD 调度 + 各项目定义自己的 Dockerfile

---

## 2. 整体架构

```
AI/
├── docker-compose.yml              # 根目录统一编排
├── .dockerignore                  # 根目录镜像过滤
├── .github/
│   ├── workflows/
│   │   └── deploy.yml             # 统一 CI/CD workflow
│   └── scripts/
│       ├── deploy.sh              # 统一部署脚本 (含清理)
│       └── cleanup.sh              # 服务器全面清理脚本
└── project/
    ├── db_query/
    │   ├── Dockerfile
    │   ├── docker-compose.yml      # 项目级compose (可选)
    │   └── .env.example
    ├── simple-agent/
    │   ├── Dockerfile
    │   └── .env.example
    └── ... (其他项目)
```

---

## 3. 文件设计

### 3.1 根目录 docker-compose.yml

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

### 3.2 根目录 .dockerignore

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

### 3.3 项目级 .dockerignore (示例: db_query)

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
```

---

## 4. GitHub Actions Workflow

**文件**: `.github/workflows/deploy.yml`

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

          # 复制部署脚本
          scp .github/scripts/deploy.sh ${SERVER_USER}@${SERVER_HOST}:/opt/app/

          # 执行部署 (包含清理)
          ssh ${SERVER_USER}@${SERVER_HOST} "
            cd /opt/app
            chmod +x deploy.sh
            ./deploy.sh ${PROJECT} up
          "
```

---

## 5. 部署脚本

### 5.1 部署脚本 `.github/scripts/deploy.sh`

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

### 5.2 清理脚本 `.github/scripts/cleanup.sh`

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

---

## 6. 触发方式

| 触发方式 | 配置 | 说明 |
|----------|------|------|
| 手动选择 | `workflow_dispatch` | GitHub Actions 网页上手动选择项目 |
| 自动检测 | `push` + `paths` | 推送到哪个项目目录，自动构建/部署该项目 |

---

## 7. 秘钥配置

需要在 GitHub Secrets 配置:

| Secret 名称 | 说明 |
|-------------|------|
| `SERVER_HOST` | 服务器 IP 地址 |
| `SERVER_USER` | SSH 用户名 |
| `SSH_PRIVATE_KEY` | SSH 私钥 |

---

## 8. 子项目需提供

每个子项目需要创建:

1. **Dockerfile** - 构建镜像的指令
2. **.env.example** - 环境变量模板 (非敏感信息)
3. **(可选) docker-compose.yml** - 如果项目有特殊端口或依赖

---

## 9. 实施步骤

1. 创建根目录 `docker-compose.yml`
2. 创建根目录 `.dockerignore`
3. 创建 `.github/workflows/deploy.yml`
4. 创建 `.github/scripts/deploy.sh`
5. 创建 `.github/scripts/cleanup.sh`
6. 为每个子项目创建 Dockerfile
7. 为每个子项目创建 .env.example
8. 配置 GitHub Secrets
9. 测试部署流程
