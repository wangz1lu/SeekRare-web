#!/bin/bash
set -Eeuo pipefail

PORT=5000
API_PORT=8000
COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
DEPLOY_RUN_PORT=5000

cd "${COZE_WORKSPACE_PATH}"

kill_port_if_listening() {
    local port=$1
    local pids
    pids=$(ss -H -lntp 2>/dev/null | awk -v port="${port}" '$4 ~ ":"port"$"' | grep -o 'pid=[0-9]*' | cut -d= -f2 | paste -sd' ' - || true)
    if [[ -z "${pids}" ]]; then
      echo "Port ${port} is free."
      return
    fi
    echo "Port ${port} in use by PIDs: ${pids} (SIGKILL)"
    echo "${pids}" | xargs -I {} kill -9 {}
    sleep 1
    pids=$(ss -H -lntp 2>/dev/null | awk -v port="${port}" '$4 ~ ":"port"$"' | grep -o 'pid=[0-9]*' | cut -d= -f2 | paste -sd' ' - || true)
    if [[ -n "${pids}" ]]; then
      echo "Warning: port ${port} still busy after SIGKILL, PIDs: ${pids}"
    else
      echo "Port ${port} cleared."
    fi
}

echo "Clearing ports before start."
kill_port_if_listening $PORT
kill_port_if_listening $API_PORT

echo "Starting SeekRare API service on port ${API_PORT}..."
cd "${COZE_WORKSPACE_PATH}"
nohup python3 seekrare_api.py > /app/work/logs/bypass/seekrare_api.log 2>&1 &
API_PID=$!
echo "SeekRare API started with PID: $API_PID"

echo "Starting Next.js dev server on port ${PORT}..."
cd "${COZE_WORKSPACE_PATH}"
PORT=$PORT pnpm tsx watch src/server.ts
