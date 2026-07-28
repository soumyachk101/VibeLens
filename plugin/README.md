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
| Skills | 12 | 4 debugging, 7 design craft, 1 verification — see the table below |
| Agents | 4 | `ui-debugger`, `ui-reviewer`, `design-reviewer`, `frontend-builder` |
| Hooks | 2 | Two `PostToolUse` advisories after a frontend file is written or edited |

### The tool

`inspect_localhost_ui` takes a local `url` (required), a `viewport`
(`desktop` 1920×1080, `tablet` 820×1180, `mobile` 390×844), a `delay` in
milliseconds (0–15000, default 1000) and `fullPage` (default false). It returns a
JPEG screenshot plus a JSON block containing `summary`, `consoleLogs`,
`uncaughtPageErrors`, `failedRequests` and a sanitized `simplifiedDOM` with real
ids and Tailwind/CSS classes. It is read-only and local-only: it observes a page,
it cannot click, hover, type, scroll or reach a public host.

That read-only limit shapes every skill below. Hover, `:active` and
`:focus-visible` styles, open overlays and anything mid-transition cannot be seen
in a normal capture: they are read from the source as code-read findings, or
reached by temporarily rendering the state and reverting.

### Skills

Every skill takes the target URL as its argument and works against a running dev
server.

| Skill | Slash command | Purpose |
| --- | --- | --- |
| **Debugging** | | |
| check-ui | `/vibelens:check-ui <url>` | Capture, read the DOM and diagnostics, locate the source, fix, and re-capture to verify. |
| console-triage | `/vibelens:console-triage <url>` | Triage only the diagnostics: group by root cause, map to source files, fix by severity, re-capture to prove the console is clean. |
| responsive-audit | `/vibelens:responsive-audit <url>` | Capture mobile, tablet and desktop; report only real breakage; fix the narrowest breakpoint first. |
| a11y-audit | `/vibelens:a11y-audit <url>` | Heuristic accessibility pass: missing alt, unnamed controls, unlabelled inputs, heading order, visible contrast, mobile tap targets. |
| **Design craft** | | |
| design-review | `/vibelens:design-review <url>` | The flagship pass: judge whether the page reads as designed, then fix what gives it away — no type scale, the framework default accent, one radius everywhere, uniform spacing, missing empty and loading states, invisible focus, pure black and white, filler copy. |
| type-system | `/vibelens:type-system <url>` | Typography audit: how many distinct sizes and weights are actually in use, whether they form a scale, measure, line height, tracking at display sizes, tabular numerals, font-loading shift. |
| color-system | `/vibelens:color-system <url>` | Colour audit: is the accent still the framework default, hardcoded hex instead of tokens, pure black and white, a flat neutral ramp, weak contrast, colour as the only signal of state. |
| layout-audit | `/vibelens:layout-audit <url>` | Structure and spacing: scale consistency, whether spacing groups related content, container width and measure, optical alignment, grid versus flex misuse, magic z-index, overflow. |
| motion-system | `/vibelens:motion-system <url>` | Animation audit: durations against distance travelled, easing, which properties are animated, reduced-motion handling, missing exit transitions — then a named duration and easing token set. |
| micro-interactions | `/vibelens:micro-interactions <url>` | The state matrix for every control: hover, active, focus-visible, disabled, loading, selected, error — plus feedback timing, optimistic updates, destructive-action confirmation, validation timing, touch targets. |
| polish-pass | `/vibelens:polish-pass <url>` | The last-10% checklist: focus rings, selection colour, scroll behaviour, skeletons, empty and error states, cursors, icon sizing, favicon and title, 404 and offline. |
| **Verification** | | |
| before-after | `/vibelens:before-after <url>` | Capture before, change, capture after with identical parameters, and report a concrete diff. |

Skills are **model-invoked as well as slash-invoked.** Each one carries a
description of when it applies, so plain requests trigger them without the
command: "the pricing page looks broken on mobile" reaches `responsive-audit`,
"does localhost:3000 throw anything?" reaches `console-triage`, "this looks
AI-generated" reaches `design-review`, "the accent is very blue" reaches
`color-system`, "the modal just snaps open" reaches `motion-system`, "prove that
fix worked" reaches `before-after`.

### Design knowledge base

The design-craft skills and both design agents stay short by linking out to
[`docs/design/`](../docs/design) in the repository rather than restating the
rules: `ANTI-SLOP.md` (the recognisable tells of machine-generated UI and the
correction for each), `TYPOGRAPHY.md`, `COLOR.md`, `SPACING-LAYOUT.md` and
`MOTION.md`, with `README.md` giving the working order for a new project.

### Agents

| Agent | Delegate when |
| --- | --- |
| `ui-debugger` | A UI bug needs diagnosing and fixing from what the browser actually rendered. Looks before theorising, quotes the real class list before editing, re-captures to verify, and changes nothing it was not asked to. |
| `ui-reviewer` | An implementation is finished and needs an independent check. Captures all three viewports, separates blocking defects from nitpicks with evidence, and reports rather than rewriting. |
| `design-reviewer` | A page works but may look generic or unfinished. Judges designed versus machine-generated, quotes the class that proves each finding, ranks findings by perceived-quality impact, separates defects from preferences, and refuses to give a verdict on a page it has not captured. Reports; does not edit. |
| `frontend-builder` | New frontend work is being built rather than fixed. Establishes type, colour, spacing and motion tokens before components, builds the full state matrix for each one, never leaves a framework default accent in place, and captures every screen before calling it done. |

### Hooks

Two `PostToolUse` hooks on `Write|Edit`, both advisory: they never block a tool
call, never write a file, produce no output when there is nothing to say, and
always exit 0.

| Hook | Fires when | Prints |
| --- | --- | --- |
| Verification reminder | The edited path ends in `.tsx`, `.jsx`, `.vue`, `.svelte`, `.css` or `.scss` | One line noting the change is unverified until `inspect_localhost_ui` is re-run on the affected page with the same parameters. |
| Raw-value check | The same file types, and the file contains a six-digit hex, an `rgb()`/`rgba()` call, or an arbitrary Tailwind bracket value such as `text-[13px]` | One line noting raw values were found, suggesting a semantic colour token or a step on the type/spacing scale. |

## Layout

```
plugin/
├── .claude-plugin/plugin.json   manifest (name, version, metadata)
├── .mcp.json                    launches npx -y mcp-vibelens@1
├── agents/                      ui-debugger, ui-reviewer, design-reviewer, frontend-builder
├── hooks/hooks.json             two PostToolUse advisories
└── skills/<name>/SKILL.md       the twelve skills
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
