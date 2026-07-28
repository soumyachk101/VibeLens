<div align="center">

<img src="./assets/banner.svg" alt="VibeLens — give your AI coding assistant eyes on localhost" width="100%">

<p>
  <a href="https://github.com/soumyachk101/VibeLens/actions/workflows/ci.yml"><img src="https://github.com/soumyachk101/VibeLens/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/mcp-vibelens"><img src="https://img.shields.io/npm/v/mcp-vibelens?color=22d3ee&label=npm" alt="npm version"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-3b82f6" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/price-free%20forever-34d399" alt="Free forever">
  <img src="https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white" alt="Node 20+">
  <img src="https://img.shields.io/badge/MCP-stdio-7dd3fc" alt="Model Context Protocol">
  <img src="https://img.shields.io/badge/tests-63%20passing-a78bfa" alt="63 tests">
  <a href="https://soumyachk101.github.io/VibeLens/"><img src="https://img.shields.io/badge/docs-site-22d3ee" alt="Documentation site"></a>
</p>

<p>
  <b>Free and MIT-licensed. No paid tier, no account, no telemetry, no network calls beyond your own localhost.</b>
</p>

<p>
  <a href="https://soumyachk101.github.io/VibeLens/"><b>Documentation site</b></a> ·
  <a href="#install"><b>Install</b></a> ·
  <a href="#configure-your-ide"><b>IDE setup</b></a> ·
  <a href="#the-tool"><b>Tool</b></a> ·
  <a href="#what-the-plugin-adds"><b>Skills</b></a> ·
  <a href="./docs/design/ANTI-SLOP.md"><b>Anti-slop guide</b></a> ·
  <a href="./docs/ARCHITECTURE.md"><b>Architecture</b></a> ·
  <a href="./docs/FAQ.md"><b>FAQ</b></a>
</p>

</div>

---

## The problem

AI assistants write frontend code well but cannot see what the browser actually
rendered. So you become the framebuffer: you open the page, spot the bug, and
describe it in prose — *"the button is overflowing the card"*, *"spacing looks
off on mobile"* — and the model guesses which selector you mean.

Three failure modes dominate that loop:

- **Invisible errors.** A hydration mismatch or a 404 asset lives in the console,
  not in your description.
- **Selector hallucination.** The model edits `.btn-primary` when the element
  actually carries `.cta-button`, because it is recalling its own earlier output
  instead of reading the DOM.
- **Generated-looking UI.** Untouched framework accent, one radius on everything,
  no type scale, no empty or focus states. It works, and it looks like nobody
  made it.

## The fix

VibeLens is an MCP server that closes the loop. One tool call returns a
screenshot, the console and network diagnostics, and a token-optimized DOM
snapshot — so the model reasons from evidence instead of memory. The Claude Code
plugin adds twelve skills on top, including a design-craft set aimed squarely at
the third problem.

<div align="center">

<img src="./assets/demo.gif" alt="VibeLens catching a button that overflows its card, then verifying the fix with a second capture" width="100%">

<sub><b>Every frame is real output.</b> The screenshots are the tool's own JPEG payload
and the console and DOM lines are its own text payload — regenerate them with
<code>npm run assets:gif</code>.</sub>

</div>

| What comes back | Why it matters |
| --- | --- |
| **Screenshot** (JPEG) | The model can *see* layout, spacing, colour, overflow and hierarchy. |
| **Console + network errors** | Catches hydration errors, uncaught exceptions and 404 assets a screenshot cannot show. |
| **Sanitized DOM snapshot** | Real ids and Tailwind/CSS classes, so fixes target selectors that exist. |

---

## How it works

<div align="center">
<img src="./assets/workflow.svg" alt="The VibeLens loop: you ask, the model calls the tool, headless Chromium captures, one payload returns three signals, the model reasons from evidence and re-captures to verify" width="100%">
</div>

---

## Install

**Claude Code** — install the plugin and you get the MCP server *plus* twelve
skills, four subagents and two advisory hooks:

```bash
claude plugin marketplace add soumyachk101/VibeLens
claude plugin install vibelens@vibelens
```

**Every other IDE** — VibeLens is a plain MCP server on npm. There is no global
install step; `npx` fetches it on first run:

```bash
npx playwright install chromium   # one-time, ~95 MB
```

Then paste the config block for your IDE from the next section.

**Requirements:** Node.js 20 or newer (Playwright 1.62 requires it) and Chromium
for Playwright.

<details>
<summary><b>From source</b></summary>

```bash
git clone https://github.com/soumyachk101/VibeLens.git
cd VibeLens
npm install
npx playwright install chromium
npm run build                      # emits dist/
npm test                           # 63 tests, includes real browser captures
npm run smoke                      # end-to-end check over real stdio
```

Then point your IDE at `node /absolute/path/to/VibeLens/dist/index.js`.
</details>

---

## Configure your IDE

VibeLens speaks MCP over stdio, so every MCP-capable client takes the same shape:

```json
{
  "mcpServers": {
    "vibelens": {
      "command": "npx",
      "args": ["-y", "mcp-vibelens@1"]
    }
  }
}
```

<details open>
<summary><b>Claude Code</b></summary>

As a plugin (recommended — bundles the skills, agents and hooks):

```bash
claude plugin marketplace add soumyachk101/VibeLens
claude plugin install vibelens@vibelens
```

Or as a bare MCP server:

```bash
claude mcp add vibelens --scope user -- npx -y mcp-vibelens@1      # every project
claude mcp add vibelens --scope project -- npx -y mcp-vibelens@1   # writes .mcp.json for the team
```

Verify with `/mcp` in a session — `vibelens` should be listed as connected.
</details>

<details>
<summary><b>OpenAI Codex (CLI and IDE extension)</b></summary>

```bash
codex mcp add vibelens -- npx -y mcp-vibelens@1
```

Or edit `~/.codex/config.toml` directly. Codex shares this config between the CLI
and the IDE extension, so it only needs doing once:

```toml
[mcp_servers.vibelens]
command = "npx"
args = ["-y", "mcp-vibelens@1"]
```

Check with `codex mcp list`. Codex only supports local stdio servers, which is
exactly what VibeLens is.
</details>

<details>
<summary><b>Cursor</b></summary>

Create `.cursor/mcp.json` in your project, or `~/.cursor/mcp.json` for all
projects, with the JSON block above. Then enable **vibelens** under
*Settings → MCP*.
</details>

<details>
<summary><b>Google Antigravity</b></summary>

Open the MCP config from the UI — **three-dot menu in chat → MCP Servers →
Manage MCP Servers → View raw config**, or *Settings → Customizations → Open MCP
Config* — and paste the same block. Depending on your build the file lives at:

- `~/.gemini/antigravity/mcp_config.json`
- `~/.gemini/config/mcp_config.json` (newer builds and the Antigravity CLI)

Using the in-app menu is the safest way to open the right one.
</details>

<details>
<summary><b>Windsurf</b></summary>

`~/.codeium/windsurf/mcp_config.json`, same JSON block.
</details>

<details>
<summary><b>VS Code (GitHub Copilot agent mode)</b></summary>

`.vscode/mcp.json`:

```json
{
  "servers": {
    "vibelens": { "command": "npx", "args": ["-y", "mcp-vibelens@1"] }
  }
}
```
</details>

<details>
<summary><b>Claude Desktop</b></summary>

`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, same
JSON block. Restart the app afterwards.
</details>

---

## The tool

### `inspect_localhost_ui`

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `url` | string, **required** | — | Local URL, e.g. `http://localhost:3000/dashboard`. A missing scheme is assumed to be `http://`. |
| `viewport` | `desktop` \| `tablet` \| `mobile` | `desktop` | `desktop` 1920×1080, `tablet` 820×1180 @2x, `mobile` 390×844 @2x with touch emulation. |
| `delay` | number (0–15000) | `1000` | Milliseconds to wait after load, for hydration, animations or data fetching. |
| `fullPage` | boolean | `false` | Capture the whole scrollable page instead of the viewport. |

**Returns** two content blocks: an `image` (base64 JPEG, quality 75) and a `text`
block containing JSON:

```json
{
  "summary": {
    "url": "http://localhost:3000/health",
    "pageTitle": "Service health",
    "viewport": "desktop (1920x1080)",
    "fullPage": false,
    "waitedMs": 1000,
    "captureMs": 1253,
    "consoleErrors": 1,
    "consoleWarnings": 0,
    "uncaughtPageErrors": 0,
    "failedRequests": 1,
    "domTruncated": false
  },
  "consoleLogs": [
    { "level": "error", "text": "Hydration failed...", "location": "http://localhost:3000/app.js:42:13" }
  ],
  "uncaughtPageErrors": ["TypeError: Cannot read properties of undefined"],
  "failedRequests": [
    { "url": "http://localhost:3000/avatar.png", "method": "GET", "failure": "HTTP 404", "status": 404 }
  ],
  "simplifiedDOM": "<body class=\"...\">...</body>"
}
```

**It is read-only and local-only.** It observes a page; it cannot click, hover,
type, scroll, or reach a public host. That constraint shapes every skill below —
hover and `:focus-visible` styles are read from the source, not observed.

### Prompts that work well

```
Check localhost:3000 on mobile and tell me what breaks.
Look at localhost:5173/settings — the cards aren't aligned. Fix it.
Does localhost:3000/checkout throw anything in the console?
This page looks AI-generated. Tell me why, then fix the worst of it.
The accent is just default Tailwind blue — give me a real palette.
Compare localhost:3000 on desktop vs mobile and make the nav responsive.
```

---

## What the plugin adds

The raw tool gives the model eyes. The plugin gives it a **method** — and a set
of skills aimed at the thing screenshots alone do not fix: UI that works but
looks like nobody designed it.

<div align="center">
<img src="./assets/skills.svg" alt="Twelve skills grouped into debugging, design craft and verification, plus four subagents, two advisories and the design knowledge base" width="100%">
</div>

### Debugging

| Skill | What it does |
| --- | --- |
| `/vibelens:check-ui` | Capture → read the DOM and diagnostics → locate the source → fix → **re-capture to verify**. |
| `/vibelens:console-triage` | Groups console and network failures by root cause, maps them to source files, fixes by severity. |
| `/vibelens:responsive-audit` | Captures mobile, tablet and desktop; reports only real breakage; fixes the narrowest breakpoint first. |
| `/vibelens:a11y-audit` | Heuristic pass: missing alt, unnamed controls, unlabelled inputs, heading order, contrast, tap targets. |

### Design craft — the anti-slop set

| Skill | What it does |
| --- | --- |
| `/vibelens:design-review` | The flagship. Judges whether the page reads as *designed*, then fixes what gives it away: no type scale, untouched framework accent, one radius everywhere, uniform spacing, missing empty and loading states, invisible focus, pure black and white, filler copy. |
| `/vibelens:type-system` | How many sizes and weights are actually in use, whether they form a scale, measure, line height, tracking at display sizes, tabular numerals, font-loading shift. |
| `/vibelens:color-system` | Is the accent still the framework default; hardcoded hex instead of tokens; pure black and white; a flat neutral ramp; weak contrast; colour as the only signal of state. |
| `/vibelens:layout-audit` | Spacing-scale consistency, whether spacing groups related content, container width and measure, optical alignment, grid versus flex misuse, magic z-index, overflow. |
| `/vibelens:motion-system` | Durations against distance travelled, easing by intent, which properties are animated, reduced-motion handling, missing exit transitions — then a named token set. |
| `/vibelens:micro-interactions` | The state matrix for every control: hover, active, focus-visible, disabled, loading, selected, error — plus feedback timing, validation timing and touch targets. |
| `/vibelens:polish-pass` | The last 10%: focus rings, selection colour, scroll behaviour, skeletons that match final layout, empty and error states, cursors, icon optical sizing, favicon and title, 404 and offline. |

### Verification

| Skill | What it does |
| --- | --- |
| `/vibelens:before-after` | Capture before, change, capture after with **identical** parameters, report a concrete diff. Different parameters make the comparison meaningless. |

### Subagents

| Subagent | Delegate when |
| --- | --- |
| `ui-debugger` | A UI bug needs diagnosing from what the browser actually rendered. Never proposes a fix for a page it has not seen. |
| `ui-reviewer` | You want an independent pre-merge look across three viewports. Reports defects with evidence; does not edit code. |
| `design-reviewer` | You want a verdict on whether the UI looks deliberately designed, ranked by perceived-quality impact, with the proving class quoted. |
| `frontend-builder` | You are building new UI. Establishes tokens before components, builds the full state matrix, never ships a screen it has not captured. |

### Advisory hooks

Both are `PostToolUse`, both are advisory only — they print one line and always
exit 0, so they can never block a tool call or edit a file.

| Hook | Fires when |
| --- | --- |
| Unverified change | A `.tsx/.jsx/.vue/.svelte/.css/.scss` file is written or edited — the change is unverified until the page is captured again. |
| Raw values | That file contains a six-digit hex, `rgb()`/`rgba()`, or arbitrary bracket utilities like `text-[13px]` — suggesting a token or a step on the scale instead. |

Every skill is **model-invoked as well as slash-invoked**. Saying *"this looks
AI-generated"* reaches `design-review`; *"the modal just snaps open"* reaches
`motion-system`; *"prove that fix worked"* reaches `before-after`.

---

## The design knowledge base

The design skills stay short by citing a shared reference instead of restating
it. It is written for an agent mid-task: tables, thresholds and code, no essays.

| Document | Contents |
| --- | --- |
| **[ANTI-SLOP.md](./docs/design/ANTI-SLOP.md)** | 17 recognisable tells of machine-generated UI — the tell, why it reads as generated, and the concrete correction. |
| [TYPOGRAPHY.md](./docs/design/TYPOGRAPHY.md) | Modular scales, line height by size, measure in `ch`, tracking rules, variable fonts, `font-display`, metric-compatible fallbacks, `tabular-nums`, `text-wrap: balance`. |
| [COLOR.md](./docs/design/COLOR.md) | Deriving a palette instead of picking colours, why `oklch()` beats HSL for even ramps, semantic over primitive tokens, WCAG 4.5:1 and 3:1, dark mode as a remap. |
| [SPACING-LAYOUT.md](./docs/design/SPACING-LAYOUT.md) | A 4px scale, spacing as a proximity signal, optical vs mathematical alignment, grid vs flex, container queries, `min()`/`clamp()`, a named z-index scale. |
| [MOTION.md](./docs/design/MOTION.md) | Duration bands by distance, easing by intent, compositor-safe properties, `prefers-reduced-motion` that degrades rather than removes meaning, FLIP and view transitions, what never to animate. |

Start at **[docs/design/README.md](./docs/design/README.md)** for the index and
the working order.

---

## How it protects your context window

A raw `document.body.outerHTML` from a modern app is mostly noise. VibeLens
sanitizes it *inside the browser*, before it ever reaches the model.

<div align="center">
<img src="./assets/dom-budget.svg" alt="Measured: 193,520 raw characters reduce to 8,890 after sanitization, a 95.4 percent reduction, with every utility class preserved" width="100%">
</div>

Reproduce that measurement yourself with `npm run assets:measure`.

- **Removed:** `<script>`, `<style>`, `<noscript>`, `<template>`, `<link>`,
  `<meta>`, `<base>`, `<title>` and HTML comments.
- **Collapsed to an empty placeholder:** `<svg>`, `<canvas>`, `<iframe>`,
  `<video>`, `<audio>`, `<object>`, `<embed>`, `<map>`, `<picture>` — the box
  still appears in the tree because it affects layout, but its internals are gone.
- **Attributes kept:** `id`, `class`, `role`, `aria-*`,
  `data-testid`/`-test`/`-cy`/`-qa`, plus form and table structure attributes.
- **Attributes shortened:** `data:` URIs become `data:image/png[stripped]`;
  anything over 300 chars is truncated; inline `style` over 120 chars is cut.
- **Text nodes:** whitespace collapsed, each node capped at 160 chars.
- **Hard cap:** 20,000 characters, with an explicit
  `<!-- VibeLens: DOM truncated ... -->` marker so the model knows the tree is
  partial.

---

## Architecture

<div align="center">
<img src="./assets/architecture.svg" alt="VibeLens architecture: MCP hosts talk over stdio to the Node process, whose security guard runs before the capture engine launches Chromium against your dev server" width="100%">
</div>

Module-by-module detail, the request lifecycle and the resource model live in
**[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)**. The reasoning behind each
significant choice is recorded as an ADR in **[docs/adr/](./docs/adr/)**:

| ADR | Decision |
| --- | --- |
| [0001](./docs/adr/0001-mcp-over-stdio.md) | MCP over stdio |
| [0002](./docs/adr/0002-playwright-over-puppeteer.md) | Playwright over Puppeteer |
| [0003](./docs/adr/0003-ssrf-allowlist-not-denylist.md) | An allowlist, not a denylist |
| [0004](./docs/adr/0004-single-tool-not-many.md) | One tool, not many |
| [0005](./docs/adr/0005-plugin-ships-from-subdirectory.md) | The plugin ships from a subdirectory |
| [0006](./docs/adr/0006-jpeg-screenshots-and-dom-truncation.md) | JPEG screenshots and DOM truncation |

---

## Security

VibeLens drives a real browser on your machine, so an unvalidated URL would be a
server-side request forgery (SSRF) primitive. Every URL is checked **before**
Chromium launches.

**Allowed:** `localhost`, `*.localhost`, `127.0.0.0/8`, `0.0.0.0`, `10.0.0.0/8`,
`172.16.0.0/12`, `192.168.0.0/16`, `[::1]`, IPv6 unique-local (`fc00::/7`) and
link-local (`fe80::/10`).

**Blocked:**

- Every public hostname and IP address.
- Any DNS name that is not `localhost`-based — resolving one invites DNS
  rebinding, so hostnames are refused rather than looked up.
- Cloud instance-metadata endpoints (`169.254.169.254`, `169.254.170.2`,
  `fd00:ec2::254`, `100.100.100.200`) and all of IPv4 link-local `169.254.0.0/16`.
- Non-HTTP schemes (`file:`, `ftp:`, `javascript:`, ...).
- URLs containing credentials (`http://user:pass@...`).

Two further points worth knowing:

- The tool is annotated `readOnlyHint` — it observes a page, it never modifies
  your project, and it cannot click, type or scroll.
- **Page content is untrusted input.** Text scraped from a rendered page could
  contain instructions aimed at your assistant. Treat the DOM snapshot as data,
  never as direction.

To report a vulnerability, see **[SECURITY.md](./SECURITY.md)**.

Each call launches an ephemeral Chromium and closes it in a `finally` block, so a
failed capture cannot leave a zombie browser behind. This matters on Apple
Silicon laptops where every stray Chromium costs hundreds of MB of RSS.

---

## Troubleshooting

| Message | Cause and fix |
| --- | --- |
| `BROWSER_NOT_INSTALLED` | Run `npx playwright install chromium`. |
| `CONNECTION_REFUSED` | The dev server isn't running, or is on another port. |
| `INVALID_URL` | The URL isn't local. VibeLens only inspects localhost and private-network addresses. |
| `UNSAFE_PORT` | Chromium refuses a fixed port list (1, 7, 69, 79, 6000, 6666...). Use 3000, 5173, 8080. |
| `TIMEOUT` | Page never finished loading. Retry, or raise `delay`. |
| Screenshot is blank | The app hadn't hydrated — raise `delay` to 2000–3000. |
| Tool not listed in the IDE | Check the config path, then restart the IDE. Logs go to stderr prefixed `[vibelens]`. |

The long-form version, including per-IDE diagnosis, is in
**[docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)**. Common questions are
answered in **[docs/FAQ.md](./docs/FAQ.md)**.

---

## Development

```bash
npm run dev                  # run the server from source over stdio
npm run typecheck            # tsc --noEmit
npm test                     # vitest: security, DOM, capture e2e, MCP protocol
npm run build                # emit dist/
npm run smoke                # spawn dist/ and exercise it over real stdio
npm run validate:manifests   # npm + plugin + marketplace + docs consistency
npm run validate:plugin      # claude plugin validate for both manifests
npm run assets:measure       # reproduce the DOM-reduction figure
npm run assets:gif           # regenerate the README animation from real captures
npm run site:build           # build the documentation site into site-dist/
npm run site:check           # link-check it, then inspect it with VibeLens itself
```

### Repository map

```
src/
├── index.ts        executable entrypoint: wires the server to stdio
├── server.ts       MCP server + inspect_localhost_ui registration
├── browser.ts      Playwright capture engine
├── dom.ts          in-page DOM sanitizer + truncation
├── security.ts     SSRF guard (URL allowlist)
└── types.ts        shared types, viewport presets, payload limits

tests/              vitest suites, incl. real Chromium captures
├── security.test.ts        44 allow/block cases
├── dom.test.ts             truncation boundaries
├── capture.test.ts         end-to-end against a noisy fixture page
├── server.test.ts          real MCP client over InMemoryTransport
└── fixture-server.ts       the deliberately broken fixture page

plugin/             what Claude Code installs — no package.json, on purpose
├── .claude-plugin/plugin.json
├── .mcp.json       launches npx -y mcp-vibelens@1
├── skills/         12 skills: 4 debugging · 7 design craft · 1 verification
├── agents/         ui-debugger · ui-reviewer · design-reviewer · frontend-builder
└── hooks/          two advisory PostToolUse reminders

docs/
├── ARCHITECTURE.md         modules, lifecycle, resource and token model
├── design/                 the anti-slop, type, colour, layout and motion rules
├── adr/                    six architecture decision records
├── PRD-TRD.md              product + technical requirements
├── TROUBLESHOOTING.md      every error code, per-IDE diagnosis
└── FAQ.md                  honest answers, including the limitations

site/                   hand-authored design system for the docs site
├── styles.css      tokens, type scale, themes; no framework
└── app.js          theme toggle, copy buttons, TOC highlight

scripts/
├── smoke.mjs               spawns dist/ and drives it over real stdio
├── validate-manifests.mjs  keeps npm + plugin + marketplace + docs in sync
├── site/                   static site generator + its own link checker
└── assets/                 regenerates the README animation and measurements

.claude-plugin/marketplace.json   one-plugin marketplace catalog
.github/                          CI, tag-driven release, issue forms, CODEOWNERS
```

### Contributing

Start with **[CONTRIBUTING.md](./CONTRIBUTING.md)** — it lists the seven
invariants that must not break (chief among them: **never write to stdout**, it is
the MCP transport) and the verification checklist every PR must pass. Project
guidance for AI agents working in this repo lives in
**[CLAUDE.md](./CLAUDE.md)**.

Release process: **[RELEASE.md](./RELEASE.md)**. Version history:
**[CHANGELOG.md](./CHANGELOG.md)**. Conduct: **[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)**.

---

## Roadmap

- [ ] Element-scoped capture (`selector: "#navbar"`)
- [ ] Interaction before capture (click, hover, fill, scroll) — would let the
      state-matrix skills *observe* hover and focus instead of reading them
- [ ] Multi-viewport diffing in a single call
- [ ] Full network waterfall for failed API calls
- [ ] Accessibility-tree output alongside the DOM

Ideas and votes belong in [Discussions](https://github.com/soumyachk101/VibeLens/discussions)
or a [feature request](https://github.com/soumyachk101/VibeLens/issues/new?template=feature_request.yml).

---

<div align="center">

**Free forever, MIT licensed** — see [LICENSE](./LICENSE).
No paid tier, no hosted service, no telemetry.

<sub>If VibeLens saved you a round of "no, the <i>other</i> button", a star helps other people find it.</sub>

</div>
