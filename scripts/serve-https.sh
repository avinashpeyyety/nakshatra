#!/usr/bin/env bash
# Local HTTPS for Nakshatra (detached + logged).
#
# Usage:
#   ./scripts/serve-https.sh                 # start BOTH editions
#   ./scripts/serve-https.sh both            # same
#   ./scripts/serve-https.sh lite            # Lite only  → https://127.0.0.1:8443
#   ./scripts/serve-https.sh advisor         # Advisor    → https://127.0.0.1:8444
#   ./scripts/serve-https.sh stop            # stop both
#   ./scripts/serve-https.sh stop lite
#   ./scripts/serve-https.sh status
#   ./scripts/serve-https.sh restart
#
# Override ports:
#   NAKSHATRA_LITE_HTTPS_PORT=8443 NAKSHATRA_ADVISOR_HTTPS_PORT=8444
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${NAKSHATRA_HOST:-127.0.0.1}"
LITE_PORT="${NAKSHATRA_LITE_HTTPS_PORT:-${NAKSHATRA_HTTPS_PORT:-8443}}"
ADV_PORT="${NAKSHATRA_ADVISOR_HTTPS_PORT:-8444}"
PYTHON="${NAKSHATRA_PYTHON:-$ROOT/.venv/bin/python}"
[[ -x "$PYTHON" ]] || PYTHON="$(command -v python3)"

# Optional first arg: both|lite|advisor|start|stop|status|restart
# Second arg when first is start/stop/restart: lite|advisor|both
arg1="${1:-both}"
arg2="${2:-}"

resolve_cmd_edition() {
  case "$arg1" in
    start|stop|restart|status)
      CMD="$arg1"
      EDITION="${arg2:-both}"
      ;;
    both|lite|advisor)
      CMD="start"
      EDITION="$arg1"
      ;;
    *)
      echo "Usage: $0 [{start|stop|restart|status|both|lite|advisor}] [lite|advisor|both]" >&2
      exit 2
      ;;
  esac
  case "$EDITION" in
    both|lite|advisor) ;;
    *)
      echo "Edition must be both|lite|advisor (got: $EDITION)" >&2
      exit 2
      ;;
  esac
}

port_for() {
  case "$1" in
    lite) echo "$LITE_PORT" ;;
    advisor) echo "$ADV_PORT" ;;
  esac
}

log_for() {
  echo "/tmp/nakshatra-$1-$(port_for "$1").log"
}

pidfile_for() {
  echo "/tmp/nakshatra-$1-$(port_for "$1").pid"
}

data_dir_for() {
  # Isolate chart SQLite / watch profile per edition
  echo "$ROOT/agent/data-$1"
}

is_listening() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

status_one() {
  local edition="$1"
  local port
  port="$(port_for "$edition")"
  if is_listening "$port"; then
    local pid
    pid="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -1)"
    local edition_live
    edition_live="$(curl -sk "https://${HOST}:${port}/api/app-config" 2>/dev/null \
      | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('edition','?'), 'advisor='+str(d.get('advisor_enabled',False)))" 2>/dev/null \
      || echo "?")"
    echo "running  ${edition}  https://${HOST}:${port}  pid=${pid}  api=[${edition_live}]  log=$(log_for "$edition")"
    return 0
  fi
  echo "stopped  ${edition}  https://${HOST}:${port}"
  return 1
}

stop_one() {
  local edition="$1"
  local port pidfile pids
  port="$(port_for "$edition")"
  pidfile="$(pidfile_for "$edition")"
  if [[ -f "$pidfile" ]]; then
    kill "$(cat "$pidfile")" 2>/dev/null || true
    rm -f "$pidfile"
  fi
  pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 0.3
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
  fi
  echo "stopped  ${edition}  port ${port}"
}

start_one() {
  local edition="$1"
  local port log pidfile data_dir
  port="$(port_for "$edition")"
  log="$(log_for "$edition")"
  pidfile="$(pidfile_for "$edition")"
  data_dir="$(data_dir_for "$edition")"

  if is_listening "$port"; then
    status_one "$edition"
    return 0
  fi

  mkdir -p "$data_dir"
  cd "$ROOT"
  # Detach fully. Cold start on OneDrive can take 30–60s.
  nohup env \
    NAKSHATRA_ADMIN=0 \
    NAKSHATRA_EDITION="$edition" \
    NAKSHATRA_DATA_DIR="$data_dir" \
    "$PYTHON" -u -m agent.server --https --host "$HOST" --port "$port" \
    >>"$log" 2>&1 &
  echo $! >"$pidfile"
  disown 2>/dev/null || true

  # OneDrive + cold import can exceed 90s on first bind
  for i in $(seq 1 180); do
    if is_listening "$port"; then
      status_one "$edition"
      echo "  ready after ~${i}s  (self-signed cert — browser warning expected)"
      return 0
    fi
    if ! kill -0 "$(cat "$pidfile" 2>/dev/null)" 2>/dev/null; then
      # nohup may have re-parented; re-check port once more
      sleep 1
      if is_listening "$port"; then
        status_one "$edition"
        return 0
      fi
      echo "process exited before bind (${edition}) — see ${log}" >&2
      tail -40 "$log" >&2 || true
      return 1
    fi
    sleep 1
  done
  echo "failed to bind :${port} (${edition}) within 180s — see ${log}" >&2
  tail -40 "$log" >&2 || true
  return 1
}

foreach_edition() {
  local fn="$1"
  case "$EDITION" in
    both)
      "$fn" lite
      "$fn" advisor
      ;;
    lite|advisor)
      "$fn" "$EDITION"
      ;;
  esac
}

resolve_cmd_edition

case "$CMD" in
  start)
    foreach_edition start_one
    echo ""
    echo "URLs:"
    [[ "$EDITION" == "both" || "$EDITION" == "lite" ]] && \
      echo "  Lite:    https://${HOST}:${LITE_PORT}"
    [[ "$EDITION" == "both" || "$EDITION" == "advisor" ]] && \
      echo "  Advisor: https://${HOST}:${ADV_PORT}  (needs Ollama + ornith:9b for report)"
    echo "Self-signed TLS — browser will warn; proceed for local use."
    ;;
  stop)
    foreach_edition stop_one
    ;;
  status)
    fail=0
    foreach_edition status_one || fail=1
    exit 0
    ;;
  restart)
    foreach_edition stop_one
    sleep 0.4
    foreach_edition start_one
    ;;
esac
