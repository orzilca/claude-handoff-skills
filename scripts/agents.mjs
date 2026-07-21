const common = (legacyDir, args, fresh) => ({
  HANDOFF_DIR: '.handoff/',
  LEGACY_HANDOFF_DIR: legacyDir,
  ARGS: args,
  FRESH_SESSION: fresh,
  PREPARE_CMD: '/handoff-prepare',
  CONTINUE_CMD: '/handoff-continue',
  PREPC_CMD: '/handoff-prep-continue',
});

export const AGENTS = [
  {
    id: 'claude',
    tokens: common('.claude/tmp/handoff/', '$ARGUMENTS', '/clear'),
    outPath: (name) => `${name}/SKILL.md`,
    wrap: ({ name, description, body }) =>
      `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`,
  },
  {
    // Claude Code plugin packaging: skills are namespaced /handoff:<name>
    id: 'claude-plugin',
    tokens: {
      ...common('.claude/tmp/handoff/', '$ARGUMENTS', '/clear'),
      PREPARE_CMD: '/handoff:prepare',
      CONTINUE_CMD: '/handoff:continue',
      PREPC_CMD: '/handoff:prep-continue',
    },
    shortName: (name) => name.replace(/^handoff-/, ''),
    outPath(name) {
      return `skills/${this.shortName(name)}/SKILL.md`;
    },
    wrap({ name, description, body }) {
      return `---\nname: ${this.shortName(name)}\ndescription: ${description}\n---\n\n${body}\n`;
    },
  },
  {
    id: 'codex',
    tokens: common('.codex/handoff/', '$ARGUMENTS', '/new'),
    aliases: { 'handoff-prepare': ['handoff-prep'] },
    outPath: (name) => `${name}.md`,
    wrap: ({ body }) => `${body}\n`,
  },
  {
    id: 'cursor',
    tokens: common('.cursor/handoff/', 'the name or path you passed', 'a new chat'),
    aliases: { 'handoff-prepare': ['handoff-prep'] },
    outPath: (name) => `${name}.md`,
    wrap: ({ body }) => `${body}\n`,
  },
  {
    id: 'gemini',
    tokens: common('.gemini/handoff/', '{{args}}', '/clear'),
    aliases: { 'handoff-prepare': ['handoff-prep'] },
    outPath: (name) => `${name}.toml`,
    wrap: ({ description, body }) =>
      `description = ${JSON.stringify(description)}\nprompt = '''\n${body}\n'''\n`,
  },
];
