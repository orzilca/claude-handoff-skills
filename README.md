# Handoff Skills

**Don't lose your work when the context window fills up.** Capture a session to a handoff file, then resume it in a fresh session exactly where you left off — before context rot sets in.

Works across coding agents: **Claude Code, Codex CLI, Cursor, Gemini CLI, and Grok Build.**

- **`handoff-prepare`** (alias `handoff-prep`) — captures the current session (goal, changes, decisions, gotchas, next steps) into a lean, machine-readable file under the shared `.handoff/` dir.
- **`handoff-continue`** — loads a handoff file in a fresh session and resumes from its `next-steps`.
- **`handoff-prep-continue`** (alias `handoff-prepc`, Claude Code) — prepare **+** auto-resume: after you `/clear`, the next session loads the handoff by itself.
- **Auto context detection** *(optional, Claude Code + Cursor)* — a hook watches context size and offers a handoff before quality degrades. You still decide; nothing runs automatically.

```
/handoff-prepare        # context getting big? dump the state to a file
                        # start a fresh session (however your agent does it)
/handoff-continue       # the fresh session picks up right where you left off
```

All agents share one project-local **`.handoff/`** dir — prepare in one CLI, continue in another (Claude Code → Codex, Cursor → Claude Code, any direction).

👉 **[See what a handoff file looks like →](examples/sample-handoff.md)**

Capture and resume are **separate, explicit commands** — the hooks only *suggest* a handoff or resume one you explicitly armed; the session reset itself is always yours. You stay in control.

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

Commands are namespaced: `/handoff:prepare`, `/handoff:continue`, `/handoff:prep-continue` — with short aliases `/handoff:prep` and `/handoff:prepc`. The plugin registers two hooks:

- `UserPromptSubmit` — measures context from the session transcript; once it crosses **150k tokens** (configurable, see below) Claude asks whether to hand off now: *continue here* (auto-resume), *resume elsewhere*, or *keep going*.
- `SessionStart` — if `/handoff:prep-continue` armed auto-resume, the next fresh session in the project loads the handoff automatically (marker is consumed once and expires after 15 min; `HANDOFF_RESUME_TTL_SECONDS` to tune).

### Claude Code — manual (skills only)

```sh
cp -R dist/claude/handoff-prepare       ~/.claude/skills/
cp -R dist/claude/handoff-continue      ~/.claude/skills/
cp -R dist/claude/handoff-prep-continue ~/.claude/skills/
mkdir -p ~/.claude/commands && cp dist/claude/commands/*.md ~/.claude/commands/   # /handoff-prep, /handoff-prepc aliases
```

Optional auto-detection + auto-resume without the plugin: copy the hook scripts and register them in `~/.claude/settings.json`:

```sh
mkdir -p ~/.claude/hooks && cp dist/claude/hooks/*.mjs ~/.claude/hooks/
```

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "node \"$HOME/.claude/hooks/context-nudge.mjs\"", "timeout": 10 }] }
    ],
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "node \"$HOME/.claude/hooks/session-start-resume.mjs\"", "timeout": 10 }] }
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
cp dist/codex/*.md ~/.codex/prompts/
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
/handoff-prepare          # or /handoff-prep · plugin: /handoff:prep

# Then start a fresh session (Claude: /clear · Gemini: /clear · Codex: /new · Cursor: new chat).

# In the fresh session:
/handoff-continue                      # loads the newest handoff automatically
/handoff-continue my-topic             # or match a handoff by name substring
/handoff-continue path/to/handoff.md   # or by explicit path
```

Continuing in the **same** Claude Code session flow? Skip the second command entirely:

```
/handoff-prepc            # prepare + arm auto-resume (plugin: /handoff:prepc)
/clear                    # the fresh session loads the handoff on its own
```

All handoffs land in the project-local **`.handoff/`** dir, shared by every agent — so "prepare in Claude Code, continue in Codex" is just running the continue command there. (Handoffs written by v1.1 and earlier live in the old per-agent dirs; `handoff-continue` still finds those.) Add `.handoff/` to your `.gitignore` unless you want handoffs in the repo.

## License

MIT — see [LICENSE](LICENSE).
