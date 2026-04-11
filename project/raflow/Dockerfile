# 前端构建阶段
FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Tauri 构建阶段 (需要 Rust)
FROM rust:1.75-slim AS tauri-builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libwebkit2gtk-4.1-dev \
    libappindicator3-dev \
    librsvg2-dev \
    patchelf \
    && rm -rf /var/lib/apt/lists/*

COPY --from=frontend-builder /app/dist ./dist
COPY src-tauri ./src-tauri
COPY package.json pnpm-lock.yaml ./

RUN cargo build --release --manifest-path=src-tauri/Cargo.toml

# 运行阶段
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    libwebkit2gtk-4.1-0 \
    libappindicator3-1 \
    librsvg2-2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=tauri-builder /app/src-tauri/target/release/raflow ./raflow
COPY --from=frontend-builder /app/dist ./dist

EXPOSE 1420

CMD ["./raflow"]
