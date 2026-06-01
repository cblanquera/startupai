# Maintenance

StartupAI is maintained as portable skill content first. Installed agent copies
are generated targets and should not become the editing surface.

## Validate Skills

```bash
npm run validate
node bin/startupai.js validate
```

Validation checks that every folder under `skills/` has a matching `SKILL.md`,
valid frontmatter, a lowercase kebab-case name, and a description. It also
checks that `VERSION` and `package.json` stay aligned.

## Test The CLI

```bash
npm test
```

The CLI tests cover version reporting, validation without shell tools, target
installation, explicit-directory installation, unknown-target failures, and
preservation of unrelated installed skills.

## Check Version

```bash
scripts/check-version.sh
node bin/startupai.js version
```

## Update Repository

```bash
scripts/update-from-git.sh
```

This performs a fast-forward-only Git pull, validates skills, and prints the
current version. It does not sync agent targets.

## Release Guard

Treat a release as a remote publishing action. Pushing, tagging, and creating a
GitHub release require explicit confirmation from the user.

Before choosing a version, check remote state:

```bash
gh release list
git ls-remote --tags origin 'v*'
```

Do not rely only on local tags. If the version in `VERSION` and `package.json`
already exists as a remote tag or GitHub release, bump to the next appropriate
semver version unless the user explicitly asks for tag repair and accepts the
risk.

Release metadata must agree before publishing:

```text
VERSION
package.json
CHANGELOG.md
```

## Release Checklist

Use this sequence for a normal release:

1. Confirm the user wants a real publish flow.
2. Run local validation and tests:

   ```bash
   npm run validate
   npm test
   scripts/check-version.sh
   ```

3. Verify installer behavior with a temporary directory:

   ```bash
   node bin/startupai.js install --dir /tmp/startupai-release-test
   ```

4. Check remote releases and tags:

   ```bash
   gh release list
   git ls-remote --tags origin 'v*'
   ```

5. Update `VERSION`, `package.json`, and `CHANGELOG.md` together.
6. Commit and push the release changes.
7. Pre-test the pushed branch or `#main` install path when GitHub access is
   available:

   ```bash
   npx github:cblanquera/startupai#main install --dir /tmp/startupai-github-test
   ```

8. Create the version tag and GitHub release.
9. Install the tagged release into the requested local agent target and verify
   unrelated installed skills and local overlays are preserved.

## Sync Agent Targets

Run only the target you intend to update:

```bash
scripts/sync-codex.sh
scripts/sync-claude.sh
scripts/sync-opencode.sh
```

Each sync script validates first, then replaces only the StartupAI skill folders
in the target directory with copies from `skills/`.

For users, prefer the GitHub `npx` installer because it uses the dependency-free
Node CLI and does not require Unix shell tools:

```bash
npx github:cblanquera/startupai#v0.1.0 install --target codex
npx github:cblanquera/startupai#v0.1.0 install --target claude
npx github:cblanquera/startupai#v0.1.0 install --target opencode
```

The same install flow is available locally through the bundled CLI:

```bash
node bin/startupai.js install --target codex
node bin/startupai.js install --target claude
node bin/startupai.js install --target opencode
```

## Local Environment Template

Use `templates/local-environment/SKILL.md` as the starter for a personal
machine-local skill. Install it into the agent's local skill directory and
customize the installed copy with executable paths, runtime preferences, and
verification commands for that machine.

Do not commit customized local environment copies to this repository. The
template is portable; the installed copy is intentionally machine-local.
