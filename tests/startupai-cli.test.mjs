import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const cliPath = join(repoRoot, 'bin', 'startupai.js');
const packagePath = join(repoRoot, 'package.json');
const versionPath = join(repoRoot, 'VERSION');

function runCli(args, env = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });
}

test('package exposes the startupai binary', async () => {
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));

  assert.equal(packageJson.bin.startupai, './bin/startupai.js');
});

test('version prints the repository version', async () => {
  const version = (await readFile(versionPath, 'utf8')).trim();
  const result = runCli(['version']);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`StartupAI version: ${version}`));
});

test('validate works without shell tools on PATH', () => {
  const result = runCli(['validate'], { PATH: '' });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Validated \d+ skills and 1 template/);
});

test('install syncs the requested target', async () => {
  const targetDir = await mkdtemp(join(tmpdir(), 'startupai-codex-test-'));

  try {
    const result = runCli(['install', '--target', 'codex'], {
      STARTUPAI_CODEX_SKILLS_DIR: targetDir
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Synced StartupAI skills/);
    assert.match(
      await readFile(join(targetDir, 'founder-pnl-invalidation', 'SKILL.md'), 'utf8'),
      /name: founder-pnl-invalidation/
    );
  } finally {
    await rm(targetDir, { force: true, recursive: true });
  }
});

test('install works without shell tools on PATH', async () => {
  const targetDir = await mkdtemp(join(tmpdir(), 'startupai-portable-test-'));

  try {
    const result = runCli(['install', '--target', 'codex'], {
      STARTUPAI_CODEX_SKILLS_DIR: targetDir,
      PATH: ''
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Synced StartupAI skills/);
    assert.match(
      await readFile(join(targetDir, 'founder-pnl-invalidation', 'SKILL.md'), 'utf8'),
      /name: founder-pnl-invalidation/
    );
  } finally {
    await rm(targetDir, { force: true, recursive: true });
  }
});

test('install to explicit directory works', async () => {
  const targetDir = await mkdtemp(join(tmpdir(), 'startupai-dir-test-'));

  try {
    const result = runCli(['install', '--dir', targetDir]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Synced StartupAI skills/);
    assert.match(
      await readFile(join(targetDir, 'founder-pnl-invalidation', 'SKILL.md'), 'utf8'),
      /name: founder-pnl-invalidation/
    );
  } finally {
    await rm(targetDir, { force: true, recursive: true });
  }
});

test('install preserves extra installed skills and local overlays', async () => {
  const targetDir = await mkdtemp(join(tmpdir(), 'startupai-preserve-test-'));

  try {
    await mkdir(join(targetDir, 'local-environment'), { recursive: true });
    await mkdir(join(targetDir, 'custom-team-skill'), { recursive: true });
    await writeFile(
      join(targetDir, 'local-environment', 'SKILL.md'),
      'machine-local'
    );

    const result = runCli(['install', '--target', 'codex'], {
      STARTUPAI_CODEX_SKILLS_DIR: targetDir
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      await readFile(join(targetDir, 'local-environment', 'SKILL.md'), 'utf8'),
      'machine-local'
    );
    await mkdir(join(targetDir, 'custom-team-skill'), { recursive: false })
      .then(() => assert.fail('custom-team-skill should already exist'))
      .catch(error => assert.equal(error.code, 'EEXIST'));
  } finally {
    await rm(targetDir, { force: true, recursive: true });
  }
});

test('install rejects unknown targets', () => {
  const result = runCli(['install', '--target', 'unknown']);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown target/);
});
