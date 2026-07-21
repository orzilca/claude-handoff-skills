import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'hooks', 'context-nudge.mjs');

const assistant = (inputTokens, extra = {}) =>
  JSON.stringify({
    type: 'assistant',
    message: { usage: { input_tokens: inputTokens, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } },
    ...extra,
  });

let dir, stateDir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'nudge-test-'));
  stateDir = join(dir, 'state');
});

function run({ lines, sessionId = 's1', threshold = 1000, transcriptPath, stdin }) {
  let path = transcriptPath;
  if (path === undefined) {
    path = join(dir, 'transcript.jsonl');
    writeFileSync(path, lines.join('\n') + '\n');
  }
  const res = spawnSync(process.execPath, [script], {
    input: stdin ?? JSON.stringify({ session_id: sessionId, transcript_path: path }),
    encoding: 'utf8',
    env: { ...process.env, HANDOFF_NUDGE_TOKENS: String(threshold), HANDOFF_NUDGE_STATE_DIR: stateDir },
  });
  assert.equal(res.status, 0, 'hook must always exit 0');
  return res.stdout.trim();
}

const parseNudge = (out) => JSON.parse(out).hookSpecificOutput;

test('below threshold → silent', () => {
  assert.equal(run({ lines: [assistant(500)] }), '');
});

test('above threshold → emits additionalContext', () => {
  const out = parseNudge(run({ lines: [assistant(1500)] }));
  assert.equal(out.hookEventName, 'UserPromptSubmit');
  assert.match(out.additionalContext, /AskUserQuestion/);
  assert.match(out.additionalContext, /~2k tokens/);
  assert.match(out.additionalContext, /Handoff, continue here/);
  assert.match(out.additionalContext, /handoff-prep-continue/);
  assert.match(out.additionalContext, /Handoff, resume elsewhere/);
});

test('cache tokens count toward total', () => {
  const line = JSON.stringify({
    type: 'assistant',
    message: { usage: { input_tokens: 100, cache_read_input_tokens: 800, cache_creation_input_tokens: 200 } },
  });
  assert.match(run({ lines: [line] }), /additionalContext/);
});

test('uses the last assistant entry, not earlier ones', () => {
  assert.equal(run({ lines: [assistant(5000), assistant(200)] }), '');
});

test('nudges only once per session', () => {
  assert.match(run({ lines: [assistant(1500)] }), /additionalContext/);
  assert.equal(run({ lines: [assistant(1600)] }), '');
});

test('re-arms after usage drops below threshold', () => {
  assert.match(run({ lines: [assistant(1500)] }), /additionalContext/);
  assert.equal(run({ lines: [assistant(100)] }), '');
  assert.match(run({ lines: [assistant(1500)] }), /additionalContext/);
});

test('separate sessions nudge independently', () => {
  assert.match(run({ lines: [assistant(1500)], sessionId: 'a' }), /additionalContext/);
  assert.match(run({ lines: [assistant(1500)], sessionId: 'b' }), /additionalContext/);
});

test('skips sidechain entries', () => {
  assert.equal(run({ lines: [assistant(200), assistant(9000, { isSidechain: true })] }), '');
});

test('ignores malformed lines and non-assistant entries', () => {
  const lines = ['not json', JSON.stringify({ type: 'user' }), assistant(1500), '{"type":"progress"}'];
  assert.match(run({ lines }), /additionalContext/);
});

test('missing transcript → silent exit 0', () => {
  assert.equal(run({ transcriptPath: join(dir, 'nope.jsonl') }), '');
});

test('garbage stdin → silent exit 0', () => {
  assert.equal(run({ lines: [assistant(1500)], stdin: 'not json' }), '');
});

test('no usage entries at all → silent', () => {
  assert.equal(run({ lines: [JSON.stringify({ type: 'user' })] }), '');
});

test('threshold env override respected', () => {
  assert.equal(run({ lines: [assistant(150000)], threshold: 200000 }), '');
  assert.match(run({ lines: [assistant(150000)], threshold: 100000 }), /additionalContext/);
});
