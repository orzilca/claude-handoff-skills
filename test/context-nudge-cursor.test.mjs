import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'hooks', 'context-nudge-cursor.mjs');

function run(stdin) {
  const res = spawnSync(process.execPath, [script], { input: stdin, encoding: 'utf8' });
  assert.equal(res.status, 0, 'hook must always exit 0');
  return JSON.parse(res.stdout);
}

test('preCompact payload → user_message with stats', () => {
  const out = run(JSON.stringify({
    hook_event_name: 'preCompact',
    trigger: 'auto',
    context_usage_percent: 85,
    context_tokens: 120000,
  }));
  assert.match(out.user_message, /85% of the context window/);
  assert.match(out.user_message, /~120k tokens/);
  assert.match(out.user_message, /\/handoff-prepare/);
});

test('payload without stats → generic message', () => {
  const out = run(JSON.stringify({ hook_event_name: 'preCompact', trigger: 'manual' }));
  assert.match(out.user_message, /Context is full and about to be compacted/);
});

test('garbage stdin → empty object, exit 0', () => {
  assert.deepEqual(run('not json'), {});
});
