#!/usr/bin/env node
// Claude Code UserPromptSubmit hook: when context exceeds an absolute token
// threshold, inject a nudge telling Claude to offer a handoff via AskUserQuestion.
// Absolute (not %) because quality degrades by token count regardless of window size.
// Must never break the session: all failures exit 0 with no output.
import { closeSync, existsSync, fstatSync, mkdirSync, openSync, readFileSync, readSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const THRESHOLD = Number(process.env.HANDOFF_NUDGE_TOKENS) > 0 ? Number(process.env.HANDOFF_NUDGE_TOKENS) : 150000;
const STATE_DIR = process.env.HANDOFF_NUDGE_STATE_DIR || join(tmpdir(), 'handoff-nudge');
const TAIL_BYTES = 8 * 1024 * 1024;
const PREPARE_CMD = process.env.HANDOFF_PREPARE_CMD || 'handoff-prepare';
const CONTINUE_CMD = process.env.HANDOFF_CONTINUE_CMD || 'handoff-continue';
const PREPC_CMD = process.env.HANDOFF_PREPC_CMD || 'handoff-prep-continue';

function contextTokens(path) {
  const fd = openSync(path, 'r');
  try {
    const size = fstatSync(fd).size;
    const len = Math.min(size, TAIL_BYTES);
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, size - len);
    let lines = buf.toString('utf8').split('\n');
    if (size > len) lines = lines.slice(1);
    for (let i = lines.length - 1; i >= 0; i--) {
      let entry;
      try { entry = JSON.parse(lines[i]); } catch { continue; }
      if (entry.type !== 'assistant' || entry.isSidechain) continue;
      const u = entry.message && entry.message.usage;
      if (u && typeof u.input_tokens === 'number') {
        return u.input_tokens + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
      }
    }
    return null;
  } finally {
    closeSync(fd);
  }
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const tokens = contextTokens(input.transcript_path);
  if (tokens != null) {
    const state = join(STATE_DIR, (input.session_id || 'unknown') + '.nudged');
    if (tokens < THRESHOLD) {
      // dropped below threshold (compaction/clear) → re-arm
      if (existsSync(state)) unlinkSync(state);
    } else if (!existsSync(state)) {
      mkdirSync(STATE_DIR, { recursive: true });
      writeFileSync(state, String(tokens));
      const k = (n) => Math.round(n / 1000) + 'k';
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext:
            `[handoff-skills] Context is ~${k(tokens)} tokens (threshold ${k(THRESHOLD)}). ` +
            'Long contexts degrade output quality. Before handling this prompt, use the AskUserQuestion tool to offer a session handoff. ' +
            `Options: "Handoff, continue here" — run the ${PREPC_CMD} skill (writes the handoff and arms auto-resume; after the user clears, the next session picks it up automatically); ` +
            `"Handoff, resume elsewhere" — run the ${PREPARE_CMD} skill (portable; any agent's ${CONTINUE_CMD} can load it); ` +
            '"Keep going" — continue this session as-is. ' +
            'If the user declines, respect that and do not ask again this session.',
        },
      }));
    }
  }
} catch {
  // fail silent by design
}
process.exit(0);
