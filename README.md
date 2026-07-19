# Handoff Skills

**Don't lose your work when the context window fills up.** Capture a session to a handoff file, then resume it in a fresh session exactly where you left off — before context rot sets in.

Works across coding agents: **Claude Code, Codex CLI, Cursor, Gemini CLI, and Grok Build.**

- **`handoff-prepare`** — captures the current session (goal, changes, decisions, gotchas, next steps) into a lean, machine-readable file under a project-local handoff dir.
- **`handoff-continue`** — loads a handoff file in a fresh session and resumes from its `next-steps`.
- **Auto context detection** *(optional, Claude Code + Cursor)* — a hook watches context size and offers a handoff before quality degrades. You still decide; nothing runs automatically.

```
/handoff-prepare        # context getting big? dump the state to a file
                        # start a fresh session (however your agent does it)
/handoff-continue       # the fresh session picks up right where you left off
```

👉 **[See what a handoff file looks like →](examples/sample-handoff.md)**

Capture and resume are **separate, explicit commands** — the optional hook only *suggests* a handoff, it never resets or resumes anything on its own. You stay in control.

## Why

Long sessions degrade: quality falls off with the *absolute* amount of accumulated context (not the % of the window — a 1M-token window slops just as early), and compaction drops the *why* behind decisions. Starting fresh throws away everything. These skills give you a deliberate seam: dump the state you actually need into a file that survives the reset, then rehydrate a clean session from it. The handoff is written for an agent with **zero** memory of the prior session — telegraphic and dense, so it doesn't waste the fresh window it's meant to save.

## How it's built

One canonical source per skill lives in [`src/`](src/) (hook scripts in [`src/hooks/`](src/hooks/)). A zero-dependency Node generator ([`scripts/generate.mjs`](scripts/generate.mjs)) emits each agent's native format into [`dist/`](dist/). Editing a skill means editing one file in `src/` and rebuilding — every agent stays in sync.

```sh
nvm use          # Node 24 (see .nvmrc)
npm test         # regenerate dist/, verify outputs, run hook unit tests
```

## Install

`dist/` is committed, so you can install without building. Pick your agent.

### Claude Code — plugin (recommended: skills + auto-detection in one step)

```
/plugin marketplace add orzilca/agent-handoff-skills
/plugin install handoff@agent-handoff-skills
```

Commands are namespaced: `/handoff:prepare` and `/handoff:continue`. The plugin also registers a `UserPromptSubmit` hook that measures context from the session transcript and — once it crosses **150k tokens** (configurable, see below) — has Claude ask whether you want to hand off now.

### Claude Code — manual (skills only)

```sh
cp -R dist/claude/handoff-prepare  ~/.claude/skills/
cp -R dist/claude/handoff-continue ~/.claude/skills/
```

Optional auto-detection without the plugin: copy the hook script and register it in `~/.claude/settings.json`:

```sh
mkdir -p ~/.claude/hooks && cp dist/claude/hooks/context-nudge.mjs ~/.claude/hooks/
```

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "node \"$HOME/.claude/hooks/context-nudge.mjs\"", "timeout": 10 }] }
    ]
  }
}
```

### Cursor

```sh
# commands — global (all projects)
mkdir -p ~/.cursor/commands && cp dist/cursor/*.md ~/.cursor/commands/
# or per-project
mkdir -p .cursor/commands && cp dist/cursor/*.md .cursor/commands/
```

Optional auto-detection (per-project; Cursor hooks run from the project root):

```sh
mkdir -p .cursor/hooks && cp dist/cursor/hooks/context-nudge.mjs .cursor/hooks/
cp dist/cursor/hooks/hooks.json .cursor/hooks.json   # merge manually if you already have hooks
```

Cursor only exposes context stats to its `preCompact` hook, so the nudge appears when compaction is about to run — the exact moment a handoff beats a lossy summary.

### Codex CLI

```sh
cp dist/codex/handoff-prepare.md  ~/.codex/prompts/
cp dist/codex/handoff-continue.md ~/.codex/prompts/
```

### Gemini CLI

```sh
mkdir -p ~/.gemini/commands && cp dist/gemini/*.toml ~/.gemini/commands/
```

### Grok Build

Grok Build reads Claude-format skills natively — install the Claude manual package (skills only; hooks are not supported):

```sh
cp -R dist/claude/handoff-prepare  ~/.claude/skills/
cp -R dist/claude/handoff-continue ~/.claude/skills/
```

Restart your agent (or start a new session) so it picks up the new commands.

> Codex CLI, Gemini CLI, and Grok Build don't expose context usage to hooks, so auto-detection isn't available there — run `handoff-prepare` manually when context gets big.

## Auto-detection: how it works and how to tune it

The Claude Code hook reads the session transcript's token usage after each prompt. Past the threshold it injects a note telling Claude to *ask you* (via a question dialog) whether to hand off. Decline and it stays quiet for the rest of the session; it re-arms if usage drops (e.g. after compaction or a handoff).

The threshold is **absolute tokens, not a percentage** — degradation tracks total accumulated context regardless of window size, so 150k is the right trigger on a 200k *and* a 1M window. Tune it with an environment variable:

```sh
export HANDOFF_NUDGE_TOKENS=120000   # nudge earlier (default: 150000)
```

Fail-safe by design: if the transcript format changes or anything errors, the hook exits silently and you simply don't get a nudge — your session is never affected.

## Usage

```
# When context is getting large (or when the nudge asks):
/handoff-prepare          # plugin: /handoff:prepare

# Then start a fresh session (Claude: /clear · Gemini: /clear · Codex: /new · Cursor: new chat).

# In the fresh session:
/handoff-continue                      # loads the newest handoff automatically
/handoff-continue my-topic             # or match a handoff by name substring
/handoff-continue path/to/handoff.md   # or by explicit path
```

Each agent writes handoffs under its own project-local dir (`.claude/tmp/handoff/`, `.codex/handoff/`, `.cursor/handoff/`, `.gemini/handoff/`), so they're scoped to the project and survive a session reset.

## License

MIT — see [LICENSE](LICENSE).
