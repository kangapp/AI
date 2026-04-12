FROM python:3.11

WORKDIR /app

# 1. 先复制依赖文件（利用 Docker 缓存）
COPY backend/requirements.txt ./backend/

# 2. 设置阿里云 Pip 镜像并安装依赖（缓存优化：代码不变时不重新下载）
RUN pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/ && \
    pip config set global.trusted-host mirrors.aliyun.com && \
    pip install --no-cache-dir -r backend/requirements.txt

# 3. 再复制业务代码
COPY backend/ ./backend/

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
