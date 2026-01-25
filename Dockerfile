# =====================================
# CostQ Multi-Stage Dockerfile
# 构建目标: app-runtime (FastAPI), nginx-runtime (静态文件)
# =====================================

# ===== 阶段 1: Python 依赖构建 =====
FROM python:3.13-slim AS python-builder
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# ===== 阶段 2: Frontend 构建 =====
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

# ===== 目标 1: App Runtime (FastAPI) =====
FROM python:3.13-slim AS app-runtime
WORKDIR /app

# 复制 Python 依赖
COPY --from=python-builder /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages
COPY --from=python-builder /usr/local/bin/uvicorn /usr/local/bin/uvicorn

# 复制后端代码
COPY backend/ ./backend/

ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=production
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]

# ===== 目标 2: Nginx Runtime (静态文件) =====
FROM nginx:alpine AS nginx-runtime
COPY --from=frontend-builder /app/static/react-build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
