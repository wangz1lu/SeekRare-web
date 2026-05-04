#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
API_PORT=8000

PORT=5000
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-$PORT}"

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
}

start_api_service() {
    cd "${COZE_WORKSPACE_PATH}"
    echo "Starting SeekRare API service on port ${API_PORT}..."
    nohup python3 seekrare_api.py > /app/work/logs/bypass/seekrare_api.log 2>&1 &
    echo "SeekRare API started"
}

start_service() {
    cd "${COZE_WORKSPACE_PATH}"
    echo "Starting HTTP service on port ${DEPLOY_RUN_PORT} for deploy..."
    PORT=${DEPLOY_RUN_PORT} node dist/server.js
}

echo "Clearing ports before start."
kill_port_if_listening $DEPLOY_RUN_PORT
kill_port_if_listening $API_PORT

start_api_service
echo "Starting HTTP service on port ${DEPLOY_RUN_PORT} for deploy..."
start_service
