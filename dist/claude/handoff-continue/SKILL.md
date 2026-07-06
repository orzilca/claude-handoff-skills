---
name: handoff-continue
description: Use in a fresh session to resume work captured by handoff-prepare. Reads a handoff file and continues from its "Next steps". Takes an optional argument — a file path, or a name to substring-match against handoff filenames; with no argument, loads the newest handoff. Triggers on "handoff-continue", "resume handoff", "continue the handoff".
---

# Handoff Continue

Resume prior work captured by /handoff-prepare. You have **zero** memory of that session — the handoff file is your only context.

This skill only **loads and resumes**. It does not write handoffs (that is /handoff-prepare).

## Resolve which handoff to load

The skill may be invoked with an optional argument ($ARGUMENTS).

1. **Argument that looks like a path** (contains `/`, or exists as a file) → use it directly as the handoff path.
2. **Argument that is a bare name** → substring-match it (case-insensitive) against filenames in `.claude/tmp/handoff/`. If multiple match, pick the **newest** by modification time. If none match, tell the user, list what *is* in the dir, and stop.
3. **No argument** → load the **newest** file in `.claude/tmp/handoff/` by modification time. If the dir is missing or empty, tell the user there's no handoff to resume and stop.

Find the newest file with a single command, e.g. `ls -t .claude/tmp/handoff/*.md`.

## Then

1. **Read the resolved file fully** with the file-reading tool.
2. **Confirm which handoff loaded** — one line, e.g. `Resuming handoff: .claude/tmp/handoff/20260701-143022-parkalot-cron.md`.
3. **Continue from its "Next steps"** section. Honor the caveats and open questions it records before acting.

## Common mistakes
- Loading a handoff but ignoring its "Caveats" / "Open questions" → repeating a mistake the previous session already hit.
- Guessing at missing context instead of reading the file fully.
- Silently picking one when several names match → say which you chose and why (newest).
