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
