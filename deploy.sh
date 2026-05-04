#!/bin/bash
# SeekRare Web 一键部署脚本
# 使用方法: bash deploy.sh

set -e

echo "=========================================="
echo "SeekRare Web 一键部署脚本"
echo "=========================================="

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then 
    echo "请使用 sudo 运行此脚本或切换到 root 用户"
    exit 1
fi

# 1. 安装 Node.js
echo "[1/6] 安装 Node.js 18..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi
echo "Node.js 版本: $(node -v)"
echo "npm 版本: $(npm -v)"

# 2. 安装 Python 依赖
echo "[2/6] 安装 Python 依赖..."
apt-get update
apt-get install -y python3 python3-pip python3-venv build-essential libbz2-dev liblzma-dev libcurl4-openssl-dev libssl-dev

# 3. 安装 pnpm
echo "[3/6] 安装 pnpm..."
if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm
fi
echo "pnpm 版本: $(pnpm -v)"

# 4. 安装 Node 依赖
echo "[4/6] 安装 Node 依赖..."
pnpm install

# 5. 安装 SeekRare
echo "[5/6] 安装 SeekRare 包..."
cd SeekRare && pip3 install -e . && cd ..

# 安装 Flask 等依赖
pip3 install flask flask-cors gunicorn

# 6. 构建和启动
echo "[6/6] 构建并启动服务..."

# 创建日志目录
mkdir -p logs data/uploads data/work

# 创建环境配置文件
if [ ! -f .env ]; then
    cp .env.example .env
    echo "请编辑 .env 文件配置 LLM_API_KEY"
fi

# 停止旧服务
pkill -f "seekrare_api" 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true
sleep 2

# 构建
pnpm run build

# 启动服务
echo "启动 Flask API 服务..."
nohup gunicorn -w 2 -b 0.0.0.0:8000 "seekrare_api:app" > logs/api.log 2>&1 &
API_PID=$!
echo "API 服务 PID: $API_PID"

echo "启动 Next.js Web 服务..."
nohup pnpm start > logs/web.log 2>&1 &
WEB_PID=$!
echo "Web 服务 PID: $WEB_PID"

# 保存 PID
echo $API_PID > .api.pid
echo $WEB_PID > .web.pid

# 等待服务启动
sleep 5

# 检查服务状态
echo ""
echo "=========================================="
echo "服务状态检查"
echo "=========================================="
if curl -s http://localhost:8000/api/health > /dev/null; then
    echo "✅ Flask API 服务运行正常 (http://localhost:8000)"
else
    echo "❌ Flask API 服务启动失败，请查看 logs/api.log"
fi

if curl -s http://localhost:5000 > /dev/null; then
    echo "✅ Web 服务运行正常 (http://localhost:5000)"
else
    echo "❌ Web 服务启动失败，请查看 logs/web.log"
fi

echo ""
echo "=========================================="
echo "部署完成!"
echo "=========================================="
echo "访问地址: http://你的服务器IP:5000"
echo ""
echo "常用命令:"
echo "  查看 API 日志: tail -f logs/api.log"
echo "  查看 Web 日志: tail -f logs/web.log"
echo "  重启服务: pkill -f 'seekrare_api|next start'; bash scripts/start.sh"
echo ""
