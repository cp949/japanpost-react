#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

pnpm readme:package:check
pnpm --filter @cp949/japanpost-react test
bash ./scripts/tests/check-api-success.test.sh
bash ./scripts/tests/dev-demo-readiness.test.sh
bash ./scripts/tests/dev-demo-instance-readiness.test.sh
bash ./scripts/tests/check-api-instance-readiness.test.sh
