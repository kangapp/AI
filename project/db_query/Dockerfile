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
