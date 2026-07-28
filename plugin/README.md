# VibeLens — Claude Code plugin

This directory is the Claude Code plugin for
[VibeLens](https://github.com/soumyachk101/VibeLens), the MCP server that gives an
AI coding assistant vision into a locally running web app.

## Install

```bash
claude plugin marketplace add soumyachk101/VibeLens
claude plugin install vibelens@vibelens
```

Then run `/mcp` inside a session; `vibelens` should be listed as connected. The
first capture also needs Chromium once:

```bash
npx playwright install chromium
```

## What gets installed

| Component | Count | Detail |
| --- | --- | --- |
| MCP server | 1 | `inspect_localhost_ui`, launched from `.mcp.json` via `npx -y mcp-vibelens@1` |
| Skills | 5 | `check-ui`, `responsive-audit`, `a11y-audit`, `console-triage`, `before-after` |
| Agents | 2 | `ui-debugger`, `ui-reviewer` |
| Hooks | 1 | `PostToolUse` reminder after a frontend file is written or edited |

### The tool

`inspect_localhost_ui` takes a local `url` (required), a `viewport`
(`desktop` 1920×1080, `tablet` 820×1180, `mobile` 390×844), a `delay` in
milliseconds (0–15000, default 1000) and `fullPage` (default false). It returns a
JPEG screenshot plus a JSON block containing `summary`, `consoleLogs`,
`uncaughtPageErrors`, `failedRequests` and a sanitized `simplifiedDOM` with real
ids and Tailwind/CSS classes. It is read-only and local-only: it observes a page,
it cannot click, type, scroll or reach a public host.

### Skills

| Skill | Slash command | Purpose |
| --- | --- | --- |
| check-ui | `/vibelens:check-ui <url>` | Capture, read the DOM and diagnostics, locate the source, fix, and re-capture to verify. |
| responsive-audit | `/vibelens:responsive-audit <url>` | Capture mobile, tablet and desktop; report only real breakage; fix the narrowest breakpoint first. |
| a11y-audit | `/vibelens:a11y-audit <url>` | Heuristic accessibility pass: missing alt, unnamed controls, unlabelled inputs, heading order, visible contrast, mobile tap targets. |
| console-triage | `/vibelens:console-triage <url>` | Triage only the diagnostics: group by root cause, map to source files, fix by severity, re-capture to prove the console is clean. |
| before-after | `/vibelens:before-after <url>` | Capture before, change, capture after with identical parameters, and report a concrete diff. |

Skills are **model-invoked as well as slash-invoked.** Each one carries a
description of when it applies, so plain requests trigger them without the
command: "the pricing page looks broken on mobile" reaches `responsive-audit`,
"does localhost:3000 throw anything?" reaches `console-triage`, "prove that fix
worked" reaches `before-after`.

### Agents

| Agent | Delegate when |
| --- | --- |
| `ui-debugger` | A UI bug needs diagnosing and fixing from what the browser actually rendered. Looks before theorising, quotes the real class list before editing, re-captures to verify, and changes nothing it was not asked to. |
| `ui-reviewer` | An implementation is finished and needs an independent check. Captures all three viewports, separates blocking defects from nitpicks with evidence, and reports rather than rewriting. |

### Hook

A `PostToolUse` hook on `Write|Edit` reads the edited path from the tool input
and, when it ends in `.tsx`, `.jsx`, `.vue`, `.svelte`, `.css` or `.scss`, prints
a one-line reminder that the change is unverified until `inspect_localhost_ui` is
re-run on the affected page. It is advisory only: it never blocks a tool call,
never writes a file, and always exits 0.

## Layout

```
plugin/
├── .claude-plugin/plugin.json   manifest (name, version, metadata)
├── .mcp.json                    launches npx -y mcp-vibelens@1
├── agents/                      ui-debugger, ui-reviewer
├── hooks/hooks.json             PostToolUse verification reminder
└── skills/<name>/SKILL.md       the five skills
```

Components live at the plugin root. Nothing but the manifest belongs inside
`.claude-plugin/`.

## No package.json here, deliberately

This directory has no `package.json` and must never gain one. Claude Code runs
`npm install` inside a plugin directory that contains one, which previously
copied 113 MB of the server's devDependencies into every user's plugin cache. The
server itself is installed on demand from npm by `.mcp.json`, so the plugin needs
no dependencies of its own.

## License

MIT — see [LICENSE](../LICENSE).
