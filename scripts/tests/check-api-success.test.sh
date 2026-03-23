#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$TMP_DIR/.secrets" "$TMP_DIR/bin" "$TMP_DIR/apps/minimal-api"
cat >"$TMP_DIR/.secrets/env" <<'EOF'
JAPAN_POST_CLIENT_ID=dummy-client
JAPAN_POST_SECRET_KEY=dummy-secret
MINIMAL_API_INSTANCE_ID=expected-instance
EOF

cat >"$TMP_DIR/bin/curl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

url="${@: -1}"

if [[ "$*" == *"-o /dev/null"* && "$url" == *"/health" ]]; then
  exit 0
fi

if [[ "$url" == *"/health" ]]; then
  printf '%s' '{"ok":true,"instanceId":"expected-instance"}'
  exit 0
fi

if [[ "$url" == *"/searchcode/1020072" ]]; then
  printf '%s' '{"postalCode":"1020072","addresses":[{"postalCode":"1020072","address":"東京都 千代田区 飯田橋"}]}'
  exit 0
fi

if [[ "$url" == *"/addresszip?q="* ]]; then
  printf '%s' '{"query":"大手町","addresses":[{"postalCode":"1000004","address":"東京都 千代田区 大手町"}]}'
  exit 0
fi

echo "unexpected curl url: $url" >&2
exit 1
EOF

cat >"$TMP_DIR/bin/pnpm" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
exec sleep 30
EOF

chmod +x "$TMP_DIR/bin/curl" "$TMP_DIR/bin/pnpm"

export PATH="$TMP_DIR/bin:$PATH"
export ENV_FILE="$TMP_DIR/.secrets/env"

(
  cd "$TMP_DIR"
  bash "$ROOT_DIR/scripts/check-api.sh" >"$TMP_DIR/stdout.log" 2>"$TMP_DIR/stderr.log"
)

grep -q "CHECK health: PASS" "$TMP_DIR/stdout.log"
grep -q "CHECK searchcode: PASS" "$TMP_DIR/stdout.log"
grep -q "CHECK addresszip: PASS" "$TMP_DIR/stdout.log"
grep -q "RESULT: PASS" "$TMP_DIR/stdout.log"
