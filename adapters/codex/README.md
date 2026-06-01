# Codex Adapter

Codex consumes StartupAI through portable skill folders copied from the
repository root `skills/` directory.

Install from GitHub:

```bash
npx github:cblanquera/startupai#v0.1.0 install --target codex
```

Or sync from a local checkout:

```bash
scripts/sync-codex.sh
```

Default target:

```text
${CODEX_HOME:-$HOME/.codex}/skills
```

Override the target when needed:

```bash
STARTUPAI_CODEX_SKILLS_DIR=/path/to/codex/skills scripts/sync-codex.sh
```

Do not edit installed Codex copies first. Update `skills/*/SKILL.md` in this
repository, validate, then sync.
