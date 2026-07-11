#!/usr/bin/env bash
# Durable local HTTPS for Nakshatra Chakram (detached, logged).
# Usage:
#   ./scripts/serve-https.sh          # start if not running
#   ./scripts/serve-https.sh stop
#   ./scripts/serve-https.sh status
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${NAKSHATRA_HTTPS_PORT:-8443}"
HOST="${NAKSHATRA_HOST:-127.0.0.1}"
LOG="${NAKSHATRA_LOG:-/tmp/nakshatra-${PORT}.log}"
PIDFILE="/tmp/nakshatra-${PORT}.pid"
PYTHON="${NAKSHATRA_PYTHON:-$ROOT/.venv/bin/python}"
[[ -x "$PYTHON" ]] || PYTHON="$(command -v python3)"

cmd="${1:-start}"

is_listening() {
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1
}

status() {
  if is_listening; then
    local pid
    pid="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1)"
    echo "running  https://${HOST}:${PORT}  pid=${pid}  log=${LOG}"
    return 0
  fi
  echo "stopped  https://${HOST}:${PORT}"
  return 1
}

stop() {
  if [[ -f "$PIDFILE" ]]; then
    kill "$(cat "$PIDFILE")" 2>/dev/null || true
    rm -f "$PIDFILE"
  fi
  # also free port if orphaned
  local pids
  pids="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 0.3
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
  fi
  echo "stopped  port ${PORT}"
}

start() {
  if is_listening; then
    status
    return 0
  fi
  cd "$ROOT"
  # Detach fully so shell/agent exit does not kill the server.
  # -u: unbuffered logs. Cold start on OneDrive can take 30–60s (imports + venv).
  nohup "$PYTHON" -u -m agent.server --https --host "$HOST" --port "$PORT" \
    >>"$LOG" 2>&1 &
  echo $! >"$PIDFILE"
  disown 2>/dev/null || true
  # wait for listen (up to ~90s)
  for i in $(seq 1 90); do
    if is_listening; then
      status
      echo "  ready after ~${i}s  (self-signed cert — browser warning is expected)"
      return 0
    fi
    if ! kill -0 "$(cat "$PIDFILE" 2>/dev/null)" 2>/dev/null; then
      echo "process exited before bind — see ${LOG}" >&2
      tail -40 "$LOG" >&2 || true
      return 1
    fi
    sleep 1
  done
  echo "failed to bind :${PORT} within 90s — see ${LOG}" >&2
  tail -40 "$LOG" >&2 || true
  return 1
}

case "$cmd" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  restart) stop; sleep 0.4; start ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}" >&2
    exit 2
    ;;
esac
