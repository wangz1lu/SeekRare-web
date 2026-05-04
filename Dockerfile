# SeekRare Web Docker 配置
FROM node:18-alpine AS frontend

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install

COPY . .
RUN pnpm run build

# 生产环境
FROM python:3.12-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    libbz2-dev \
    liblzma-dev \
    libcurl4-openssl-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# 复制 SeekRare 包
COPY SeekRare/ /app/SeekRare/

# 安装 Python 依赖
RUN pip install --no-cache-dir -e ./SeekRare && \
    pip install --no-cache-dir flask flask-cors gunicorn

# 复制前端构建产物
COPY --from=frontend /app/.next /app/.next
COPY --from=frontend /app/public /app/public
COPY --from=frontend /app/package.json /app/

# 复制应用代码
COPY seekrare_api.py /app/
COPY .env.example /app/.env
COPY scripts/start.sh /app/start.sh

# 创建必要目录
RUN mkdir -p /tmp/seekrare_uploads /tmp/seekrare_work

# 暴露端口
EXPOSE 5000 8000

# 启动脚本
CMD ["/bin/bash", "-c", "gunicorn -w 2 -b 0.0.0.0:8000 seekrare_api:app & cd /app && PORT=5000 node_modules/.bin/next start"]
