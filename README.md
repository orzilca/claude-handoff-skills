# Claude Code Handoff Skills

Two [Claude Code](https://claude.com/claude-code) skills that let you carry work across a `/clear` without losing context. When a session's context window gets bloated, capture everything into a self-contained handoff file, clear, and resume in a fresh session exactly where you left off.

- **`/handoff-prepare`** — captures the current session (goal, changes, decisions, caveats, next steps) into a self-contained file at `.claude/tmp/handoff/`.
- **`/handoff-continue`** — loads a handoff file in a fresh session and resumes from its "Next steps".

Capture and resume are **separate, explicit commands** — no fragile auto-resume hooks. You stay in control of when context is cleared (only `/clear` does that) and when work resumes.

## Why

Long sessions degrade: context fills with stale detail, and compaction drops the *why* behind decisions. The usual fix — `/clear` — throws away everything. These skills give you a deliberate seam: dump the state you actually need into a file that survives the clear, then rehydrate a clean session from it. The handoff is written for an agent with **zero** memory of the prior session, so it captures dead ends and gotchas, not just a diff.

## Install

Skills live in `~/.claude/skills/`. Copy (or symlink) both skill directories there:

```sh
git clone https://github.com/orzilca/claude-handoff-skills.git
cp -R claude-handoff-skills/handoff-prepare  ~/.claude/skills/
cp -R claude-handoff-skills/handoff-continue ~/.claude/skills/
```

To stay updated via `git pull`, symlink instead of copy:

```sh
ln -s "$PWD/claude-handoff-skills/handoff-prepare"  ~/.claude/skills/handoff-prepare
ln -s "$PWD/claude-handoff-skills/handoff-continue" ~/.claude/skills/handoff-continue
```

Restart Claude Code (or start a new session) so it picks up the new skills.

## Usage

```
# When context is getting large:
/handoff-prepare

# Then:
/clear

# In the fresh session:
/handoff-continue                 # loads the newest handoff automatically
/handoff-continue my-topic        # or match a handoff by name substring
/handoff-continue .claude/tmp/handoff/20260701-105610-my-topic.md   # or by explicit path
```

Handoff files are written to the **working directory's** `.claude/tmp/handoff/`, so they're scoped to the project and survive `/clear`. The skills themselves live in `~/.claude/skills/` (global).

## How it works

`/handoff-prepare` reads back through the conversation (not just disk) to reconstruct intent, then writes a structured markdown file: goal, done/in-progress state, changes-with-why, key decisions, caveats, git state, open questions, and — most importantly — concrete next steps.

`/handoff-continue` resolves which file to load (explicit path, name substring, or newest-by-mtime), reads it in full, honors its caveats, and continues from "Next steps".

## License

MIT — see [LICENSE](LICENSE).
