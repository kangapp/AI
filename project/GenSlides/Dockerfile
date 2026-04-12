FROM python:3.11

WORKDIR /app

# 复制整个 backend 目录
COPY backend/ ./backend/

# 使用阿里云镜像安装依赖
RUN pip install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ -r backend/requirements.txt

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
