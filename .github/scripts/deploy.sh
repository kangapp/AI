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
