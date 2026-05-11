#!/usr/bin/env bash
# CS8.401 POIS — Start backend + frontend

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BACKEND_PORT=8000
FRONTEND_PORT=5173
BACKEND_PID=""
FRONTEND_PID=""

# ── Cleanup ────────────────────────────────────────────────────────────────────
cleanup() {
    trap - INT TERM EXIT          # prevent re-entry on cascading signals

    echo ""
    echo "Shutting down servers..."

    # SIGTERM the tracked PIDs; do NOT wait — uvicorn's reloader→worker two-stage
    # shutdown causes wait to block until the whole tree unwinds, requiring a
    # second Ctrl+C.  The port sweep below is the authoritative hard stop.
    [[ -n "$BACKEND_PID"  ]] && kill "$BACKEND_PID"  2>/dev/null || true
    [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true

    # Brief grace period so graceful shutdown messages can flush, then
    # force-kill by port — catches grandchildren (uvicorn worker, Vite/node)
    # that are not directly tracked via PID.
    sleep 0.5
    lsof -ti :"$BACKEND_PORT"  2>/dev/null | xargs kill -9 2>/dev/null || true
    lsof -ti :"$FRONTEND_PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true

    echo "Ports $BACKEND_PORT and $FRONTEND_PORT released. Bye."
    exit 0
}

trap cleanup INT TERM EXIT

# ── Banner ─────────────────────────────────────────────────────────────────────
echo "=== CS8.401 POIS — Minicrypt Clique Explorer ==="
echo ""

# ── [pre] Release occupied ports ───────────────────────────────────────────────
printf "[pre] Releasing ports %s/%s if occupied... " "$BACKEND_PORT" "$FRONTEND_PORT"
lsof -ti :"$BACKEND_PORT"  2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti :"$FRONTEND_PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 0.3
echo "done"

# ── [1/3] Python deps ──────────────────────────────────────────────────────────
echo "[1/3] Checking Python dependencies..."
pip install -r requirements.txt --quiet --break-system-packages 2>/dev/null || \
    pip install -r requirements.txt --quiet 2>/dev/null || true

# ── [2/3] Node deps ────────────────────────────────────────────────────────────
echo "[2/3] Checking Node dependencies..."
(cd web && npm install --silent 2>/dev/null) || true

# ── [3/3] Launch servers ───────────────────────────────────────────────────────
echo "[3/3] Starting servers..."
echo ""

python3 -m uvicorn src.api.server:app \
    --host 127.0.0.1 \
    --port "$BACKEND_PORT" \
    --reload &
BACKEND_PID=$!

sleep 1   # let uvicorn bind before Vite starts

(cd web && npm run dev) &
FRONTEND_PID=$!

echo "  Backend  → http://localhost:$BACKEND_PORT"
echo "  API docs → http://localhost:$BACKEND_PORT/docs"
echo "  Frontend → http://localhost:$FRONTEND_PORT"
echo ""
echo "Press Ctrl+C to stop both servers."

wait
