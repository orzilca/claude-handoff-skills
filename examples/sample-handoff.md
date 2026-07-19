# handoff: api-rate-limit
generated: 20260214-091455
goal: Per-user rate limiting on the public REST API (100 req/min per API key, sliding window) so one client can't exhaust the DB pool.

> Example of what `/handoff-prepare` produces. A fresh session loads it with `/handoff-continue` and resumes at next-steps.

## next-steps  <!-- resume here -->
1. Mount limiter on `/v1/export` and `/v1/bulk` in `src/router.ts` (mirror `/v1/search` at :42).
2. Add `Retry-After` header to 429 response in `src/middleware/rateLimit.ts`.
3. Resolve open-questions, then handle the no-API-key path.
4. Run `scripts/hammer.sh` against all three routes; confirm DB pool stays under limit.
5. Add `RATE_LIMIT_RPM` to deploy manifest before merging.

## state
- done: sliding-window limiter in `src/middleware/rateLimit.ts`, wired into router
- done: chose sliding-window over fixed-window (2x burst at boundary)
- wip: per-route mounting — `/v1/search` done; `/v1/export`, `/v1/bulk` unguarded
- todo: load test; `Retry-After` on 429

## changes
- A `src/middleware/rateLimit.ts` — sliding-window limiter, keys on `X-Api-Key`
- M `src/router.ts:42` — mounted limiter on `/v1/search` only
- M `src/config.ts:18` — added `RATE_LIMIT_RPM` (default 100)

## decisions
- sliding window — fixed-window doubles burst at boundary; rejected: token bucket (overkill)
- Redis (existing instance) — survives restarts, shared across replicas; rejected: in-memory
- key on API key, not IP — IPs shared behind NAT

## verified
- works: `/v1/search` returns 429 after 100 req/min — curl loop via `scripts/hammer.sh`
- broken: `/v1/export`, `/v1/bulk` not limited; no load test run

## gotchas
- Requests without `X-Api-Key` bypass limiting entirely — see open-questions.
- Redis down → limiter fails OPEN (allows traffic). Confirm acceptable.
- `RATE_LIMIT_RPM` not in deploy manifest yet; staging/prod would silently use default.

## git
- branch: feat/rate-limit
- uncommitted: 3 files (see `git status --short`)
- recent: a1b2c3d chore: bump redis client

## open-questions
- No-API-key requests: hard 429 or per-IP fallback?
- Redis unreachable: fail-open vs fail-closed?
