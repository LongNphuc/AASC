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

# ---- Runtime: chỉ mã đã biên dịch và thư viện chạy ----
FROM node:24-bookworm-slim
ENV NODE_ENV=production \
  PORT=3002 \
  DATABASE_PATH=/app/data/tasks.sqlite \
  LOG_DIR=/app/logs
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
RUN mkdir -p data logs && chown -R node:node /app

USER node
EXPOSE 3002

# Docker mở trang Swagger mỗi 30 giây; 3 lần liên tiếp lỗi thì đánh dấu "unhealthy".
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3002) + '/docs').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

CMD ["node", "dist/main.js"]
