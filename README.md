<div align="center">

<img src="./assets/banner.svg" alt="VibeLens — give your AI coding assistant eyes on localhost" width="100%">

<p>
  <a href="https://github.com/soumyachk101/VibeLens/actions/workflows/ci.yml"><img src="https://github.com/soumyachk101/VibeLens/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/mcp-vibelens"><img src="https://img.shields.io/npm/v/mcp-vibelens?color=22d3ee&label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/mcp-vibelens"><img src="https://img.shields.io/npm/dm/mcp-vibelens?color=a78bfa&label=downloads" alt="npm downloads"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-3b82f6" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white" alt="Node 20+">
  <img src="https://img.shields.io/badge/MCP-stdio-7dd3fc" alt="Model Context Protocol">
  <img src="https://img.shields.io/badge/tests-63%20passing-34d399" alt="63 tests">
</p>

<p>
  <a href="#install"><b>Install</b></a> ·
  <a href="#configure-your-ide"><b>IDE setup</b></a> ·
  <a href="#the-tool"><b>Tool reference</b></a> ·
  <a href="#the-claude-code-plugin"><b>Plugin</b></a> ·
  <a href="./docs/ARCHITECTURE.md"><b>Architecture</b></a> ·
  <a href="./docs/FAQ.md"><b>FAQ</b></a> ·
  <a href="./CONTRIBUTING.md"><b>Contribute</b></a>
</p>

</div>

---

## The problem

AI assistants write frontend code well but cannot see what the browser actually
rendered. So you become the framebuffer: you open the page, spot the bug, and
describe it in prose — *"the button is overflowing the card"*, *"spacing looks
off on mobile"* — and the model guesses which selector you mean.

Two failure modes dominate that loop:

- **Invisible errors.** A React hydration mismatch or a 404 hero image lives in
  the console, not in your description.
- **Selector hallucination.** The model edits `.btn-primary` when the element
  actually carries `.cta-button`, because it is recalling its own earlier output
  instead of reading the DOM.

## The fix

VibeLens is an MCP server that closes the loop. One tool call returns a
screenshot, the console and network diagnostics, and a token-optimized DOM
snapshot — so the model reasons from evidence instead of memory.

<div align="center">

<img src="./assets/demo.gif" alt="VibeLens catching a CTA that overflows its card, then verifying the fix with a second capture" width="100%">

<sub><b>Every frame above is real output.</b> The screenshots are the tool's own JPEG
payload and the console/DOM lines are its own text payload —
regenerate them with <code>node scripts/assets/capture-demo.mjs</code>.</sub>

</div>

| What comes back | Why it matters |
| --- | --- |
| **Screenshot** (JPEG) | The model can *see* layout, spacing, colour and overflow. |
| **Console + network errors** | Catches hydration errors, uncaught exceptions and 404 assets a screenshot cannot show. |
| **Sanitized DOM snapshot** | Real ids and Tailwind/CSS classes, so fixes target selectors that exist. |

---

## How it works

<div align="center">
<img src="./assets/workflow.svg" alt="The VibeLens loop: you ask, the model calls the tool, headless Chromium captures, one payload returns three signals, the model reasons from evidence and re-captures to verify" width="100%">
</div>

---

## Install

**Claude Code** — install the plugin and you get the MCP server *plus* five
skills and two subagents:

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
node scripts/smoke.mjs             # end-to-end check over real stdio
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

As a plugin (recommended — bundles the skills, agents and hook):

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
    "url": "http://localhost:3000/pricing",
    "pageTitle": "Pricing",
    "viewport": "mobile (390x844)",
    "fullPage": false,
    "waitedMs": 1000,
    "captureMs": 1172,
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
    { "url": "http://localhost:3000/hero.png", "method": "GET", "failure": "HTTP 404", "status": 404 }
  ],
  "simplifiedDOM": "<body class=\"...\">...</body>"
}
```

### Prompts that work well

```
Check localhost:3000 on mobile and tell me what breaks.
Look at localhost:5173/pricing — the cards aren't aligned. Fix it.
Screenshot localhost:3000 with fullPage, then fix any spacing inconsistencies.
Are there any console errors on localhost:3000/checkout?
Compare localhost:3000 on desktop vs mobile and make the nav responsive.
```

---

## The Claude Code plugin

Installing via the plugin adds a workflow layer on top of the raw tool, so you do
not have to describe the process every time. Every skill is also **model-invoked**
— saying *"the pricing page looks broken on mobile"* is enough to trigger one.

| Skill | What it does |
| --- | --- |
| `/vibelens:check-ui` | Capture → read the DOM and diagnostics → locate the source → fix → **re-capture to verify**. |
| `/vibelens:responsive-audit` | Captures mobile, tablet and desktop; reports only real breakage; fixes the narrowest breakpoint first. |
| `/vibelens:a11y-audit` | Heuristic accessibility pass from the screenshot and DOM: missing alt, unnamed controls, contrast, heading order, tap targets. |
| `/vibelens:console-triage` | Groups console and network failures by root cause, maps them to source files, fixes by severity. |
| `/vibelens:before-after` | Verification discipline: capture before, change, capture after with identical parameters, report a concrete diff. |

| Subagent | Role |
| --- | --- |
| `ui-debugger` | Evidence-driven frontend debugging. Never proposes a fix for a page it has not seen. |
| `ui-reviewer` | Independent pre-merge UI review across three viewports. Reports defects with evidence; does not edit code. |

Plus a **PostToolUse hook** that flags any edit to `.tsx/.jsx/.vue/.svelte/.css/.scss`
as unverified until the page is captured again.

> The plugin ships from the [`plugin/`](./plugin) subdirectory rather than the repo
> root on purpose. Claude Code runs `npm install` inside any plugin directory
> containing a `package.json`, which pushed 113 MB of devDependencies into the
> plugin cache before this was fixed. It is now 20 KB.

---

## How it protects your context window

A raw `document.body.outerHTML` from a modern app is mostly noise. VibeLens
sanitizes it *inside the browser*, before it ever reaches the model.

<div align="center">
<img src="./assets/dom-budget.svg" alt="Measured: 193,520 raw characters reduce to 8,890 after sanitization, a 95.4 percent reduction, with every utility class preserved" width="100%">
</div>

Reproduce that measurement yourself with `node scripts/assets/measure-dom.mjs`.

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

Full module-by-module detail, the request lifecycle and the resource model live in
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

### Resource management

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
npm run dev                          # run the server from source over stdio
npm run typecheck                    # tsc --noEmit
npm test                             # vitest: security, DOM, capture e2e, MCP protocol
npm run build                        # emit dist/
node scripts/smoke.mjs               # spawn dist/ and exercise it over real stdio
node scripts/validate-manifests.mjs  # plugin/marketplace/npm manifest consistency
npm run validate:plugin              # claude plugin validate .
node scripts/assets/measure-dom.mjs  # reproduce the DOM-reduction figure
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
├── skills/         check-ui · responsive-audit · a11y-audit · console-triage · before-after
├── agents/         ui-debugger · ui-reviewer
└── hooks/          post-edit "this is unverified" reminder

docs/
├── ARCHITECTURE.md         modules, lifecycle, resource and token model
├── PRD-TRD.md              product + technical requirements
├── TROUBLESHOOTING.md      every error code, per-IDE diagnosis
├── FAQ.md                  honest answers, including the limitations
└── adr/                    six architecture decision records

scripts/
├── smoke.mjs               spawns dist/ and drives it over real stdio
├── validate-manifests.mjs  keeps npm + plugin + marketplace in sync
└── assets/                 regenerates the README GIF and measurements

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
**[CHANGELOG.md](./CHANGELOG.md)**.

---

## Roadmap

- [ ] Element-scoped capture (`selector: "#navbar"`)
- [ ] Interaction before capture (click, hover, fill, scroll)
- [ ] Multi-viewport diffing in a single call
- [ ] Full network waterfall for failed API calls
- [ ] Accessibility-tree output alongside the DOM

Ideas and votes belong in [Discussions](https://github.com/soumyachk101/VibeLens/discussions)
or a [feature request](https://github.com/soumyachk101/VibeLens/issues/new?template=feature_request.yml).

---

<div align="center">

**MIT licensed** — see [LICENSE](./LICENSE).

<sub>If VibeLens saved you a round of "no, the <i>other</i> button", a star helps other people find it.</sub>

</div>
