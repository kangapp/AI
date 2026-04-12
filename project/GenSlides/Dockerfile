FROM python:3.11

WORKDIR /app

# 换用阿里云镜像源加速 apt 下载
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends gcc \
    && rm -rf /var/lib/apt/lists/*

# 复制后端代码
COPY backend/ ./backend/

# 安装 Python 依赖
RUN pip install --no-cache-dir -r backend/requirements.txt 2>/dev/null || \
    pip install --no-cache-dir fastapi uvicorn python-dotenv httpx pydantic

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
