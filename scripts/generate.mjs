import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENTS } from './agents.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');

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

const skills = readdirSync(srcDir)
  .filter((f) => f.endsWith('.md'))
  .map((f) => parse(readFileSync(join(srcDir, f), 'utf8')));

let count = 0;
for (const agent of AGENTS) {
  for (const skill of skills) {
    const body = substitute(skill.body, agent.tokens);
    const contents = agent.wrap({ name: skill.name, description: skill.description, body });
    const out = join(root, 'dist', agent.id, agent.outPath(skill.name));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, contents);
    count++;
  }
}
console.log('generated ' + count + ' files into dist/');
