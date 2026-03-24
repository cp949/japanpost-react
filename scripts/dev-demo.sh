#!/usr/bin/env bash

set -euo pipefail

# demo(Vite)와 minimal-api를 함께 띄워 로컬 데모 환경을 구성한다.
# 단순 백그라운드 실행이 아니라 readiness 확인과 세션 단위 cleanup까지 책임진다.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.secrets/env"

cd "$ROOT_DIR"

require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    echo "scripts/dev-demo.sh currently targets Linux/WSL-style environments." >&2
    exit 1
  fi
}

require_command awk
require_command curl
require_command node
require_command pnpm
require_command ps
require_command setsid

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

export PORT="${PORT:-8788}"
export DEMO_PORT="${DEMO_PORT:-5173}"
export VITE_DEMO_API_BASE_URL="${VITE_DEMO_API_BASE_URL:-/minimal-api}"
# readiness check가 내가 띄운 minimal-api 인스턴스를 정확히 식별할 수 있게 기본 instanceId를 만든다.
export MINIMAL_API_INSTANCE_ID="${MINIMAL_API_INSTANCE_ID:-dev-demo-$$-$RANDOM}"

api_pid=""
demo_pid=""
cleaned_up=0

# setsid로 생성된 자식은 세션 리더가 되므로 SID = PID.
# vite가 내부적으로 setpgid()를 호출해 PGID를 바꿔도 SID는 유지되므로,
# PGID 기반 kill 대신 SID 기반으로 세션 내 모든 프로세스를 찾아 종료한다.
kill_session() {
  local sid="$1"
  local sig="${2:-TERM}"
  [[ -z "$sid" ]] && return

  local pids
  pids=$(ps -eo pid=,sess= 2>/dev/null \
    | awk -v sid="$sid" '$2 == sid {print $1}' \
    | tr '\n' ' ')

  [[ -z "$pids" ]] && return
  # shellcheck disable=SC2086
  kill "-${sig}" $pids 2>/dev/null || true
}

session_dead() {
  local sid="$1"
  [[ -z "$sid" ]] && return 0

  local pids
  pids=$(ps -eo pid=,sess= 2>/dev/null \
    | awk -v sid="$sid" '$2 == sid {print $1}')
  [[ -z "$pids" ]]
}

wait_for_session_dead() {
  local sid="$1"
  local deadline=$(( SECONDS + 3 ))

  # TERM 이후 잠깐 기다렸다가, 남아 있으면 KILL로 승격하기 위한 준비 단계다.
  while [[ $SECONDS -lt $deadline ]]; do
    session_dead "$sid" && return 0
    sleep 0.1
  done
  return 1
}

cleanup() {
  [[ "$cleaned_up" -eq 1 ]] && return
  cleaned_up=1

  # demo/minimal-api 둘 중 하나만 먼저 죽더라도 남은 프로세스까지 함께 정리한다.
  kill_session "$api_pid"  TERM
  kill_session "$demo_pid" TERM

  wait_for_session_dead "$api_pid"  || kill_session "$api_pid"  KILL
  wait_for_session_dead "$demo_pid" || kill_session "$demo_pid" KILL

  wait 2>/dev/null || true
}

health_check_is_ready() {
  local body_file
  body_file="$(mktemp)"

  local status_code
  status_code="$(
    curl -sS -o "$body_file" -w "%{http_code}" \
      "http://127.0.0.1:${PORT}/health" 2>/dev/null || true
  )"

  if [[ "$status_code" != "200" ]]; then
    rm -f "$body_file"
    return 1
  fi

  # 단순 200 확인만으로는 부족하고, ok:true와 instanceId 일치까지 만족해야 "내가 띄운 준비된 서버"다.
  if node -e '
    const expectedInstanceId = process.env.MINIMAL_API_INSTANCE_ID?.trim();
    const fs = require("node:fs");
    const payload = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const matchesInstance = !expectedInstanceId
      || payload?.instanceId === expectedInstanceId;
    process.exit(payload?.ok === true && matchesInstance ? 0 : 1);
  ' "$body_file"; then
    rm -f "$body_file"
    return 0
  fi

  rm -f "$body_file"
  return 1
}

trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM
trap 'cleanup'           EXIT

# demo를 띄우기 전에 minimal-api가 실제 인증까지 통과했는지 먼저 확인한다.
setsid pnpm --filter minimal-api dev &
api_pid=$!

for _ in $(seq 1 30); do
  kill -0 "$api_pid" 2>/dev/null || { wait "$api_pid" || true; break; }
  health_check_is_ready && break
  sleep 1
done

if ! health_check_is_ready; then
  echo "Minimal API is not ready. Check credentials and /health response." >&2
  exit 1
fi

# API 준비가 확인된 뒤에만 demo를 띄워 초기 화면 경고 상태를 줄인다.
setsid pnpm --filter demo dev -- --port "$DEMO_PORT" --strictPort &
demo_pid=$!

wait_for_first_exit() {
  while true; do
    # 어느 한쪽이라도 먼저 종료되면 trap cleanup이 전체 세션을 정리한다.
    if ! kill -0 "$api_pid" 2>/dev/null; then
      wait "$api_pid" || true
      return 0
    fi

    if ! kill -0 "$demo_pid" 2>/dev/null; then
      wait "$demo_pid" || true
      return 0
    fi

    sleep 1
  done
}

wait_for_first_exit
