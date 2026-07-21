#!/usr/bin/env node
// Claude Code SessionStart hook: consume the auto-resume marker written by
// handoff-prep-continue and inject an instruction to load that handoff.
// Marker is consumed on first sight (even if expired) so it can never linger.
// Must never break the session: all failures exit 0 with no output.
import { existsSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

const TTL_S = Number(process.env.HANDOFF_RESUME_TTL_SECONDS) > 0 ? Number(process.env.HANDOFF_RESUME_TTL_SECONDS) : 900;

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  // resumed/compacted sessions already have context; keep marker for a real fresh start
  if (input.source === 'resume' || input.source === 'compact') process.exit(0);
  const cwd = input.cwd || process.cwd();
  const marker = join(cwd, '.handoff', '.pending');
  if (existsSync(marker)) {
    const ageMs = Date.now() - statSync(marker).mtimeMs;
    const target = readFileSync(marker, 'utf8').trim();
    unlinkSync(marker);
    const handoff = isAbsolute(target) ? target : join(cwd, target);
    if (ageMs <= TTL_S * 1000 && target && existsSync(handoff)) {
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext:
            '[handoff-skills] Auto-resume: a handoff was just prepared for this session. ' +
            `Read ${handoff} fully and continue from its next-steps section. ` +
            'First, tell the user which handoff you are resuming.',
        },
      }));
    }
  }
} catch {
  // fail silent by design
}
process.exit(0);
