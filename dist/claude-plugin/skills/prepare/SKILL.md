---
name: prepare
description: Use when the context window is getting large and the user wants to continue in a fresh session. Captures everything done this session (changes, decisions, caveats, next steps) into a self-contained handoff file, then tells the user to start a fresh session and run handoff-continue. Triggers on "handoff", "prepare handoff", "continue in a new session", "context is too big", "compact and continue".
---

# Handoff Prepare

Capture the current session into a handoff file a fresh session can resume from.

This skill only **writes** the file. Resuming is separate: the user starts a fresh session (/clear), then runs /handoff:continue. Never claim the context was cleared — only the user can do that.

## Workflow

1. **Gather from the conversation, not just the disk**: goal, what was done and why, dead ends, what broke, what's open.
2. **Git state** — only if a git repo: `git status --short` and `git log --oneline -5` (single commands, no pipes). Otherwise skip.
3. **Write the file** to `.claude/tmp/handoff/{timestamp}-{slug}.md` in the format below.
   - `mkdir -p .claude/tmp/handoff/` first. Timestamp: `date +%Y%m%d-%H%M%S`. Slug: 2-4 distinctive kebab-case words (/handoff:continue matches on it).
   - Project-local dir, not system temp — the path must survive the reset.
4. **End your reply with the closing block** below.

## Handoff format

The file is read by an agent, not a human. Every token it wastes is context the next session loses. Rules:

- **Telegraphic style.** Fragments over sentences. No filler, no restating the obvious.
- **Reference, don't restate.** `path:line`, never pasted file contents.
- **Omit any empty section.** No "N/A", no placeholder rows.
- **Target ≤60 lines. Hard cap 100.**
- **Why over what.** The diff shows what changed; record why, and what to watch out for.
- **Redact secrets.** No keys, tokens, passwords, PII.

```markdown
# handoff: {slug}
generated: {timestamp}
goal: {1-2 sentences}

## next-steps  <!-- resume here -->
1. {concrete action + file to touch}
2. ...

## state
- done: {thing} — {how/why}
- wip: {thing} — {where it stands, what's left}
- todo: {thing}

## changes
- {A|M|D} {path:line} — {why}

## decisions
- {decision} — {why}; rejected: {alternative — why not}

## verified
- works: {behavior} — {how verified}
- broken: {what} — {symptom}

## gotchas
- {fragile assumption, env quirk, dead end already tried}

## git
- branch: {name}
- uncommitted: {paths, or "clean"}
- recent: {last few one-line commits}

## open-questions
- {decision the next session must make}
```

## Closing block (print this last)

After writing the file, end your reply with exactly this, filled in:

```
Handoff written: .claude/tmp/handoff/{timestamp}-{slug}.md

To continue in a fresh session:
  1. Start a fresh session (/clear)
  2. Run /handoff:continue   (loads the newest handoff automatically)

Or target this one explicitly: /handoff:continue {slug}
```

## Common mistakes

- Padding the file with prose → the next session pays for every token. Telegraphic, always.
- Summarizing only file changes → next session redoes abandoned approaches. Capture the why and the dead ends.
- Claiming context is cleared → you can't; only the user can.
- Vague slug → `/handoff:continue <name>` can't find it.
