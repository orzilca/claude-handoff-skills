const common = (dir, args, fresh) => ({
  HANDOFF_DIR: dir,
  ARGS: args,
  FRESH_SESSION: fresh,
  PREPARE_CMD: '/handoff-prepare',
  CONTINUE_CMD: '/handoff-continue',
});

const title = (name) =>
  name.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

export const AGENTS = [
  {
    id: 'claude',
    tokens: common('.claude/tmp/handoff/', '$ARGUMENTS', '/clear'),
    outPath: (name) => `${name}/SKILL.md`,
    wrap: ({ name, description, body }) =>
      `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`,
  },
  {
    id: 'codex',
    tokens: common('.codex/handoff/', '$ARGUMENTS', '/new'),
    outPath: (name) => `${name}.md`,
    wrap: ({ name, body }) => `# ${title(name)}\n\n${body}\n`,
  },
  {
    id: 'cursor',
    tokens: common('.cursor/handoff/', 'the name or path you passed', 'a new chat'),
    outPath: (name) => `${name}.md`,
    wrap: ({ name, body }) => `# ${title(name)}\n\n${body}\n`,
  },
  {
    id: 'gemini',
    tokens: common('.gemini/handoff/', '{{args}}', '/clear'),
    outPath: (name) => `${name}.toml`,
    wrap: ({ description, body }) =>
      `description = ${JSON.stringify(description)}\nprompt = '''\n${body}\n'''\n`,
  },
];
