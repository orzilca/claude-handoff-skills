import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function loadSkills(srcDir) {
  return readdirSync(srcDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const md = readFileSync(join(srcDir, f), 'utf8');
      const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (!m) throw new Error('missing frontmatter in ' + f);
      const fm = {};
      for (const line of m[1].split('\n')) {
        const i = line.indexOf(':');
        if (i === -1) continue;
        fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      }
      return {
        name: fm.name,
        description: fm.description,
        agents: fm.agents ? fm.agents.split(',').map((s) => s.trim()) : null,
        body: m[2].trim(),
      };
    });
}

export const skillForAgent = (skill, agentId) => !skill.agents || skill.agents.includes(agentId);
