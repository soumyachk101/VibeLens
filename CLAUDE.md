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

- Node.js ≥ 18, ESM only (`"type": "module"`)
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
| `.claude-plugin/plugin.json` | Claude Code plugin manifest |
| `.claude-plugin/marketplace.json` | one-plugin marketplace catalog, `source: "./"` |
| `.mcp.json` | how the plugin launches the server (`npx -y mcp-vibelens@1`) |
| `skills/*/SKILL.md` | the two plugin skills |

Rules:

- **Version bumps go in `package.json` *and* `.claude-plugin/plugin.json`.**
  Claude Code only ships an update when `plugin.json`'s `version` string
  changes, and `scripts/validate-manifests.mjs` fails the build if they drift.
- Never set `version` on the marketplace entry — `plugin.json` silently wins and
  the marketplace value becomes misleading dead config.
- Renaming the npm package means updating `.mcp.json` args and every IDE snippet
  in `README.md`. The manifest validator checks the `.mcp.json` reference.
- `files` in `package.json` is an allowlist: plugin and CI files deliberately do
  not ship in the npm tarball.
- Release steps live in `RELEASE.md`. npm publishes before the plugin, because
  the plugin only launches the published package.

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
