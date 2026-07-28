# CLAUDE.md — working on VibeLens

Guidance for AI coding assistants (Claude Code, Cursor, Antigravity, Copilot)
contributing to this repository. Read this before editing.

## What this project is

VibeLens is an **MCP server** that gives an AI coding assistant vision into a
locally running web app. It exposes exactly one tool, `inspect_localhost_ui`,
which returns a screenshot, console/network diagnostics, and a token-optimized
DOM snapshot in a single call.

It is a developer tool that runs on the user's own machine and drives a real
browser. That makes correctness around **security** and **resource cleanup**
more important than features.

## Stack

- Node.js ≥ 20, ESM only (`"type": "module"`). Playwright 1.62 requires >=20 and
  vitest 4 supports ^20 || ^22 || >=24, so 20 is the floor.
- TypeScript, `strict` (plus `noUncheckedIndexedAccess`)
- `@modelcontextprotocol/sdk` — MCP server + stdio transport
- `playwright` — headless Chromium
- `zod` — tool input schema
- `vitest` — tests

Dependencies are **pinned exactly**. Do not add a dependency without a concrete
reason; do not swap Playwright for Puppeteer.

## Architecture

```
src/index.ts     Executable entrypoint (#!/usr/bin/env node). Connects the
                 server to StdioServerTransport. Deliberately thin.
src/server.ts    MCP server: tool schema, description, response assembly,
                 error formatting. No side effects on import.
src/browser.ts   Playwright capture engine: launch → observe → capture → close.
src/dom.ts       sanitizeDomInPage() runs INSIDE the browser; truncateDom()
                 runs in Node.
src/security.ts  validateLocalUrl() — the SSRF allowlist.
src/types.ts     Shared types, VIEWPORT_PRESETS, LIMITS, CaptureError.
```

Data flow: `server.ts` → `captureUIState()` → `{ image, diagnostics, dom }` →
two MCP content blocks (`image` first, then `text`).

## Invariants — do not break these

1. **stdout belongs to the MCP transport.** Never `console.log`. Use the `log()`
   helper in `server.ts`, which writes to stderr. A stray stdout write corrupts
   the JSON-RPC stream and silently breaks the integration.
2. **The browser is always closed in a `finally` block.** A leaked Chromium
   costs hundreds of MB and the server is long-lived.
3. **Validate the URL before launching anything.** `validateLocalUrl()` is the
   only gate against SSRF. Never add a bypass, an "allow any host" flag, or DNS
   resolution of arbitrary hostnames (that reintroduces DNS rebinding).
   Instance-metadata addresses stay unconditionally blocked.
4. **A failed capture must never crash the process.** Catch, wrap in
   `CaptureError`, return `{ isError: true, content: [text] }`.
5. **Every error the model sees needs a next step.** `CaptureError` carries both
   a `message` (what happened) and a `hint` (what to do). Keep that contract.
6. **Respect the token budget.** Everything in `LIMITS` exists to protect the
   caller's context window. Raising a limit needs justification; adding a new
   unbounded field to the payload is not acceptable.
7. **`sanitizeDomInPage` must stay self-contained.** Playwright serializes it
   with `Function.prototype.toString()`, so it cannot reference imports or
   module-scope variables — configuration arrives via its single argument.
8. **The tool stays read-only.** It observes pages. It does not click, type,
   navigate the user's app into a mutating state, or write files.

## Commands

```bash
npm install
npx playwright install chromium   # one-time, required for tests
npm run typecheck                 # tsc --noEmit
npm test                          # vitest run (real browser captures included)
npm run build                     # emit dist/
npm run dev                       # run from source over stdio
node scripts/smoke.mjs            # spawn dist/ and drive it over real stdio
node scripts/validate-manifests.mjs
npm run validate:plugin           # claude plugin validate .
```

Always run `npm run typecheck && npm test` before declaring work done. The test
suite launches Chromium for real; a green run means the whole pipeline works.

## Distribution surface

This repo is three things at once. Changing one usually means changing another:

| File | Role |
| --- | --- |
| `package.json` | npm package `mcp-vibelens` (the actual server binary) |
| `plugin/.claude-plugin/plugin.json` | Claude Code plugin manifest |
| `.claude-plugin/marketplace.json` | one-plugin marketplace catalog, `source: "./plugin"` |
| `plugin/.mcp.json` | how the plugin launches the server (`npx -y mcp-vibelens@1`) |
| `.mcp.json` | identical copy, for anyone who clones this repo |
| `plugin/skills/*/SKILL.md` | twelve skills: 4 debugging, 7 design craft, 1 verification |
| `plugin/agents/*.md` | four subagents: ui-debugger, ui-reviewer, design-reviewer, frontend-builder |
| `plugin/hooks/hooks.json` | two advisory PostToolUse hooks: unverified change, raw values |
| `docs/design/*.md` | the design knowledge base the craft skills cite instead of restating |

Rules:

- **The plugin must stay in `plugin/`, and `plugin/` must never contain a
  `package.json`.** Claude Code runs `npm install` inside a plugin directory
  that has one, which put 112 MB of this package's devDependencies into the
  plugin cache when the marketplace source was `"./"`. The manifest validator
  enforces `source: "./plugin"` and fails if a `package.json` appears.
- **Plugin components live at the plugin root**, never inside
  `plugin/.claude-plugin/`. Only `plugin.json` goes in there.
- Every `SKILL.md` needs YAML frontmatter with a `description` written for a
  model (when to use it), and every agent needs a `name`. The validator checks
  both, because a skill without a description is never model-invoked.
- **Version bumps go in `package.json` *and* `plugin/.claude-plugin/plugin.json`.**
  Claude Code only ships an update when `plugin.json`'s `version` string
  changes, and `scripts/validate-manifests.mjs` fails the build if they drift.
- Never set `version` on the marketplace entry — `plugin.json` silently wins and
  the marketplace value becomes misleading dead config.
- Renaming the npm package means updating both `.mcp.json` files and every IDE
  snippet in `README.md`. The validator checks the reference and that the two
  `.mcp.json` copies stay identical.
- `files` in `package.json` is an allowlist: plugin, docs, assets and CI files
  deliberately do not ship in the npm tarball.
- Release steps live in `RELEASE.md`. npm publishes before the plugin, because
  the plugin only launches the published package.

- **Hooks stay advisory.** Every hook command must end with an explicit `exit 0`,
  use only `jq`/`grep`/`echo`/`sed`, never write a file, and print nothing when
  there is nothing to report. The validator asserts the `exit 0`. A hook that can
  block a tool call turns a helpful nudge into a broken session.
- **A design skill must cite `docs/design/`, not restate it.** If a rule needs
  changing, change it in the knowledge base so all twelve skills inherit the fix.
  The validator asserts all six design documents exist.
- The demo fixture in `scripts/assets/` is deliberately not a pricing page: a
  pricing table in the README screenshot reads as VibeLens's own pricing, and
  this project is free with no paid tier.

## Documentation map

Keep these in sync when behaviour changes — the validator checks that every
README link resolves, but not that the prose is still true.

| Path | Contents |
| --- | --- |
| `README.md` | landing page: install, IDE config, tool reference, security |
| `docs/ARCHITECTURE.md` | modules, request lifecycle, resource and token model |
| `docs/adr/` | six ADRs recording why each significant choice was made |
| `docs/design/` | ANTI-SLOP, TYPOGRAPHY, COLOR, SPACING-LAYOUT, MOTION — cited by the design skills |
| `docs/PRD-TRD.md` | product and technical requirements |
| `docs/TROUBLESHOOTING.md` | every error code, per-IDE diagnosis |
| `docs/FAQ.md` | honest answers, including the limitations |
| `CONTRIBUTING.md` | setup, invariants, test conventions, commit style |
| `SECURITY.md` | threat model, reporting, residual risks |
| `RELEASE.md` | the two-artifact release process |

## Documentation site

`scripts/site/build.mjs` generates the site at <https://soumyachk101.github.io/VibeLens/>
into `site-dist/` (gitignored) and `.github/workflows/pages.yml` deploys it.

- **Markdown stays the single source.** Every reference page is rendered from its
  `.md` file, and cross-links between those files are rewritten to site URLs by
  `resolveLink`. Only the landing page, the install guide and the tool reference
  are authored in the generator. Never duplicate documentation prose into HTML.
- Adding a page means adding an entry to `NAV` in `build.mjs`; that array is both
  the sidebar and the page manifest.
- Renderer methods must use `this.parser.parseInline(tokens)`. Calling
  `marked.parseInline` with a renderer in the options recurses until the stack
  overflows, and calling it without one silently bypasses link rewriting.
- `node scripts/site/check.mjs` is the gate: it link-checks every generated page
  and then inspects the site with `inspect_localhost_ui`, failing on any console
  error. Run it after touching the generator or the stylesheet.
- **Code is highlighted at build time** by shiki with both themes emitted as CSS
  variables (`defaultColor: false`). No highlighter ships to the browser and the
  theme toggle needs no re-highlighting. Add a language to `LANGS` in
  `build.mjs` before using it in a fence, or it falls back to plain text.
- **Search is a build-time index** (`search-index.json`, ~56 kB) fetched on first
  use, not on page load. Ranking is title prefix > title > heading > group > body,
  and every term must match. There is no search service and no network call.
- `site/styles.css` is deliberately framework-free and follows `docs/design/`.
  It is the project's own dogfood: if the docs site breaks an anti-slop rule, the
  rule is not credible.

## README assets

`assets/*.svg` are hand-authored; `assets/demo.gif` is generated from real tool
output, not mocked up:

```bash
npm run build
node scripts/assets/capture-demo.mjs   # real inspect_localhost_ui captures
node scripts/assets/build-gif.mjs      # composes frames, ffmpeg assembles the gif
node scripts/assets/measure-dom.mjs    # reproduces the 95.4% DOM figure
```

If you change a quoted measurement in the README, re-run the script that
produces it and paste the real number. Do not estimate.

## Testing conventions

- `tests/security.test.ts` — table-driven allow/block cases. **Any change to
  `security.ts` requires new cases here.**
- `tests/dom.test.ts` — pure truncation logic.
- `tests/capture.test.ts` — end-to-end against `tests/fixture-server.ts`, a local
  server whose page deliberately contains a console error, an uncaught
  exception, a 404 image, a base64 data URI, a huge SVG path and long text.
- `tests/server.test.ts` — drives the real MCP server through
  `InMemoryTransport` with a real `Client`, i.e. the protocol surface an IDE
  sees.

Prefer extending the fixture page over mocking Playwright. Mocks here would test
nothing that matters.

## Code style

- Comment the *why*, not the *what*. Existing comments explain trade-offs
  (why JPEG, why `networkidle` is best-effort, why link-local is blocked) —
  match that register.
- Small, named, single-purpose functions. No classes except `CaptureError`.
- Use the `LIMITS` constants; never inline a magic number.
- Keep the tool schema small and bounded. One required string plus defaulted,
  enumerated options is what LLMs call correctly on the first try.

## When adding a tool parameter

1. Add it to `inputSchema` in `server.ts` with a `.describe()` written *for a
   model*, and a safe default.
2. Thread it through `CaptureOptions` in `types.ts` and `captureUIState`.
3. Clamp or validate it — assume the value is model-generated and hostile.
4. Surface it in `meta`/`summary` so the model can see what it actually got.
5. Add a test, then update `README.md` and `docs/PRD-TRD.md`.

## Roadmap (not yet built)

Element-scoped capture, pre-capture interaction, multi-viewport diffing, full
network waterfall, accessibility-tree output. Anything touching interaction will
break invariant 8 as written — update this file deliberately if that changes.
