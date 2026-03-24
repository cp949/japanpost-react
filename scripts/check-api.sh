#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.secrets/env}"
API_DIR="$ROOT_DIR/apps/minimal-api"
BASE_URL="${BASE_URL:-http://127.0.0.1:${PORT:-8788}}"
SERVER_LOG="$(mktemp)"
SERVER_PID=""

require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    echo "scripts/check-api.sh currently targets Linux/WSL-style environments." >&2
    exit 1
  fi
}

require_command curl
require_command node
require_command pnpm

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi

  rm -f "$SERVER_LOG"
}

trap cleanup EXIT

validate_health_response() {
  local body="$1"

  printf '%s' "$body" | node -e '
    const expectedInstanceId = process.env.MINIMAL_API_INSTANCE_ID?.trim();
    let input = "";
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => {
      const body = JSON.parse(input);
      const matchesInstance = !expectedInstanceId
        || body?.instanceId === expectedInstanceId;
      process.exit(body?.ok === true && matchesInstance ? 0 : 1);
    });
  '
}

validate_postal_code_response() {
  local body="$1"

  printf '%s' "$body" | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => {
      const body = JSON.parse(input);
      const elements = Array.isArray(body?.elements) ? body.elements : [];
      const hasExpectedAddress = elements.some((address) => {
        return address?.postalCode === "1020072"
          && typeof address?.address === "string"
          && address.address.length > 0;
      });
      process.exit(body?.totalElements >= 1 && hasExpectedAddress ? 0 : 1);
    });
  '
}

validate_address_search_response() {
  local body="$1"

  printf '%s' "$body" | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => {
      const body = JSON.parse(input);
      const elements = Array.isArray(body?.elements) ? body.elements : [];
      const hasAddress = elements.some((address) => {
        return address?.postalCode === "1000004"
          && typeof address?.address === "string"
          && address.address.length > 0;
      });
      process.exit(body?.totalElements >= 1 && elements.length >= 1 && hasAddress ? 0 : 1);
    });
  '
}

cd "$ROOT_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

export PORT="${PORT:-8788}"
export MINIMAL_API_INSTANCE_ID="${MINIMAL_API_INSTANCE_ID:-check-api-$$-$RANDOM}"
BASE_URL="${BASE_URL:-http://127.0.0.1:${PORT}}"

echo "Starting apps/minimal-api check server..."
(
  cd "$API_DIR"
  exec pnpm exec tsx src/server.ts
) >"$SERVER_LOG" 2>&1 &
SERVER_PID="$!"

echo "Waiting for health check..."
for _ in $(seq 1 30); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    break
  fi

  if curl -sS -o /dev/null "$BASE_URL/health" >/dev/null 2>&1; then
    break
  fi

  sleep 1
done

HEALTH_BODY="$(curl -fsS "$BASE_URL/health" 2>>"$SERVER_LOG")" || {
  echo "CHECK health: FAIL"
  cat "$SERVER_LOG"
  echo "RESULT: FAIL"
  exit 1
}

if validate_health_response "$HEALTH_BODY"; then
  echo "CHECK health: PASS"
else
  echo "CHECK health: FAIL"
  echo "$HEALTH_BODY"
  echo "RESULT: FAIL"
  exit 1
fi

POSTAL_CODE_BODY="$(curl -fsS \
  -X POST \
  -H 'content-type: application/json' \
  --data '{"value":"1020072","pageNumber":0,"rowsPerPage":10}' \
  "$BASE_URL/q/japanpost/searchcode" 2>>"$SERVER_LOG")" || {
  echo "CHECK searchcode: FAIL"
  cat "$SERVER_LOG"
  echo "RESULT: FAIL"
  exit 1
}

if validate_postal_code_response "$POSTAL_CODE_BODY"; then
  echo "CHECK searchcode: PASS"
else
  echo "CHECK searchcode: FAIL"
  echo "$POSTAL_CODE_BODY"
  echo "RESULT: FAIL"
  exit 1
fi

ADDRESS_SEARCH_BODY="$(curl -fsS \
  -X POST \
  -H 'content-type: application/json' \
  --data '{"freeword":"大手町","pageNumber":0,"rowsPerPage":20,"includeCityDetails":false,"includePrefectureDetails":false}' \
  "$BASE_URL/q/japanpost/addresszip" 2>>"$SERVER_LOG")" || {
  echo "CHECK addresszip: FAIL"
  cat "$SERVER_LOG"
  echo "RESULT: FAIL"
  exit 1
}

if validate_address_search_response "$ADDRESS_SEARCH_BODY"; then
  echo "CHECK addresszip: PASS"
else
  echo "CHECK addresszip: FAIL"
  echo "$ADDRESS_SEARCH_BODY"
  echo "RESULT: FAIL"
  exit 1
fi

echo "RESULT: PASS"
