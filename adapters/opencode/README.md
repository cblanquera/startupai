# OpenCode Adapter

OpenCode consumes StartupAI through portable skill folders copied from the
repository root `skills/` directory.

Install from GitHub:

```bash
npx github:cblanquera/startupai#v0.1.0 install --target opencode
```

Or sync from a local checkout:

```bash
scripts/sync-opencode.sh
```

Default target:

```text
$HOME/.config/opencode/skills
```

Override the target when your OpenCode installation uses a different skills
path:

```bash
STARTUPAI_OPENCODE_SKILLS_DIR=/path/to/opencode/skills scripts/sync-opencode.sh
```

Keep OpenCode as an adapter target. The source of truth stays in `skills/`.
