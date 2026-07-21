import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'hooks', 'session-start-resume.mjs');

let cwd, marker, handoff;
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'resume-test-'));
  mkdirSync(join(cwd, '.handoff'));
  marker = join(cwd, '.handoff', '.pending');
  handoff = join(cwd, '.handoff', '20260721-101500-test-topic.md');
  writeFileSync(handoff, '# handoff: test-topic\n');
});

function run(input = {}) {
  const res = spawnSync(process.execPath, [script], {
    input: typeof input === 'string' ? input : JSON.stringify({ cwd, source: 'clear', ...input }),
    encoding: 'utf8',
    env: process.env,
  });
  assert.equal(res.status, 0, 'hook must always exit 0');
  return res.stdout.trim();
}

test('fresh marker → injects resume context and consumes marker', () => {
  writeFileSync(marker, '.handoff/20260721-101500-test-topic.md');
  const out = JSON.parse(run()).hookSpecificOutput;
  assert.equal(out.hookEventName, 'SessionStart');
  assert.match(out.additionalContext, /next-steps/);
  assert.ok(out.additionalContext.includes(handoff));
  assert.ok(!existsSync(marker), 'marker consumed');
});

test('absolute path in marker works', () => {
  writeFileSync(marker, handoff);
  assert.ok(JSON.parse(run()).hookSpecificOutput.additionalContext.includes(handoff));
});

test('expired marker → silent, still consumed', () => {
  writeFileSync(marker, handoff);
  const old = (Date.now() - 3600 * 1000) / 1000;
  utimesSync(marker, old, old);
  assert.equal(run(), '');
  assert.ok(!existsSync(marker), 'expired marker still consumed');
});

test('marker pointing to missing handoff → silent, consumed', () => {
  writeFileSync(marker, '.handoff/nope.md');
  assert.equal(run(), '');
  assert.ok(!existsSync(marker));
});

test('resumed session → silent, marker kept for the real fresh start', () => {
  writeFileSync(marker, handoff);
  assert.equal(run({ source: 'resume' }), '');
  assert.ok(existsSync(marker), 'marker preserved on resume');
  assert.match(run({ source: 'startup' }), /Auto-resume/);
});

test('no marker → silent', () => {
  assert.equal(run(), '');
});

test('garbage stdin → silent exit 0', () => {
  assert.equal(run('not json'), '');
});
