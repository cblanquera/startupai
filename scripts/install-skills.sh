#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf 'Usage: %s <target-directory>\n' "$0" >&2
}

if [ "$#" -ne 1 ]; then
  usage
  exit 2
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target_dir="$1"

node "$repo_root/bin/startupai.js" install --dir "$target_dir"
