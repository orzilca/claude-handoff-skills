# Handoff Prepare

Capture the current session into a self-contained handoff document so a **fresh** session can pick up exactly where this one left off.

This skill only **writes** the handoff. Resuming is a separate step: the user starts a fresh session (a new chat), then runs /handoff-continue. Do not claim the context was cleared — you cannot clear it; only the user can.

## Workflow

1. **Gather** from the *conversation*, not just the disk. Read back through this session for: the goal, what was done and why, what changed, what broke, what's still open. The conversation holds context the files don't.
2. **Capture git state** *only if this is a git repo.* Run `git status --short` and `git log --oneline -10` (single commands, no pipes). If not a git repo, skip and note it.
3. **Write the file** to `.cursor/handoff/{timestamp}-{slug}.md` using the template below.
   - Timestamp: run `date +%Y%m%d-%H%M%S`.
   - Slug: 2-4 kebab-case words naming the topic (e.g. `parkalot-cron`). The slug is what `/handoff-continue <name>` matches against, so make it distinctive.
   - Ensure the dir exists: `mkdir -p .cursor/handoff/`.
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
Handoff written: .cursor/handoff/{timestamp}-{slug}.md

To continue in a fresh session:
  1. Start a fresh session (a new chat)
  2. Run /handoff-continue   (loads the newest handoff automatically)

Or target this one explicitly: /handoff-continue {slug}
```

## Common mistakes
- Writing to the system temp dir → path is awkward to reference after starting fresh. Use the project-local handoff dir.
- Summarizing only file changes → the next session redoes abandoned approaches. Capture the *why* and the dead ends.
- Claiming context is cleared → you can't; only the user can, by starting a fresh session.
- Burying next steps → put them last and make them concrete.
- Vague slug → `/handoff-continue <name>` can't find it. Name the topic distinctively.
