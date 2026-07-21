---
name: prep-continue
description: Prepare a handoff AND arm auto-resume in this same CLI - after the user clears the session, the next session loads the handoff automatically. Use when handing off and continuing here, not in another agent. Triggers on "prepc", "prep-continue", "handoff and continue here", "handoff and keep going here".
---

# Handoff Prep + Continue (auto-resume)

Everything /handoff:prepare does, plus an auto-resume marker: the next session in this project loads the handoff without the user typing anything.

Only for continuing in **this** CLI. If the user is taking the handoff to another agent, use /handoff:prepare instead — a leftover marker would hijack their next session here.

## Workflow

1. **Execute the full /handoff:prepare workflow** (gather → git state → write `.handoff/{timestamp}-{slug}.md`). Every rule there applies — except its closing block; print the one below instead.
2. **Arm auto-resume** — write the handoff path (nothing else) to the marker:
   `printf '%s' '.handoff/{timestamp}-{slug}.md' > .handoff/.pending`
3. **Print this closing block last**, filled in:

```
Handoff written: .handoff/{timestamp}-{slug}.md
Auto-resume armed (expires in 15 minutes).

Run /clear now — the next session picks this up automatically.
(Changed your mind / taking it elsewhere? Any agent's handoff-continue reads the same file.)
```

## Notes

- The marker is consumed once by a SessionStart hook and expires after 15 minutes (`HANDOFF_RESUME_TTL_SECONDS` to tune). If it expires, /handoff:continue still works manually.
- Never claim the context was cleared — only the user can, by running /clear.
