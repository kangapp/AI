FROM node:20-alpine

WORKDIR /app

RUN npm install -g bun

COPY package.json ./
COPY bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .

EXPOSE 4000

CMD ["bun", "run", "src/index.ts"]
