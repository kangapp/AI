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
