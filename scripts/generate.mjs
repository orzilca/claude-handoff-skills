import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENTS } from './agents.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

function parse(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error('missing frontmatter');
  const fm = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { name: fm.name, description: fm.description, body: m[2].trim() };
}

function substitute(body, tokens) {
  return body.replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => {
    if (!(k in tokens)) throw new Error('unknown token {{' + k + '}}');
    return tokens[k];
  });
}

function writeOut(rel, contents) {
  const out = join(root, rel);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, contents);
  count++;
}

const json = (obj) => JSON.stringify(obj, null, 2) + '\n';

const skills = readdirSync(srcDir)
  .filter((f) => f.endsWith('.md'))
  .map((f) => parse(readFileSync(join(srcDir, f), 'utf8')));

let count = 0;
for (const agent of AGENTS) {
  for (const skill of skills) {
    const body = substitute(skill.body, agent.tokens);
    const contents = agent.wrap({ name: skill.name, description: skill.description, body });
    writeOut(join('dist', agent.id, agent.outPath(skill.name)), contents);
  }
}

// Claude Code plugin: manifest + auto-nudge hook
writeOut('dist/claude-plugin/.claude-plugin/plugin.json', json({
  name: 'handoff',
  description: 'Session handoff: capture state before context degrades, resume in a fresh session. Offers a handoff automatically when context crosses a token threshold.',
  version: pkg.version,
  license: pkg.license,
}));
writeOut('dist/claude-plugin/hooks/hooks.json', json({
  hooks: {
    UserPromptSubmit: [{
      hooks: [{
        type: 'command',
        command: 'HANDOFF_PREPARE_CMD=/handoff:prepare HANDOFF_CONTINUE_CMD=/handoff:continue node "${CLAUDE_PLUGIN_ROOT}/hooks/context-nudge.mjs"',
        timeout: 10,
      }],
    }],
  },
}));
copyFileSync(join(srcDir, 'hooks/context-nudge.mjs'), join(root, 'dist/claude-plugin/hooks/context-nudge.mjs'));
count++;

// Same hook for manual (non-plugin) Claude Code installs
mkdirSync(join(root, 'dist/claude/hooks'), { recursive: true });
copyFileSync(join(srcDir, 'hooks/context-nudge.mjs'), join(root, 'dist/claude/hooks/context-nudge.mjs'));
count++;

// Marketplace manifest so `/plugin marketplace add orzilca/agent-handoff-skills` works
writeOut('.claude-plugin/marketplace.json', json({
  name: 'agent-handoff-skills',
  owner: { name: 'Or Zilca' },
  plugins: [{
    name: 'handoff',
    source: './dist/claude-plugin',
    description: 'Capture a session to a handoff file and resume it in a fresh session; auto-offers a handoff when context gets large.',
  }],
}));

// Cursor: preCompact nudge (observational — fires when compaction triggers)
writeOut('dist/cursor/hooks/hooks.json', json({
  version: 1,
  hooks: {
    preCompact: [{ command: 'node .cursor/hooks/context-nudge.mjs', timeout: 5 }],
  },
}));
copyFileSync(join(srcDir, 'hooks/context-nudge-cursor.mjs'), join(root, 'dist/cursor/hooks/context-nudge.mjs'));
count++;

console.log('generated ' + count + ' files into dist/');
