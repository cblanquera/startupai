#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target_dir="${STARTUPAI_OPENCODE_SKILLS_DIR:-$HOME/.config/opencode/skills}"

"$repo_root/scripts/install-skills.sh" "$target_dir"
