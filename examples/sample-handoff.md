# Handoff — add rate limiting to the API — 20260214-091455

> This is an example of what `/handoff-prepare` produces. A fresh session loads it
> with `/handoff-continue` and picks up from "Next steps". Yours will look like this.

## Resume instruction
You are continuing prior work with no memory of it. Read this whole file, then start at "Next steps".

## Goal
Add per-user rate limiting to the public REST API so a single client can't exhaust the DB connection pool. Target: 100 req/min per API key, sliding window.

## State: done / in-progress / not-started
- [x] Chose sliding-window over fixed-window — fixed-window allowed 2x burst at the boundary.
- [x] Added Redis-backed limiter in `src/middleware/rateLimit.ts` — wired into the router.
- [~] Applying the middleware per-route — done for `/v1/search`; `/v1/export` and `/v1/bulk` still unguarded.
- [ ] Load test to confirm the pool no longer saturates.
- [ ] Return `Retry-After` header on 429 (currently just status + JSON body).

## Changes this session
- Created: `src/middleware/rateLimit.ts` — sliding-window limiter; keys on `X-Api-Key`.
- Modified: `src/router.ts:42` — mounted limiter on `/v1/search` only (others pending).
- Modified: `src/config.ts:18` — added `RATE_LIMIT_RPM` (default 100).

## Key decisions
| Decision | Why | Alternatives rejected |
|---|---|---|
| Sliding window | Fixed-window doubles burst at boundary | Fixed-window; token bucket (overkill here) |
| Redis (existing instance) | Already in the stack; survives restarts | In-memory (breaks across replicas) |
| Key on API key, not IP | IPs are shared behind NAT | Per-IP |

## What works / what doesn't
- Works: `/v1/search` returns 429 after 100 req/min — verified with a curl loop (`scripts/hammer.sh`).
- Broken / untested: `/v1/export` and `/v1/bulk` are NOT yet limited. No load test run.

## Caveats, gotchas, fail points
- The limiter reads `X-Api-Key` — requests without it currently bypass limiting entirely. Decide: reject, or fall back to per-IP.
- Redis key TTL is set to the window size; if Redis is down the limiter fails OPEN (allows traffic). Confirm that's acceptable.
- `RATE_LIMIT_RPM` must be set in staging/prod env — defaults to 100 but is not in the deploy manifest yet.

## Git state
Branch `feat/rate-limit`, 3 files uncommitted (see `git status --short`). Last commit: `a1b2c3d chore: bump redis client`.

## Open questions
- What should unauthenticated (no API key) requests do — hard 429, or per-IP fallback?
- Fail-open vs fail-closed when Redis is unreachable?

## Next steps (start here)
1. Mount the limiter on `/v1/export` and `/v1/bulk` in `src/router.ts` (mirror the `/v1/search` line at :42).
2. Add the `Retry-After` header to the 429 response in `src/middleware/rateLimit.ts`.
3. Resolve the no-API-key question above, then handle that path.
4. Run `scripts/hammer.sh` against all three routes and confirm the DB pool stays under limit.
5. Add `RATE_LIMIT_RPM` to the deploy manifest before merging.
