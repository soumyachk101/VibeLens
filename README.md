# VibeLens

**Give your AI coding assistant eyes on localhost.**

AI assistants write frontend code well but cannot see what the browser actually
rendered. So you end up describing bugs by hand — *"the button is overflowing
the card"*, *"the spacing looks off on mobile"* — and the model guesses.

VibeLens is an MCP server that closes that loop. Ask your assistant to look at
your dev server and it gets back three things in one tool call:

| What it returns | Why it matters |
| --- | --- |
| **Screenshot** (JPEG) | The model can *see* layout, spacing, colour and overflow. |
| **Console + network errors** | Catches React hydration errors, uncaught exceptions and 404 assets that a screenshot cannot show. |
| **Sanitized DOM snapshot** | Real ids and Tailwind/CSS classes, so fixes target selectors that actually exist instead of hallucinated ones. |

```
You:  "Look at localhost:3000 and fix the button alignment, it looks weird."

AI:   [calls inspect_localhost_ui]
      → sees the screenshot: the CTA overflows its card
      → reads the DOM: <button class="absolute -mx-4 px-6 ...">
      → edits the exact class and re-runs the tool to confirm the fix
```

---

## Requirements

- Node.js 18 or newer
- Chromium for Playwright (one-time download, ~95 MB)

## Install

The fastest path, if you use Claude Code — install it as a plugin, which brings
the MCP server *and* two ready-made skills:

```bash
claude plugin marketplace add soumyachk101/VibeLens
claude plugin install vibelens@vibelens
```

For every other IDE, VibeLens is a plain MCP server on npm:

```bash
npx playwright install chromium   # one-time
```

Then add the config block for your IDE below. There is no global install step —
`npx` fetches the package on first run.

<details>
<summary>From source</summary>

```bash
git clone https://github.com/soumyachk101/VibeLens.git
cd VibeLens
npm install
npx playwright install chromium
npm run build            # emits dist/
npm test                 # 63 tests, includes real browser captures
node scripts/smoke.mjs   # end-to-end check over real stdio
```

Then point your IDE at `node /absolute/path/to/VibeLens/dist/index.js`.
</details>

---

## Configure your IDE

VibeLens speaks MCP over stdio, so every MCP-capable client uses the same shape:

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

### Claude Code

As a plugin (recommended — includes the `check-ui` and `responsive-audit`
skills):

```bash
claude plugin marketplace add soumyachk101/VibeLens
claude plugin install vibelens@vibelens
```

Or as a bare MCP server:

```bash
# available in every project
claude mcp add vibelens --scope user -- npx -y mcp-vibelens@1

# or committed to the repo for your team (writes .mcp.json)
claude mcp add vibelens --scope project -- npx -y mcp-vibelens@1
```

Verify with `/mcp` inside a session — `vibelens` should be listed as connected.

### OpenAI Codex (CLI and IDE extension)

```bash
codex mcp add vibelens -- npx -y mcp-vibelens@1
```

Or add it to `~/.codex/config.toml` by hand. Codex shares this config between
the CLI and the IDE extension, so it only needs doing once:

```toml
[mcp_servers.vibelens]
command = "npx"
args = ["-y", "mcp-vibelens@1"]
```

Check it with `codex mcp list`. Codex only supports local stdio servers, which
is exactly what VibeLens is.

### Cursor

Create `.cursor/mcp.json` in your project (or `~/.cursor/mcp.json` for all
projects) with the JSON block above, then enable **vibelens** under
*Settings → MCP*.

### Google Antigravity

Open the MCP config from the UI (**three-dot menu in chat → MCP Servers →
Manage MCP Servers → View raw config**, or *Settings → Customizations → Open MCP
Config*) and paste the same block. Depending on your version the file lives at:

- `~/.gemini/antigravity/mcp_config.json`
- `~/.gemini/config/mcp_config.json` (newer builds / Antigravity CLI)

Using the in-app menu is the safest way to open the right one.

### Windsurf

`~/.codeium/windsurf/mcp_config.json`, same JSON block.

### VS Code (GitHub Copilot agent mode)

`.vscode/mcp.json`:

```json
{
  "servers": {
    "vibelens": { "command": "npx", "args": ["-y", "mcp-vibelens@1"] }
  }
}
```

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, same
JSON block. Restart the app afterwards.

---

## What the plugin adds

Installing via the Claude Code plugin also gives you two skills that encode the
workflow, so you do not have to describe it every time:

| Skill | What it does |
| --- | --- |
| `/vibelens:check-ui <url>` | Capture → read the DOM and diagnostics → locate the source → fix → **re-capture to verify**. |
| `/vibelens:responsive-audit <url>` | Captures mobile, tablet and desktop, reports only real breakage, fixes the narrowest breakpoint first. |

Both are model-invoked too: saying *"the pricing page looks broken on mobile"* is
enough to trigger them.

---

## The tool

### `inspect_localhost_ui`

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `url` | string, **required** | — | Local URL, e.g. `http://localhost:3000/dashboard`. A missing scheme is assumed to be `http://`. |
| `viewport` | `desktop` \| `tablet` \| `mobile` | `desktop` | `desktop` 1920×1080, `tablet` 820×1180 @2x, `mobile` 390×844 @2x (with touch + mobile emulation). |
| `delay` | number (0–15000) | `1000` | Milliseconds to wait after load, for hydration, animations or data fetching. |
| `fullPage` | boolean | `false` | Capture the whole scrollable page instead of the viewport. |

**Returns** two content blocks:

1. `image` — base64 JPEG (quality 75) of the render.
2. `text` — JSON with this shape:

```json
{
  "summary": {
    "url": "http://localhost:3000/",
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

## How it protects your context window

A raw `document.body.outerHTML` from a modern app is easily 100 KB of mostly
noise. VibeLens sanitizes it inside the browser before it ever reaches the
model:

- **Removed:** `<script>`, `<style>`, `<noscript>`, `<template>`, `<link>`,
  `<meta>` and HTML comments.
- **Collapsed to an empty placeholder:** `<svg>`, `<canvas>`, `<iframe>`,
  `<video>`, `<audio>`, `<object>`, `<embed>` — the box still shows in the tree
  (it affects layout) but its internals are dropped.
- **Attributes kept:** `id`, `class`, `role`, `aria-*`, `data-testid`/`-test`/
  `-cy`/`-qa`, plus form and table structure attributes. Everything else is
  dropped.
- **Attributes shortened:** `data:` URIs become `data:image/png[stripped]`;
  anything over 300 chars is truncated; inline `style` over 120 chars is cut.
- **Text nodes:** whitespace collapsed, each node capped at 160 chars.
- **Hard cap:** 20,000 characters, with an explicit
  `<!-- VibeLens: DOM truncated ... -->` marker so the model knows the tree is
  partial.

In practice a page whose raw HTML is ~10 KB comes back as ~700 characters, with
every class name intact.

---

## Security

VibeLens drives a real browser on your machine, so an unvalidated URL would be a
server-side request forgery (SSRF) primitive. Every URL is checked *before*
Chromium launches.

**Allowed:** `localhost`, `*.localhost`, `127.0.0.0/8`, `0.0.0.0`, `10.0.0.0/8`,
`172.16.0.0/12`, `192.168.0.0/16`, `[::1]`, IPv6 unique-local (`fc00::/7`) and
link-local (`fe80::/10`).

**Blocked:**

- Every public hostname and IP address.
- Any DNS name that is not `localhost`-based — resolving one invites DNS
  rebinding, so hostnames are refused rather than looked up.
- Cloud instance-metadata endpoints (`169.254.169.254`, `169.254.170.2`,
  `fd00:ec2::254`, `100.100.100.200`) and all of IPv4 link-local
  `169.254.0.0/16`.
- Non-HTTP schemes (`file:`, `ftp:`, `javascript:`, ...).
- URLs containing credentials (`http://user:pass@...`).

Two further notes worth knowing:

- The tool is annotated `readOnlyHint` — it observes a page, it never modifies
  your project.
- Page content is untrusted input. Text scraped from a rendered page could
  contain instructions aimed at your assistant; treat the DOM snapshot as data,
  not as direction.

## Resource management

Each call launches an ephemeral Chromium and closes it in a `finally` block, so
a failed capture cannot leave a zombie browser behind. This matters on Apple
Silicon laptops where each stray Chromium costs hundreds of MB of RSS.

---

## Troubleshooting

| Message | Cause and fix |
| --- | --- |
| `BROWSER_NOT_INSTALLED` | Run `npx playwright install chromium`. |
| `CONNECTION_REFUSED` | The dev server isn't running, or is on another port. Start it and retry. |
| `INVALID_URL` | The URL isn't local. VibeLens only inspects localhost and private-network addresses. |
| `UNSAFE_PORT` | Chromium refuses a fixed port list (1, 7, 69, 79, 6000, 6666...). Use 3000, 5173, 8080, etc. |
| `TIMEOUT` | Page never finished loading. Retry, or raise `delay`. |
| Screenshot is blank | The app hadn't hydrated yet — raise `delay` to 2000–3000. |
| Tool not listed in the IDE | Check the config file path, then restart the IDE. Logs go to stderr prefixed `[vibelens]`. |

## Development

```bash
npm run dev              # run the server from source over stdio
npm run typecheck        # tsc --noEmit
npm test                 # vitest: security, DOM, capture e2e, MCP protocol
npm run build            # emit dist/
node scripts/smoke.mjs   # spawn dist/ and exercise it over real stdio
npm run validate:plugin  # claude plugin validate .
```

Layout:

```
src/
├── index.ts      # executable entrypoint: wires the server to stdio
├── server.ts     # MCP server + inspect_localhost_ui registration
├── browser.ts    # Playwright capture engine
├── dom.ts        # in-page DOM sanitizer + truncation
├── security.ts   # SSRF guard (URL allowlist)
└── types.ts      # shared types, viewport presets, payload limits
tests/            # vitest suites (incl. real Chromium captures)
skills/           # Claude Code plugin skills (check-ui, responsive-audit)
scripts/          # smoke test + manifest validation used by CI
.claude-plugin/   # plugin.json + marketplace.json
.mcp.json         # MCP server declaration for the plugin
docs/PRD-TRD.md   # product + technical requirements
RELEASE.md        # release checklist
```

## Roadmap

- Element-scoped capture (`selector: "#navbar"`)
- Interaction before capture (click, hover, fill, scroll)
- Multi-viewport diffing in a single call
- Full network waterfall for failed API calls
- Accessibility-tree output alongside the DOM

## License

MIT — see [LICENSE](./LICENSE).
