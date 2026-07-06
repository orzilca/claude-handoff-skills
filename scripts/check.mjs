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

for (const agent of AGENTS) {
  for (const name of skills) {
    const rel = join('dist', agent.id, agent.outPath(name));
    const abs = join(root, rel);
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
    if (agent.id === 'claude') {
      if (!txt.startsWith('---\n') || !/\nname: /.test(txt) || !/\ndescription: /.test(txt))
        fail('malformed SKILL.md in ' + rel);
    }
  }
}

if (failures) {
  console.error('\n' + failures + ' check(s) failed');
  process.exit(1);
}
console.log('all checks passed (' + AGENTS.length * skills.length + ' files)');
