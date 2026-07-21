import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENTS } from './agents.mjs';
import { loadSkills, skillForAgent } from './skills.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

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

const skills = loadSkills(srcDir);

let count = 0;
for (const agent of AGENTS) {
  for (const skill of skills) {
    if (!skillForAgent(skill, agent.id)) continue;
    const body = substitute(skill.body, agent.tokens);
    const contents = agent.wrap({ name: skill.name, description: skill.description, body });
    writeOut(join('dist', agent.id, agent.outPath(skill.name)), contents);
    for (const alias of agent.aliases?.[skill.name] ?? []) {
      writeOut(join('dist', agent.id, agent.outPath(alias)), contents);
    }
  }
}

// Claude Code plugin: manifest + hooks (context nudge, auto-resume)
writeOut('dist/claude-plugin/.claude-plugin/plugin.json', json({
  name: 'handoff',
  description: 'Session handoff: capture state before context degrades, resume in a fresh session. Offers a handoff automatically when context crosses a token threshold; can auto-resume after a clear.',
  version: pkg.version,
  license: pkg.license,
}));
writeOut('dist/claude-plugin/hooks/hooks.json', json({
  hooks: {
    UserPromptSubmit: [{
      hooks: [{
        type: 'command',
        command: 'HANDOFF_PREPARE_CMD=/handoff:prepare HANDOFF_CONTINUE_CMD=/handoff:continue HANDOFF_PREPC_CMD=/handoff:prep-continue node "${CLAUDE_PLUGIN_ROOT}/hooks/context-nudge.mjs"',
        timeout: 10,
      }],
    }],
    SessionStart: [{
      hooks: [{
        type: 'command',
        command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/session-start-resume.mjs"',
        timeout: 10,
      }],
    }],
  },
}));
for (const target of ['dist/claude-plugin/hooks', 'dist/claude/hooks']) {
  mkdirSync(join(root, target), { recursive: true });
  copyFileSync(join(srcDir, 'hooks/context-nudge.mjs'), join(root, target, 'context-nudge.mjs'));
  copyFileSync(join(srcDir, 'hooks/session-start-resume.mjs'), join(root, target, 'session-start-resume.mjs'));
  count += 2;
}

// Short-command aliases (Claude Code command files: prompt that invokes the skill)
const cmdAlias = (skillRef, description) =>
  `---\ndescription: ${description}\n---\n\nInvoke the ${skillRef} skill now, with arguments: $ARGUMENTS\n`;
writeOut('dist/claude/commands/handoff-prep.md', cmdAlias('handoff-prepare', 'Alias for /handoff-prepare'));
writeOut('dist/claude/commands/handoff-prepc.md', cmdAlias('handoff-prep-continue', 'Alias for /handoff-prep-continue'));
writeOut('dist/claude-plugin/commands/prep.md', cmdAlias('prepare (from the handoff plugin)', 'Alias for /handoff:prepare'));
writeOut('dist/claude-plugin/commands/prepc.md', cmdAlias('prep-continue (from the handoff plugin)', 'Alias for /handoff:prep-continue'));

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
