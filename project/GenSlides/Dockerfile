FROM python:3.11

WORKDIR /app

# 设置阿里云 Pip 镜像
RUN pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/ && \
    pip config set global.trusted-host mirrors.aliyun.com

# 复制整个 backend 目录
COPY backend/ ./backend/

# 安装依赖
RUN pip install --no-cache-dir -r backend/requirements.txt

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
