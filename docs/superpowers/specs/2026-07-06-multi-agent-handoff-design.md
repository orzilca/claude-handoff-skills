# Multi-agent handoff skills — design

## Goal

Make the `handoff-prepare` / `handoff-continue` skills work across coding agents — Claude Code, Codex CLI, Cursor, Gemini CLI, and Grok Build — instead of being Claude Code-only. Scope is **"same skill, any agent"**: a handoff is prepared and continued within the *same* agent; cross-agent handoff (prepare in Claude, continue in Codex) is explicitly out of scope, though the design leaves the door open.

## Principle

One canonical source per skill. A zero-dependency Node generator emits each agent's native format into a committed `dist/`. No target is privileged — Claude Code becomes just another generated output, so no Claude-isms leak into the source.

## Repo layout

```
src/
  handoff-prepare.md      # neutral frontmatter + body with {{tokens}}
  handoff-continue.md
scripts/
  agents.mjs              # per-agent config table (single source of per-agent facts)
  generate.mjs            # reads src/, substitutes tokens, wraps per-agent, writes dist/
  check.mjs              # verification: asserts all files present + no {{unsubstituted}} tokens
dist/                     # committed, so installing needs no build step
  claude/
    handoff-prepare/SKILL.md
    handoff-continue/SKILL.md
  codex/
    handoff-prepare.md
    handoff-continue.md
  cursor/
    handoff-prepare.md
    handoff-continue.md
  gemini/
    handoff-prepare.toml
    handoff-continue.toml
examples/sample-handoff.md   # unchanged
package.json                 # "build": generate, "test": check
README.md                    # rewritten: per-agent install
```

Grok Build reads Claude-format skills natively, so it has **no separate emit** — its install instructions point at `dist/claude/`.

The current top-level `handoff-prepare/` and `handoff-continue/` directories are removed; their content moves into `src/` (neutralized) and is regenerated into `dist/claude/`.

## Canonical source format

Each `src/*.md` is a markdown file with neutral YAML frontmatter (`name`, `description`) and a body. The body uses `{{TOKEN}}` placeholders wherever an agent-specific string is needed. The frontmatter `description` is reused verbatim by every agent that has a description field (Claude, Gemini).

## Template tokens

The generator substitutes these per agent. Values live in `scripts/agents.mjs`.

| Token | Claude Code | Codex CLI | Cursor | Gemini CLI |
|---|---|---|---|---|
| `{{HANDOFF_DIR}}` | `.claude/tmp/handoff/` | `.codex/handoff/` | `.cursor/handoff/` | `.gemini/handoff/` |
| `{{ARGS}}` | `$ARGUMENTS` | `$ARGUMENTS` | *(user text is appended by the harness; token renders as a short "the name/path you passed" phrase)* | `{{args}}` |
| `{{FRESH_SESSION}}` | `/clear` | `/new` | starting a new chat | `/clear` |
| `{{PREPARE_CMD}}` | `/handoff-prepare` | `/handoff-prepare` | `/handoff-prepare` | `/handoff-prepare` |
| `{{CONTINUE_CMD}}` | `/handoff-continue` | `/handoff-continue` | `/handoff-continue` | `/handoff-continue` |

`{{PREPARE_CMD}}` / `{{CONTINUE_CMD}}` are identical across agents today but stay tokenized so a future agent with different invocation syntax needs only a config-table change.

## Per-agent wrapping

`scripts/agents.mjs` is an array of agent descriptors. Each descriptor provides:

- `id` — `claude` | `codex` | `cursor` | `gemini`
- token values (the column above)
- `outPath(skillName)` — where the emitted file goes under `dist/<id>/`
- `wrap({ name, description, body })` — returns the final file contents in the agent's format

Wrapping per format:

- **Claude** → `dist/claude/<name>/SKILL.md`: YAML frontmatter with `name` + `description`, then the body.
- **Codex** → `dist/codex/<name>.md`: `# <Title>` H1, then the body. No frontmatter.
- **Cursor** → `dist/cursor/<name>.md`: `# <Title>` H1, then the body. No frontmatter.
- **Gemini** → `dist/gemini/<name>.toml`: TOML with `description = "..."` and a multiline `prompt = """..."""` containing the body. TOML string escaping handled by the wrapper.

## Generator behavior (`generate.mjs`)

1. Read each file in `src/`, split YAML frontmatter (`name`, `description`) from body.
2. For each agent descriptor: substitute all `{{TOKEN}}`s in the body using the descriptor's values, call `wrap()`, write to `outPath`.
3. Create parent dirs as needed. Overwrite existing outputs (idempotent).
4. Zero external dependencies — only Node stdlib (`fs`, `path`). Frontmatter parsing is a small hand-rolled split on `---` (the source frontmatter is trivial: two scalar keys), not a YAML library.

## Content neutralization

The canonical body drops these current Claude-isms:

- The `.claude/tmp/*.sh` bash-hygiene instruction (it leaked a personal `CLAUDE.md` rule into a distributable skill) — removed. The generic "use single commands, avoid pipes where the agent restricts them" intent is dropped entirely; it was not load-bearing.
- The trailing "Works in any Claude Code surface (terminal, IntelliJ, VS Code, web)." line — removed.
- Hardcoded `.claude/tmp/handoff/` → `{{HANDOFF_DIR}}`.
- Hardcoded `/clear` → `{{FRESH_SESSION}}`.
- Hardcoded `/handoff-prepare` / `/handoff-continue` → `{{PREPARE_CMD}}` / `{{CONTINUE_CMD}}`.
- The `date +%Y%m%d-%H%M%S`, `git status --short`, `git log`, `mkdir -p` commands stay — they are portable shell that works in every target agent.

Everything else (the template, the "what goes in the handoff" guidance, the common-mistakes list, the resolve-which-handoff logic) is already agent-agnostic and carries over unchanged.

## Verification (`check.mjs`, wired as `npm test`)

Runtime behavior worth asserting:

1. Run the generator (or assume `dist/` is fresh), then for every `(agent, skill)` pair assert the expected output file exists.
2. Assert no emitted file contains a literal `{{` — proves every token was substituted.
3. Assert each Gemini `.toml` parses as valid TOML (minimal check: `prompt` key present and closed) and each Claude `SKILL.md` starts with a `---` frontmatter block containing `name:` and `description:`.

No tests for things the format guarantees; only the substitution/packaging behavior that can actually break.

## Install (README, per agent)

- **Claude Code** — copy `dist/claude/*` → `~/.claude/skills/`.
- **Codex CLI** — copy `dist/codex/*.md` → `~/.codex/prompts/`.
- **Cursor** — copy `dist/cursor/*.md` → `~/.cursor/commands/` (global) or project `.cursor/commands/`.
- **Gemini CLI** — copy `dist/gemini/*.toml` → `~/.gemini/commands/`.
- **Grok Build** — Grok reads Claude-format skills; install `dist/claude/*` into Grok's skills directory. README states the path and notes that Grok also reads `~/.claude/skills/` directly if present, so a Claude install may already cover it.

README keeps the existing symlink-for-updates tip, adapted per agent.

## Build-time assumptions to confirm (not blockers)

- **Grok skills dir path** — likely `~/.grok/skills/` or Grok reads `~/.claude/skills/` directly. Confirm when writing README; state both.
- **Codex / Cursor argument passing** — Codex supports `$ARGUMENTS`; Cursor appends user text to the command as context. Confirm exact behavior when writing those variants; the `{{ARGS}}` phrasing degrades gracefully either way (the body already says "optional argument").

## Out of scope (YAGNI)

- Cross-agent handoff (prepare in one agent, continue in another).
- An interactive installer that copies to the right global dir per agent — documented copy commands suffice.
- Any runtime/CI beyond `npm run build` + `npm test`.
