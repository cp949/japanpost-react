#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$TMP_DIR/.secrets" "$TMP_DIR/bin"
cat >"$TMP_DIR/.secrets/env" <<'EOF'
JAPAN_POST_CLIENT_ID=dummy-client
JAPAN_POST_SECRET_KEY=dummy-secret
MINIMAL_API_INSTANCE_ID=expected-instance
EOF

cat >"$TMP_DIR/bin/curl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

status="${CURL_STATUS:-200}"
body="${CURL_BODY:-{\"ok\":true,\"instanceId\":\"wrong-instance\"}}"
output_file=""
write_out=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -o)
      output_file="$2"
      shift 2
      ;;
    -w)
      write_out="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

if [[ -n "$output_file" && "$output_file" != "/dev/null" ]]; then
  printf '%s' "$body" >"$output_file"
fi

if [[ -n "$write_out" ]]; then
  printf '%s' "${write_out//%{http_code}/$status}"
fi

exit 0
EOF

cat >"$TMP_DIR/bin/pnpm" <<EOF
#!/usr/bin/env bash
set -euo pipefail

if [[ "\$*" == *"--filter minimal-api dev"* ]]; then
  exec sleep 30
fi

if [[ "\$*" == *"--filter demo dev"* ]]; then
  touch "$TMP_DIR/demo-started"
  exec sleep 30
fi

echo "unexpected pnpm invocation: \$*" >&2
exit 1
EOF

chmod +x "$TMP_DIR/bin/curl" "$TMP_DIR/bin/pnpm"

export PATH="$TMP_DIR/bin:$PATH"
export CURL_STATUS=200
export CURL_BODY='{"ok":true,"instanceId":"wrong-instance"}'

set +e
(
  cd "$TMP_DIR"
  timeout 3 bash "$ROOT_DIR/scripts/dev-demo.sh" >"$TMP_DIR/stdout.log" 2>"$TMP_DIR/stderr.log"
)
status=$?
set -e

if [[ -f "$TMP_DIR/demo-started" ]]; then
  echo "demo started even though /health came from the wrong instance" >&2
  exit 1
fi

if [[ "$status" -eq 0 ]]; then
  echo "dev-demo.sh unexpectedly succeeded with a mismatched instance id" >&2
  exit 1
fi
