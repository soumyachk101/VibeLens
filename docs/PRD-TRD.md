# VibeLens — PRD & TRD

**Product:** VibeLens (Auto-UI Debugger MCP server)
**Version:** 1.0.0
**Status:** implemented — this document describes what was built, not just what
was planned.

---

# 1. Product Requirements

## 1.1 Audience

Frontend and full-stack developers working in AI-assisted IDEs: Claude Code,
Cursor, Google Antigravity, Windsurf, VS Code (Copilot agent mode), Claude
Desktop.

## 1.2 Problem

An AI assistant can generate a complete pricing page, but it cannot see the
result. The rendered output is invisible to it, so the developer becomes a
human framebuffer:

1. Developer asks for a page. The model writes it.
2. Developer opens `localhost:3000`, sees the CTA overflowing its card.
3. Developer types a prose description: *"the button sticks out on the right"*.
4. The model guesses which class is responsible and proposes a change.
5. Repeat 3–4 times.

Each loop costs a full round trip, and the model is reasoning about markup it
has to imagine. Two failure modes dominate:

- **Invisible errors.** A React hydration mismatch or a 404 hero image shows up
  in the console, not in the developer's description.
- **Selector hallucination.** The model edits `.btn-primary` when the element
  actually carries `.cta-button`, because it is recalling its own earlier output
  rather than reading the DOM.

## 1.3 Solution

An MCP server exposing one tool. When the assistant needs to know what the page
looks like, it calls the tool and receives, in a single response:

1. a **screenshot** — visual truth about layout, spacing, colour, overflow;
2. **console and network diagnostics** — errors the screenshot cannot show;
3. a **sanitized DOM snapshot** — the real element tree with real class names.

The model then edits a selector that exists, and can re-run the tool to confirm
the fix. The developer never has to describe the bug.

## 1.4 Features (delivered in 1.0)

| Feature | Detail |
| --- | --- |
| Screenshot capture | Base64 JPEG (quality 75); viewport or `fullPage`. |
| Viewport emulation | `desktop` 1920×1080, `tablet` 820×1180 @2x, `mobile` 390×844 @2x with touch + mobile emulation. |
| Console sniffing | `console.error` and `console.warn` with source location. `console.log` is dropped as noise. |
| Uncaught exception capture | `pageerror` events — React render crashes surface even when nothing is logged. |
| Failed request capture | Network-level failures *and* HTTP 4xx/5xx responses (the 404-image case). |
| DOM extraction | In-page sanitizer preserving structure, ids, classes, ARIA and test hooks. |
| Wait mechanism | `delay` (0–15000 ms) plus a best-effort `networkidle` wait for hydration and data fetching. |
| Diagnostic summary | Counts and timings so the model can see at a glance whether the page is healthy. |

## 1.5 Non-goals for 1.0

Interaction before capture, element-scoped capture, multi-viewport diffing in one
call, a full network waterfall, accessibility-tree output, and inspecting remote
(non-local) URLs. The last one is a permanent non-goal: it is the security
boundary, not a missing feature.

## 1.6 Success criteria

- One tool call replaces the describe-the-bug loop.
- The model's fix references a class that exists in the page (verifiable in the
  returned DOM).
- Payload stays small enough to call repeatedly in one session: a typical page
  yields well under 1 KB of DOM text.
- No leaked browser processes across a long IDE session.

---

# 2. Technical Requirements

## 2.1 Stack

| Concern | Choice | Reason |
| --- | --- | --- |
| Runtime | Node.js ≥ 18, ESM | Matches the MCP SDK and every target IDE. |
| Language | TypeScript, `strict` | The tool input is model-generated; types catch shape errors early. |
| Browser | `playwright` (Chromium) | Reliable with modern frameworks; first-class console/network events. |
| Protocol | `@modelcontextprotocol/sdk` | Official server + stdio transport. |
| Validation | `zod` | Schema doubles as the JSON Schema the IDE shows the model. |
| Tests | `vitest` | Fast, ESM-native. |

## 2.2 Architecture

```
IDE (MCP host)
   │  stdio, JSON-RPC
   ▼
src/index.ts ── StdioServerTransport
   │
src/server.ts ── tool schema, response assembly, error formatting
   │
src/browser.ts ── captureUIState()
   │   1. validateLocalUrl()            [src/security.ts]  ← before any launch
   │   2. chromium.launch()
   │   3. attach console/pageerror/requestfailed/response listeners
   │   4. page.goto(url, waitUntil: "load")
   │   5. best-effort networkidle (5 s cap), then delay
   │   6. page.evaluate(sanitizeDomInPage)  [src/dom.ts]
   │   7. page.screenshot({ type: "jpeg", quality: 75 })
   │   8. finally → browser.close()
   ▼
{ image block, text block }
```

## 2.3 Tool contract

```jsonc
{
  "name": "inspect_localhost_ui",
  "annotations": { "readOnlyHint": true, "openWorldHint": false },
  "inputSchema": {
    "type": "object",
    "properties": {
      "url":      { "type": "string" },
      "viewport": { "type": "string", "enum": ["desktop", "tablet", "mobile"], "default": "desktop" },
      "delay":    { "type": "integer", "minimum": 0, "maximum": 15000, "default": 1000 },
      "fullPage": { "type": "boolean", "default": false }
    },
    "required": ["url"]
  }
}
```

Response: `content: [ImageContent, TextContent]`.

- `ImageContent` — `{ type: "image", data: <base64>, mimeType: "image/jpeg" }`
- `TextContent` — JSON string: `summary`, `consoleLogs`, `uncaughtPageErrors`,
  `failedRequests`, `simplifiedDOM` (largest field, therefore last).

## 2.4 Security

**Threat model.** The tool takes a URL from an LLM, which may itself be
influenced by untrusted content, and opens it in a browser on the developer's
machine with their local network access. Unconstrained, that is an SSRF
primitive.

**Controls.**

| Control | Implementation |
| --- | --- |
| Allowlist, not denylist | `validateLocalUrl()` permits `localhost`, `*.localhost`, `127.0.0.0/8`, `0.0.0.0`, `10/8`, `172.16/12`, `192.168/16`, `[::1]`, `fc00::/7`, `fe80::/10`. Everything else is refused. |
| No DNS resolution | Any hostname that is not `localhost`-based is rejected outright rather than resolved — resolving would permit DNS rebinding. |
| Metadata endpoints | `169.254.169.254`, `169.254.170.2`, `fd00:ec2::254`, `100.100.100.200` blocked unconditionally; all of IPv4 link-local `169.254/16` excluded from the allowlist. |
| Scheme restriction | Only `http:` and `https:`. |
| No credentials | URLs with `user:pass@` are refused. |
| Fail-closed ordering | Validation happens before the browser launches, so a rejected URL costs no process. |
| Obfuscated IPs | WHATWG URL canonicalization normalizes octal/decimal/hex forms *before* the check, so `0177.0.0.1` is evaluated as `127.0.0.1` and `0x08080808` as `8.8.8.8` (rejected). Verified by test. |
| Read-only annotation | `readOnlyHint: true` — the tool observes, never mutates. |

**Residual risk (documented, not mitigated in code):** rendered page content is
untrusted input. Text in a page could attempt prompt injection against the
calling assistant. The DOM snapshot must be treated as data.

## 2.5 Context-window budget

Constants in `src/types.ts`:

| Limit | Value | Purpose |
| --- | --- | --- |
| `MAX_DOM_CHARS` | 20,000 | Hard cap, with an in-band truncation marker. |
| `MAX_TEXT_LENGTH` | 160 | Per text node. |
| `MAX_ATTR_LENGTH` | 300 | Per attribute; `data:` URIs replaced outright. |
| `MAX_CONSOLE_ENTRIES` | 40 | Per capture. |
| `MAX_CONSOLE_LENGTH` | 600 | Per message. |
| `MAX_FAILED_REQUESTS` | 20 | Deduplicated by URL + failure. |

Sanitizer behaviour: drops `<script>`, `<style>`, `<noscript>`, `<template>`,
`<link>`, `<meta>`, `<base>`, `<title>` and comments; collapses `<svg>`,
`<canvas>`, `<iframe>`, `<video>`, `<audio>`, `<object>`, `<embed>`, `<map>`,
`<picture>` to empty placeholders; keeps only layout-relevant attributes plus
`aria-*` and `data-testid`/`-test`/`-cy`/`-qa`.

Measured: a ~10 KB fixture page reduces to ~680 characters with every Tailwind
class intact.

## 2.6 Reliability

| Requirement | Implementation |
| --- | --- |
| No zombie browsers | `browser.close()` in a `finally`, itself error-swallowing. |
| Server survives failures | Tool handler catches everything and returns `isError: true`; `uncaughtException`/`unhandledRejection` are logged, not fatal. |
| Actionable errors | `CaptureError` codes: `INVALID_URL`, `CONNECTION_REFUSED`, `DNS_FAILURE`, `UNSAFE_PORT`, `TIMEOUT`, `BROWSER_NOT_INSTALLED`, `BROWSER_LAUNCH_FAILED`, `UNKNOWN` — each with a `hint`. |
| Transport hygiene | All logging on stderr; stdout carries only JSON-RPC frames. |
| Bounded waits | 30 s navigation, 45 s launch, 5 s best-effort `networkidle`, `delay` clamped to 0–15 s. |

## 2.7 Verification

`npm test` — 63 vitest cases:

- **security** (44) — allow/block table incl. metadata endpoints, credentialed
  URLs, non-HTTP schemes, spoofed `localhost` suffixes, obfuscated IPs; plus
  hostile-input fuzz that must not throw.
- **dom** (3) — truncation boundaries and the in-band marker.
- **capture** (9) — real Chromium against a local fixture: JPEG magic bytes,
  console error/warning captured and `console.log` dropped, uncaught exception
  captured, 404 image reported as `HTTP 404`, sanitizer keeps ids/classes and
  strips scripts/styles/SVG paths/base64, viewport presets, delay clamping,
  full-page capture, and the `INVALID_URL` / `UNSAFE_PORT` / `CONNECTION_REFUSED`
  paths.
- **protocol** (7) — real MCP `Client` over `InMemoryTransport`: `tools/list`
  shape, `required: ["url"]`, image-then-text block order, schema defaults
  applied, blocked URL returns a tool error while the server stays healthy, and
  malformed arguments are rejected at the protocol layer.

Additionally verified by spawning `dist/index.js` as a child process and
completing an `initialize` → `tools/list` → `tools/call` exchange over real
stdio.

## 2.8 Distribution

Two channels, one codebase:

1. **npm** — published as `mcp-vibelens` with a `bin` entry, so every IDE config
   is `npx -y mcp-vibelens@1`. (`vibelens-mcp` and `vibelens` were already taken
   on npm by unrelated packages.)
2. **Claude Code plugin** — `.claude-plugin/marketplace.json` at the repo root
   catalogs a single plugin whose source is `./plugin`. That directory holds
   `plugin.json`, `.mcp.json` and the two skills, and deliberately contains no
   `package.json`: Claude Code runs `npm install` inside a plugin directory that
   has one, which measured 112 MB of devDependencies in the plugin cache when the
   source pointed at the repo root. `claude plugin marketplace add
   soumyachk101/VibeLens` followed by `claude plugin install vibelens@vibelens`
   installs the MCP server plus the `check-ui` and `responsive-audit` skills.
   The plugin's `.mcp.json` launches the npm package, so npm remains the single
   distribution artifact.

Chromium is a one-time `npx playwright install chromium`; if it is missing, the
tool returns `BROWSER_NOT_INSTALLED` with that exact command rather than failing
opaquely.

CI (`.github/workflows/ci.yml`) runs typecheck, the vitest suite against real
Chromium, the build, and the stdio smoke test on Node 18/20/22, plus manifest
validation. Publishing is tag-driven (`.github/workflows/release.yml`): a `v*`
tag re-runs the full verification, refuses to continue if the tag and
`package.json` version disagree, then publishes with npm provenance.
