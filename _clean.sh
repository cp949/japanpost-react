#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

remove_matching_dirs() {
  find . \
    \( -path "./.git" -o -path "./.git/*" \) -prune -o \
    -type d \
    \( -name node_modules -o -name dist -o -name build -o -name out -o -name .next -o -name .nuxt -o -name .turbo -o -name coverage \) \
    -print0 |
    while IFS= read -r -d '' path; do
      echo "Removing directory: $path"
      rm -rf "$path"
    done
}

remove_matching_files() {
  find . \
    \( -path "./.git" -o -path "./.git/*" \) -prune -o \
    -type f \
    \( -name '*.tsbuildinfo' \) \
    -print0 |
    while IFS= read -r -d '' path; do
      echo "Removing file: $path"
      rm -f "$path"
    done
}

remove_matching_dirs
remove_matching_files
