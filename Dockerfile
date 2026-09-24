# ---------- 阶段 1：构建前端 ----------
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---------- 阶段 2：安装后端生产依赖 ----------
FROM node:20-alpine AS server-deps
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev

# ---------- 阶段 3：运行镜像 ----------
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY server/ ./server/
COPY --from=client-build /app/client/dist ./client/dist
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server/index.js"]
