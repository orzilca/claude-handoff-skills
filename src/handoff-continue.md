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
2. **Argument that is a bare name** → substring-match it (case-insensitive) against filenames in `{{HANDOFF_DIR}}`, falling back to the legacy dir `{{LEGACY_HANDOFF_DIR}}` (pre-v1.2 handoffs). If multiple match, pick the **newest** by modification time. If none match, tell the user, list what *is* in the dirs, and stop.
3. **No argument** → load the **newest** file in `{{HANDOFF_DIR}}` by modification time; if that dir is missing or empty, try `{{LEGACY_HANDOFF_DIR}}`. If both are empty, tell the user there's no handoff to resume and stop.

Handoffs from other agents live in the same `{{HANDOFF_DIR}}` — resuming work prepared by a different CLI is normal. Find the newest file with a single command, e.g. `ls -t {{HANDOFF_DIR}}*.md` (then `ls -t {{LEGACY_HANDOFF_DIR}}*.md` if needed).

## Then

1. **Read the resolved file fully** with the file-reading tool.
2. **Confirm which handoff loaded** — one line, e.g. `Resuming handoff: {{HANDOFF_DIR}}20260701-143022-parkalot-cron.md`.
3. **Continue from its `next-steps` section** (older handoffs may title it "Next steps"). Honor the gotchas and open questions it records before acting.

## Common mistakes
- Loading a handoff but ignoring its "Caveats" / "Open questions" → repeating a mistake the previous session already hit.
- Guessing at missing context instead of reading the file fully.
- Silently picking one when several names match → say which you chose and why (newest).
