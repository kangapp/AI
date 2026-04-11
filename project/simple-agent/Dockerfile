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
