import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENTS } from './agents.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const skills = readdirSync(join(root, 'src'))
  .filter((f) => f.endsWith('.md'))
  .map((f) => f.replace(/\.md$/, ''));

let failures = 0;
const fail = (msg) => {
  console.error('FAIL: ' + msg);
  failures++;
};

const readJson = (rel) => {
  const abs = join(root, rel);
  if (!existsSync(abs)) {
    fail('missing ' + rel);
    return null;
  }
  try {
    return JSON.parse(readFileSync(abs, 'utf8'));
  } catch {
    fail('invalid JSON in ' + rel);
    return null;
  }
};

let fileCount = 0;
for (const agent of AGENTS) {
  for (const name of skills) {
    const rel = join('dist', agent.id, agent.outPath(name));
    const abs = join(root, rel);
    fileCount++;
    if (!existsSync(abs)) {
      fail('missing ' + rel);
      continue;
    }
    const txt = readFileSync(abs, 'utf8');
    const leftover = txt.match(/\{\{[A-Z_]+\}\}/);
    if (leftover) fail('unsubstituted ' + leftover[0] + ' in ' + rel);
    if (agent.id === 'gemini') {
      if (!/^description = /m.test(txt) || !/^prompt = '''/m.test(txt) || !txt.trimEnd().endsWith("'''"))
        fail('malformed TOML in ' + rel);
    }
    if (agent.id === 'claude' || agent.id === 'claude-plugin') {
      if (!txt.startsWith('---\n') || !/\nname: /.test(txt) || !/\ndescription: /.test(txt))
        fail('malformed SKILL.md in ' + rel);
    }
  }
}

// Claude Code plugin package
const plugin = readJson('dist/claude-plugin/.claude-plugin/plugin.json');
if (plugin && plugin.name !== 'handoff') fail('plugin.json name must be "handoff"');
const pluginHooks = readJson('dist/claude-plugin/hooks/hooks.json');
if (pluginHooks) {
  const cmd = pluginHooks.hooks?.UserPromptSubmit?.[0]?.hooks?.[0]?.command || '';
  if (!cmd.includes('${CLAUDE_PLUGIN_ROOT}/hooks/context-nudge.mjs'))
    fail('plugin hooks.json must invoke context-nudge.mjs via ${CLAUDE_PLUGIN_ROOT}');
}
for (const rel of ['dist/claude-plugin/hooks/context-nudge.mjs', 'dist/claude/hooks/context-nudge.mjs']) {
  if (!existsSync(join(root, rel))) fail('missing ' + rel);
}

// Marketplace manifest
const marketplace = readJson('.claude-plugin/marketplace.json');
if (marketplace) {
  const src = marketplace.plugins?.[0]?.source;
  if (!src || !existsSync(join(root, src))) fail('marketplace.json plugin source missing or does not exist: ' + src);
}

// Cursor hooks
const cursorHooks = readJson('dist/cursor/hooks/hooks.json');
if (cursorHooks) {
  if (cursorHooks.version !== 1) fail('cursor hooks.json must have version: 1');
  const cmd = cursorHooks.hooks?.preCompact?.[0]?.command || '';
  if (!cmd.includes('.cursor/hooks/context-nudge.mjs')) fail('cursor hooks.json must invoke .cursor/hooks/context-nudge.mjs');
}
if (!existsSync(join(root, 'dist/cursor/hooks/context-nudge.mjs'))) fail('missing dist/cursor/hooks/context-nudge.mjs');

if (failures) {
  console.error('\n' + failures + ' check(s) failed');
  process.exit(1);
}
console.log('all checks passed (' + fileCount + ' skill files + hook/plugin artifacts)');
