#!/usr/bin/env node

const {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync
} = require('node:fs');
const { homedir } = require('node:os');
const { join, resolve } = require('node:path');

const packageRoot = resolve(__dirname, '..');
const skillsDir = join(packageRoot, 'skills');
const templatesDir = join(packageRoot, 'templates');
const namePattern = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/;

const targetResolvers = {
  claude: () => process.env.STARTUPAI_CLAUDE_SKILLS_DIR
    || join(homedir(), '.claude', 'skills'),
  codex: () => process.env.STARTUPAI_CODEX_SKILLS_DIR
    || join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'skills'),
  opencode: () => process.env.STARTUPAI_OPENCODE_SKILLS_DIR
    || (
      process.platform === 'win32' && process.env.APPDATA
        ? join(process.env.APPDATA, 'opencode', 'skills')
        : join(homedir(), '.config', 'opencode', 'skills')
    )
};

function printHelp() {
  console.log(`Usage:
  startupai install --target <codex|claude|opencode>
  startupai install --dir <target-directory>
  startupai validate
  startupai version
  startupai help`);
}

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function getVersion() {
  return readFileSync(join(packageRoot, 'VERSION'), 'utf8').trim();
}

function relativePath(path) {
  return path.replace(`${packageRoot}/`, '').replace(`${packageRoot}\\`, '');
}

function parseFrontmatter(skillFile) {
  const text = readFileSync(skillFile, 'utf8');

  if (!text.startsWith('---\n')) {
    return { errors: ['missing opening YAML frontmatter delimiter'], metadata: {} };
  }

  const endIndex = text.indexOf('\n---\n', 4);
  if (endIndex === -1) {
    return { errors: ['missing closing YAML frontmatter delimiter'], metadata: {} };
  }

  const errors = [];
  const metadata = {};
  const lines = text.slice(4, endIndex).split(/\r?\n/);

  lines.forEach((line, index) => {
    if (!line.trim()) {
      return;
    }

    if (!line.includes(':')) {
      errors.push(`line ${index + 2}: expected key: value`);
      return;
    }

    const [rawKey, ...rawValue] = line.split(':');
    const key = rawKey.trim();
    const value = rawValue.join(':').trim().replace(/^['"]|['"]$/g, '');

    if (!key) {
      errors.push(`line ${index + 2}: empty frontmatter key`);
      return;
    }

    metadata[key] = value;
  });

  return { errors, metadata };
}

function validateSkill(skillDir) {
  const errors = [];
  const skillFile = join(skillDir, 'SKILL.md');
  const folderName = skillDir.split(/[\\/]/).pop();

  if (!existsSync(skillFile)) {
    return [`${relativePath(skillDir)}: missing SKILL.md`];
  }

  if (!namePattern.test(folderName)) {
    errors.push(`${relativePath(skillDir)}: folder name must be lowercase kebab-case`);
  }

  const frontmatter = parseFrontmatter(skillFile);
  frontmatter.errors.forEach(error => {
    errors.push(`${relativePath(skillFile)}: ${error}`);
  });

  const { metadata } = frontmatter;
  if (!metadata.name) {
    errors.push(`${relativePath(skillFile)}: missing name`);
  } else if (metadata.name !== folderName) {
    errors.push(
      `${relativePath(skillFile)}: name '${metadata.name}' must match folder '${folderName}'`
    );
  } else if (!namePattern.test(metadata.name)) {
    errors.push(`${relativePath(skillFile)}: invalid name '${metadata.name}'`);
  }

  if (!metadata.description) {
    errors.push(`${relativePath(skillFile)}: missing description`);
  }

  const extraKeys = Object.keys(metadata)
    .filter(key => key !== 'name' && key !== 'description')
    .sort();

  if (extraKeys.length > 0) {
    errors.push(
      `${relativePath(skillFile)}: unsupported frontmatter keys: ${extraKeys.join(', ')}`
    );
  }

  return errors;
}

function listDirectories(path) {
  if (!existsSync(path)) {
    return [];
  }

  return readdirSync(path)
    .map(name => join(path, name))
    .filter(childPath => statSync(childPath).isDirectory())
    .sort();
}

function validate() {
  const skillDirs = listDirectories(skillsDir);
  const templateDirs = listDirectories(templatesDir)
    .filter(templateDir => existsSync(join(templateDir, 'SKILL.md')));
  const errors = [];

  if (!existsSync(skillsDir)) {
    errors.push('skills directory is missing');
  } else if (skillDirs.length === 0) {
    errors.push('no skills found');
  }

  skillDirs.forEach(skillDir => errors.push(...validateSkill(skillDir)));
  templateDirs.forEach(templateDir => errors.push(...validateSkill(templateDir)));

  const packageJson = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
  const version = getVersion();
  if (packageJson.version !== version) {
    errors.push(
      `package.json version '${packageJson.version}' must match VERSION '${version}'`
    );
  }

  if (errors.length > 0) {
    console.error('Skill validation failed:');
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
  }

  if (templateDirs.length > 0) {
    const templateLabel = templateDirs.length === 1 ? 'template' : 'templates';
    console.log(
      `Validated ${skillDirs.length} skills and ${templateDirs.length} ${templateLabel}.`
    );
    return;
  }

  console.log(`Validated ${skillDirs.length} skills.`);
}

function copyDirectory(sourceDir, targetDir) {
  cpSync(sourceDir, targetDir, {
    filter: sourcePath => {
      const name = sourcePath.split(/[\\/]/).pop();
      return name !== '__pycache__' && !name.endsWith('.pyc');
    },
    force: true,
    recursive: true
  });
}

function installToDirectory(targetDir) {
  validate();
  mkdirSync(targetDir, { recursive: true });

  listDirectories(skillsDir).forEach(skillDir => {
    const skillName = skillDir.split(/[\\/]/).pop();
    const targetSkillDir = join(targetDir, skillName);

    rmSync(targetSkillDir, { force: true, recursive: true });
    copyDirectory(skillDir, targetSkillDir);
  });

  console.log(`Synced StartupAI skills to ${targetDir}`);
}

function getOptionValue(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] || null;
}

function install(args) {
  const target = getOptionValue(args, '--target');
  const explicitDir = getOptionValue(args, '--dir');

  if (target && explicitDir) {
    fail('Use either --target or --dir, not both.', 2);
  }

  if (explicitDir) {
    installToDirectory(resolve(explicitDir));
    return;
  }

  if (!target) {
    fail('Missing required --target <codex|claude|opencode> or --dir <target-directory>', 2);
  }

  const resolveTarget = targetResolvers[target];
  if (!resolveTarget) {
    fail(`Unknown target: ${target}`, 2);
  }

  installToDirectory(resolveTarget());
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === 'version' || command === '--version' || command === '-v') {
    console.log(`StartupAI version: ${getVersion()}`);
    return;
  }

  if (command === 'validate') {
    validate();
    return;
  }

  if (command === 'install') {
    install(args.slice(1));
    return;
  }

  fail(`Unknown command: ${command}`, 2);
}

main();
