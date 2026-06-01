# StartupAI Skills

This repository houses Codex-compatible skills for startup founders, investors,
and workshop facilitators. The skills turn repeatable workshop formats into
guided workflows that help teams test ideas, expose weak assumptions, and make
clearer build, fund, pivot, or stop decisions.

The current repository is intentionally small. It starts with one founder
workshop skill and is meant to grow into a library of practical startup and
investment analysis skills.

## Current Skills

| Skill | Audience | Purpose |
| --- | --- | --- |
| `founder-pnl-invalidation` | Founders, angels, early-stage investors, workshop facilitators | Pressure-test a startup idea with conservative founder-contribution P&L thinking before committing time or capital. |

## Quick Start

Validate the skill library:

```bash
npm run validate
```

Run the CLI tests:

```bash
npm test
```

Run the founder P&L invalidation intake app:

```bash
node skills/founder-pnl-invalidation/scripts/start_intake_server.mjs
```

Open the printed local URL, complete the intake, and submit the form. The app
saves submissions under:

```text
skills/founder-pnl-invalidation/data/submissions/
```

Summarize a submitted intake:

```bash
node skills/founder-pnl-invalidation/scripts/summarize_submission.mjs skills/founder-pnl-invalidation/data/submissions/<submission-file>.json
```

## Installing Skills

Install directly from GitHub with `npx`:

```bash
npx github:cblanquera/startupai#v0.1.0 install --target codex
npx github:cblanquera/startupai#v0.1.0 install --target claude
npx github:cblanquera/startupai#v0.1.0 install --target opencode
```

Supported targets are `codex`, `claude`, and `opencode`. For local development,
you can run the bundled CLI directly:

```bash
node bin/startupai.js install --target codex
```

You can also install to an explicit directory:

```bash
node bin/startupai.js install --dir /path/to/skills
```

The installer validates the repository first, then copies each skill directory
from `skills/` into the target skills directory.

Unix shell wrappers are available for common agent targets:

```bash
scripts/sync-codex.sh
scripts/sync-claude.sh
scripts/sync-opencode.sh
```

## Versioning

The repository version lives in both `VERSION` and `package.json`. Keep them in
sync.

Check the current version and Git location:

```bash
scripts/check-version.sh
```

## Workshop Model

These skills are designed around founder and investor workshops. A typical
workshop should move participants through:

1. A concrete startup thesis.
2. Founder roles, fair market compensation, and unpaid contribution.
3. Conservative business-model scenarios with source-backed assumptions.
4. Operating expenses, including recurring and one-time costs.
5. Funding need derived from projected P&L, shareholder advances, and pre-seed
   investment requirements.
6. A decision: stop, pivot, self-fund, or raise.

The goal is not to make a startup look fundable. The goal is to find the weak
assumptions early enough that founders and investors can make a better decision.

## Repository Layout

```text
.
|-- AGENTS.md
|-- CHANGELOG.md
|-- README.md
|-- VERSION
|-- adapters/
|-- bin/
|   `-- startupai.js
|-- docs/
|   `-- maintenance.md
|-- package.json
|-- scripts/
|   |-- check-version.sh
|   |-- install-skills.sh
|   |-- sync-claude.sh
|   |-- sync-codex.sh
|   |-- sync-opencode.sh
|   |-- update-from-git.sh
|   `-- validate-skills.py
|-- skills/
|   `-- founder-pnl-invalidation/
|       |-- SKILL.md
|       |-- assets/intake-app/
|       `-- scripts/
|-- templates/
|   `-- local-environment/
`-- tests/
```

Each skill should live in its own directory under `skills/` and include a
`SKILL.md` file with frontmatter, a clear trigger description, and the workflow
an agent should follow.

## Skill Design Principles

- Start with the workshop outcome, not the tool.
- Make the first user action obvious.
- Ask for enough structured input to support a useful analysis.
- Keep assumptions conservative and cite sources where practical.
- Separate educational modeling from formal accounting, legal, tax, or
  investment advice.
- Preserve the final decision pressure: stop, pivot, self-fund, or raise.

## Notes

The linked workshop spreadsheet is the reference format for the broader program:
[workshop spreadsheet](https://docs.google.com/spreadsheets/d/1nUxgnh1UDVnfDFC9WDrJuGHT5MZeO55twvZU8douqRg/edit?usp=sharing).
Use it as context when shaping future skills, but keep the repository itself
focused on reusable skill instructions, local intake flows, scripts, and
generated analysis workflows.

See [docs/maintenance.md](docs/maintenance.md) for validation, testing,
versioning, update, and sync workflows.
