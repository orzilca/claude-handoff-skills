# Multi-Agent Handoff Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the two Claude-only handoff skills into one canonical source per skill that a zero-dependency Node generator emits into every target agent's native format (Claude Code, Codex CLI, Cursor, Gemini CLI; Grok Build reuses the Claude output).

**Architecture:** `src/*.md` hold neutral, token-templated skill bodies. `scripts/agents.mjs` is a config table of per-agent token values + a `wrap()` formatter. `scripts/generate.mjs` substitutes tokens and writes `dist/<agent>/...` (committed). `scripts/check.mjs` verifies every file emitted and no canonical token was left unsubstituted.

**Tech Stack:** Node 24 (ESM `.mjs`, `node:` stdlib only — zero external dependencies).

## Global Constraints

- Zero external dependencies — only Node stdlib (`node:fs`, `node:path`, `node:url`). No YAML/TOML libraries.
- Build and test run under **Node 24**. `.nvmrc` pins `24`; run `nvm use` (or `nvm exec 24 ...`) before `npm run build` / `npm test`.
- `dist/` is committed so installing requires no build step.
- Canonical tokens are UPPERCASE `{{TOKEN}}`. Gemini's runtime `{{args}}` (lowercase) is NOT a canonical token and must survive into output.
- Neutral content only in `src/` — no `.claude`-specific paths, `/clear`, or command names hardcoded; use tokens.
- Commit messages: no Claude-code contributor trailer.

---

### Task 1: Canonical sources + agent config

**Files:**
- Create: `src/handoff-prepare.md`
- Create: `src/handoff-continue.md`
- Create: `scripts/agents.mjs`
- Create: `package.json`

**Interfaces:**
- Produces: `AGENTS` array (default export named `AGENTS`) from `scripts/agents.mjs`. Each element: `{ id: string, tokens: Record<string,string>, outPath(name: string): string, wrap({name, description, body}): string }`.
- Produces: `src/*.md` files with YAML frontmatter keys `name`, `description`, and a body containing `{{TOKEN}}` placeholders.
- Token names used by bodies: `HANDOFF_DIR`, `ARGS`, `FRESH_SESSION`, `PREPARE_CMD`, `CONTINUE_CMD`.

- [ ] **Step 1: Create `src/handoff-prepare.md`** with exactly this content:

`````markdown
---
name: handoff-prepare
description: Use when the context window is getting large and the user wants to continue in a fresh session. Captures everything done this session (changes, decisions, caveats, next steps) into a self-contained handoff file, then tells the user to start a fresh session and run handoff-continue. Triggers on "handoff", "prepare handoff", "continue in a new session", "context is too big", "compact and continue".
---

# Handoff Prepare

Capture the current session into a self-contained handoff document so a **fresh** session can pick up exactly where this one left off.

This skill only **writes** the handoff. Resuming is a separate step: the user starts a fresh session ({{FRESH_SESSION}}), then runs {{CONTINUE_CMD}}. Do not claim the context was cleared — you cannot clear it; only the user can.

## Workflow

1. **Gather** from the *conversation*, not just the disk. Read back through this session for: the goal, what was done and why, what changed, what broke, what's still open. The conversation holds context the files don't.
2. **Capture git state** *only if this is a git repo.* Run `git status --short` and `git log --oneline -10` (single commands, no pipes). If not a git repo, skip and note it.
3. **Write the file** to `{{HANDOFF_DIR}}{timestamp}-{slug}.md` using the template below.
   - Timestamp: run `date +%Y%m%d-%H%M%S`.
   - Slug: 2-4 kebab-case words naming the topic (e.g. `parkalot-cron`). The slug is what `{{CONTINUE_CMD}} <name>` matches against, so make it distinctive.
   - Ensure the dir exists: `mkdir -p {{HANDOFF_DIR}}`.
   - Use the project-local handoff dir, not the system temp dir, so the path survives starting a fresh session.
4. **Print the closing block** (see below) as the last thing in your reply.

## What goes in the handoff

Write for a competent agent with **zero** memory of this session. Optimize for "what would I need to not repeat mistakes or redo work."

- **Reference, don't restate.** Point to files by `path:line`. Don't paste large blobs already on disk.
- **Redact secrets.** No API keys, tokens, passwords, or PII in the file.
- **Why over what.** The diff shows *what* changed; the handoff explains *why* and *what to watch out for*.
- **Lead with next steps.** The single most valuable section is "what to do next."

## Template

```markdown
# Handoff — {short topic} — {timestamp}

## Resume instruction
You are continuing prior work with no memory of it. Read this whole file, then start at "Next steps".

## Goal
{What we're ultimately trying to achieve. 1-3 sentences.}

## State: done / in-progress / not-started
- [x] {done thing} — {why / how}
- [~] {in-progress thing} — {where it stands, what's left}
- [ ] {not started}

## Changes this session
- Created: `path` — {why}
- Modified: `path:line` — {what & why}
- Deleted: `path` — {why}

## Key decisions
| Decision | Why | Alternatives rejected |
|---|---|---|

## What works / what doesn't
- Works: {verified behavior — how it was verified}
- Broken / untested: {what, and the symptom}

## Caveats, gotchas, fail points
- {Fragile assumption, sharp edge, thing that bit us, env quirk}

## Git state
{branch, uncommitted files from `git status --short`, recent commits — or "not a git repo"}

## Open questions
- {Unresolved decision the next session must make}

## Next steps (start here)
1. {Concrete first action, with the file to touch}
2. ...
```

## Closing block (print this last)

After writing the file, end your reply with exactly this, filled in:

```
Handoff written: {{HANDOFF_DIR}}{timestamp}-{slug}.md

To continue in a fresh session:
  1. Start a fresh session ({{FRESH_SESSION}})
  2. Run {{CONTINUE_CMD}}   (loads the newest handoff automatically)

Or target this one explicitly: {{CONTINUE_CMD}} {slug}
```

## Common mistakes
- Writing to the system temp dir → path is awkward to reference after starting fresh. Use the project-local handoff dir.
- Summarizing only file changes → the next session redoes abandoned approaches. Capture the *why* and the dead ends.
- Claiming context is cleared → you can't; only the user can, by starting a fresh session.
- Burying next steps → put them last and make them concrete.
- Vague slug → `{{CONTINUE_CMD}} <name>` can't find it. Name the topic distinctively.
`````

- [ ] **Step 2: Create `src/handoff-continue.md`** with exactly this content:

`````markdown
---
name: handoff-continue
description: Use in a fresh session to resume work captured by handoff-prepare. Reads a handoff file and continues from its "Next steps". Takes an optional argument — a file path, or a name to substring-match against handoff filenames; with no argument, loads the newest handoff. Triggers on "handoff-continue", "resume handoff", "continue the handoff".
---

# Handoff Continue

Resume prior work captured by {{PREPARE_CMD}}. You have **zero** memory of that session — the handoff file is your only context.

This skill only **loads and resumes**. It does not write handoffs (that is {{PREPARE_CMD}}).

## Resolve which handoff to load

The skill may be invoked with an optional argument ({{ARGS}}).

1. **Argument that looks like a path** (contains `/`, or exists as a file) → use it directly as the handoff path.
2. **Argument that is a bare name** → substring-match it (case-insensitive) against filenames in `{{HANDOFF_DIR}}`. If multiple match, pick the **newest** by modification time. If none match, tell the user, list what *is* in the dir, and stop.
3. **No argument** → load the **newest** file in `{{HANDOFF_DIR}}` by modification time. If the dir is missing or empty, tell the user there's no handoff to resume and stop.

Find the newest file with a single command, e.g. `ls -t {{HANDOFF_DIR}}*.md`.

## Then

1. **Read the resolved file fully** with the file-reading tool.
2. **Confirm which handoff loaded** — one line, e.g. `Resuming handoff: {{HANDOFF_DIR}}20260701-143022-parkalot-cron.md`.
3. **Continue from its "Next steps"** section. Honor the caveats and open questions it records before acting.

## Common mistakes
- Loading a handoff but ignoring its "Caveats" / "Open questions" → repeating a mistake the previous session already hit.
- Guessing at missing context instead of reading the file fully.
- Silently picking one when several names match → say which you chose and why (newest).
`````

- [ ] **Step 3: Create `scripts/agents.mjs`** with exactly this content:

```javascript
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
```

- [ ] **Step 4: Create `package.json`** with exactly this content:

```json
{
  "name": "handoff-skills",
  "version": "1.0.0",
  "description": "Session handoff skills for Claude Code, Codex CLI, Cursor, Gemini CLI, and Grok Build",
  "license": "MIT",
  "type": "module",
  "scripts": {
    "build": "node scripts/generate.mjs",
    "test": "node scripts/generate.mjs && node scripts/check.mjs"
  }
}
```

- [ ] **Step 5: Verify config + sources load and parse.** Run:

```bash
cd /Users/orzilca/dev/claude-handoff-skills && nvm use >/dev/null && node -e "import('./scripts/agents.mjs').then(m=>{const a=m.AGENTS;if(a.length!==4)throw new Error('want 4 agents, got '+a.length);for(const x of a){if(!x.id||!x.tokens.HANDOFF_DIR||typeof x.wrap!=='function')throw new Error('bad descriptor '+x.id);}console.log('agents ok:',a.map(x=>x.id).join(','));const fs=require('node:fs');for(const f of ['handoff-prepare','handoff-continue']){const t=fs.readFileSync('src/'+f+'.md','utf8');if(!/^---\n[\s\S]*?name:[\s\S]*?description:[\s\S]*?\n---\n/.test(t))throw new Error('bad frontmatter in '+f);}console.log('sources ok');})"
```

Expected: `agents ok: claude,codex,cursor,gemini` then `sources ok`.

- [ ] **Step 6: Commit.**

```bash
git add src scripts/agents.mjs package.json && git commit -m "Add canonical handoff sources and per-agent config"
```

---

### Task 2: Generator + verification (TDD)

**Files:**
- Create: `scripts/check.mjs`
- Create: `scripts/generate.mjs`
- Create: `dist/**` (generated, committed)

**Interfaces:**
- Consumes: `AGENTS` from `scripts/agents.mjs`; `src/*.md`.
- `generate.mjs` writes `dist/<agent.id>/<agent.outPath(name)>` for every (agent, skill) pair.
- `check.mjs` exits non-zero and prints offenders if any expected file is missing or contains a leftover `{{UPPER}}` token or malformed per-format wrapper; exits zero with `all checks passed` otherwise.

- [ ] **Step 1: Write the verification script first (the failing test).** Create `scripts/check.mjs` with exactly this content:

```javascript
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
```

- [ ] **Step 2: Run check to verify it fails** (no `dist/` yet). Run:

```bash
cd /Users/orzilca/dev/claude-handoff-skills && nvm use >/dev/null && node scripts/check.mjs; echo "exit=$?"
```

Expected: `FAIL: missing dist/claude/handoff-prepare/SKILL.md` (and others), then `exit=1`.

- [ ] **Step 3: Write the generator.** Create `scripts/generate.mjs` with exactly this content:

```javascript
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
```

- [ ] **Step 4: Run the build, then the check, to verify they pass.** Run:

```bash
cd /Users/orzilca/dev/claude-handoff-skills && nvm use >/dev/null && npm test
```

Expected: `generated 8 files into dist/` then `all checks passed (8 files)`.

- [ ] **Step 5: Spot-check the two trickiest outputs.** Run:

```bash
cd /Users/orzilca/dev/claude-handoff-skills && nvm use >/dev/null && node -e "const fs=require('node:fs');const g=fs.readFileSync('dist/gemini/handoff-continue.toml','utf8');if(!g.includes('{{args}}'))throw new Error('gemini lost {{args}}');if(g.match(/\{\{[A-Z_]+\}\}/))throw new Error('gemini has leftover token');const c=fs.readFileSync('dist/claude/handoff-prepare/SKILL.md','utf8');if(!c.includes('.claude/tmp/handoff/'))throw new Error('claude dir wrong');console.log('spot-check ok');"
```

Expected: `spot-check ok` (confirms Gemini keeps its runtime `{{args}}` while all UPPER tokens are gone, and Claude got its native handoff dir).

- [ ] **Step 6: Commit.**

```bash
git add scripts/check.mjs scripts/generate.mjs dist && git commit -m "Add generator, verification, and generated dist for all agents"
```

---

### Task 3: README rewrite + remove legacy skill dirs

**Files:**
- Modify: `README.md` (full rewrite)
- Delete: `handoff-prepare/SKILL.md`, `handoff-continue/SKILL.md` (legacy top-level dirs; content now lives in `src/` → `dist/claude/`)

**Interfaces:**
- Consumes: `dist/` layout from Task 2.

- [ ] **Step 1: Remove the legacy top-level skill directories.** Run:

```bash
cd /Users/orzilca/dev/claude-handoff-skills && git rm -r handoff-prepare handoff-continue
```

Expected: both `SKILL.md` files staged for deletion.

- [ ] **Step 2: Rewrite `README.md`** with exactly this content:

`````markdown
# Handoff Skills

**Don't lose your work when the context window fills up.** A pair of skills that let you start a fresh session and keep going — capture a session to a handoff file, then resume it in a new session exactly where you left off.

Works across coding agents: **Claude Code, Codex CLI, Cursor, Gemini CLI, and Grok Build.**

- **`handoff-prepare`** — captures the current session (goal, changes, decisions, caveats, next steps) into a self-contained file under a project-local handoff dir.
- **`handoff-continue`** — loads a handoff file in a fresh session and resumes from its "Next steps".

```
/handoff-prepare        # context getting big? dump the state to a file
                        # start a fresh session (however your agent does it)
/handoff-continue       # the fresh session picks up right where you left off
```

👉 **[See what a handoff file looks like →](examples/sample-handoff.md)**

Capture and resume are **separate, explicit commands** — no fragile auto-resume hooks. You stay in control of when the session resets and when work resumes.

## Why

Long sessions degrade: context fills with stale detail, and compaction drops the *why* behind decisions. Starting fresh throws away everything. These skills give you a deliberate seam: dump the state you actually need into a file that survives the reset, then rehydrate a clean session from it. The handoff is written for an agent with **zero** memory of the prior session, so it captures dead ends and gotchas, not just a diff.

## How it's built

One canonical source per skill lives in [`src/`](src/). A zero-dependency Node generator ([`scripts/generate.mjs`](scripts/generate.mjs)) emits each agent's native format into [`dist/`](dist/). Editing a skill means editing one file in `src/` and rebuilding — every agent stays in sync.

```sh
nvm use          # Node 24 (see .nvmrc)
npm test         # regenerate dist/ and verify every agent output
```

## Install

`dist/` is committed, so you can install without building. Pick your agent:

### Claude Code
```sh
cp -R dist/claude/handoff-prepare  ~/.claude/skills/
cp -R dist/claude/handoff-continue ~/.claude/skills/
```

### Codex CLI
```sh
cp dist/codex/handoff-prepare.md  ~/.codex/prompts/
cp dist/codex/handoff-continue.md ~/.codex/prompts/
```

### Cursor
```sh
# global (all projects)
mkdir -p ~/.cursor/commands && cp dist/cursor/*.md ~/.cursor/commands/
# or per-project
mkdir -p .cursor/commands && cp dist/cursor/*.md .cursor/commands/
```

### Gemini CLI
```sh
mkdir -p ~/.gemini/commands && cp dist/gemini/*.toml ~/.gemini/commands/
```

### Grok Build
Grok Build reads Claude-format skills natively, so install the Claude package — it discovers skills in `~/.claude/skills/`:
```sh
cp -R dist/claude/handoff-prepare  ~/.claude/skills/
cp -R dist/claude/handoff-continue ~/.claude/skills/
```

Restart your agent (or start a new session) so it picks up the new commands.

## Usage

```
# When context is getting large:
/handoff-prepare

# Then start a fresh session (Claude: /clear · Gemini: /clear · Codex: /new · Cursor: new chat).

# In the fresh session:
/handoff-continue                 # loads the newest handoff automatically
/handoff-continue my-topic        # or match a handoff by name substring
/handoff-continue path/to/handoff.md   # or by explicit path
```

Each agent writes handoffs under its own project-local dir (`.claude/tmp/handoff/`, `.codex/handoff/`, `.cursor/handoff/`, `.gemini/handoff/`), so they're scoped to the project and survive a session reset.

## License

MIT — see [LICENSE](LICENSE).
`````

- [ ] **Step 3: Verify the tree is clean and consistent.** Run:

```bash
cd /Users/orzilca/dev/claude-handoff-skills && ls handoff-prepare handoff-continue 2>&1 | head -1; grep -c "dist/" README.md
```

Expected: an error/"No such file" for the legacy dirs (they're gone) and a non-zero count of `dist/` references in the README.

- [ ] **Step 4: Commit.**

```bash
git add -A && git commit -m "Rewrite README for multi-agent install; remove legacy skill dirs"
```

---

## Notes for the implementer

- **Do not** hand-edit anything under `dist/` — it is generated. Change `src/` or `scripts/agents.mjs` and run `npm run build`.
- If you add a token to a `src/` body, add its value to every agent's `common(...)`/`tokens` in `scripts/agents.mjs`, or `generate.mjs` throws `unknown token`.
- Gemini's `{{args}}` is intentional runtime syntax and must remain in `dist/gemini/*.toml`; the check only flags UPPERCASE `{{TOKEN}}` leftovers.
