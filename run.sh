#!/usr/bin/env bash
# CS8.401 POIS — Start backend + frontend
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== CS8.401 POIS — Minicrypt Clique Explorer ==="
echo ""

# 1. Install Python deps
echo "[1/3] Checking Python dependencies..."
pip install -r requirements.txt --quiet --break-system-packages 2>/dev/null || \
pip install -r requirements.txt --quiet 2>/dev/null || true

# 2. Install npm deps
echo "[2/3] Checking Node dependencies..."
(cd web && npm install --silent 2>/dev/null) || true

# 3. Start FastAPI backend
echo "[3/3] Starting servers..."
echo ""
python3 -m uvicorn src.api.server:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!
echo "  Backend: http://localhost:8000"
echo "  API docs: http://localhost:8000/docs"

sleep 1

# 4. Start Vite frontend (proxies /api → :8000)
(cd web && npm run dev) &
FRONTEND_PID=$!
echo "  Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
