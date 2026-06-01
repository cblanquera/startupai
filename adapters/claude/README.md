# Claude Code Adapter

Claude Code consumes StartupAI through portable skill folders copied from the
repository root `skills/` directory.

Install from GitHub:

```bash
npx github:cblanquera/startupai#v0.1.0 install --target claude
```

Or sync from a local checkout:

```bash
scripts/sync-claude.sh
```

Default target:

```text
$HOME/.claude/skills
```

Override the target when your Claude Code installation uses a different skills
path:

```bash
STARTUPAI_CLAUDE_SKILLS_DIR=/path/to/claude/skills scripts/sync-claude.sh
```

Keep Claude Code as an adapter target. The source of truth stays in `skills/`.
