# ---- Build: cài thư viện, biên dịch TypeScript, bỏ thư viện dev ----
FROM node:24-bookworm-slim AS build
WORKDIR /app

# Công cụ biên dịch phòng khi better-sqlite3 không tải được bản dựng sẵn.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- Runtime: chỉ chứa mã đã biên dịch và thư viện chạy ----
FROM node:24-bookworm-slim
ENV NODE_ENV=production \
  PORT=3000 \
  DATABASE_PATH=/app/data/app.sqlite \
  LOG_DIR=/app/logs
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
RUN mkdir -p data logs && chown -R node:node /app

USER node
EXPOSE 3000

# Docker gọi GET /health mỗi 30 giây; 3 lần liên tiếp lỗi thì đánh dấu container
# "unhealthy" (xem bằng `docker compose ps`). Image không có curl nên dùng fetch
# có sẵn của Node. start-period: bỏ qua lỗi trong 20 giây đầu lúc app khởi động.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

CMD ["node", "dist/main.js"]
