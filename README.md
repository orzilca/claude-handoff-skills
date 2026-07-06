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
