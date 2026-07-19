#!/usr/bin/env node
// Cursor preCompact hook: compaction only fires when context is full, so
// suggest a handoff instead. Observational only — Cursor hooks can't block
// compaction or inject agent context mid-conversation; user_message is the lever.
import { readFileSync } from 'node:fs';

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const detail = [
    input.context_usage_percent != null ? input.context_usage_percent + '% of the context window' : null,
    input.context_tokens != null ? '~' + Math.round(input.context_tokens / 1000) + 'k tokens' : null,
  ].filter(Boolean).join(', ');
  console.log(JSON.stringify({
    user_message:
      '[handoff-skills] Context is full' + (detail ? ' (' + detail + ')' : '') +
      ' and about to be compacted. Compaction loses the why behind decisions — ' +
      'consider running /handoff-prepare, then starting a new chat and running /handoff-continue.',
  }));
} catch {
  console.log('{}');
}
process.exit(0);
