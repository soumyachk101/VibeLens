# Troubleshooting

Every failure VibeLens can produce, what causes it, and how to fix it. Error
codes come from `CaptureErrorCode` in `src/types.ts`; the messages and hints come
from `src/browser.ts` and `src/server.ts`.

- [How to read an error](#how-to-read-an-error)
- [Error codes](#error-codes)
- [The screenshot is blank or half-rendered](#the-screenshot-is-blank-or-half-rendered)
- [Chromium is missing](#chromium-is-missing)
- [The tool is not listed in my IDE](#the-tool-is-not-listed-in-my-ide)
- [The Claude Code plugin installs but the server will not connect](#the-claude-code-plugin-installs-but-the-server-will-not-connect)
- [Stdout corruption](#stdout-corruption)
- [Other symptoms](#other-symptoms)
- [Collecting diagnostics](#collecting-diagnostics)

---

## How to read an error

A failed capture is a *tool* error, not a transport error: the server returns
`isError: true` with text and stays connected. The text always has three parts,
produced by `buildErrorPayload()`:

```
VibeLens could not inspect the page (CONNECTION_REFUSED).

Problem: Connection refused at http://localhost:3000/.
Next step: The dev server does not appear to be running (or is on a different
port). Ask the user to start it, then retry.
```

The code in parentheses is the entry point into the table below. If you see no
code at all — no VibeLens text, just the tool failing or the session dropping —
skip to [stdout corruption](#stdout-corruption), because that is a transport
problem rather than a capture problem.

---

## Error codes

### `INVALID_URL`

**Raised by** `captureUIState()` when `validateLocalUrl()` refuses the URL, before
Chromium is launched.

**Causes, in the order the validator checks them:**

| Cause | Example |
| --- | --- |
| Empty or unparseable input | `""`, `http://` |
| Non-HTTP scheme | `file:///etc/passwd`, `ftp://localhost` |
| Embedded credentials | `http://user:pass@localhost:3000` |
| Cloud metadata endpoint | `http://169.254.169.254/`, `http://100.100.100.200/` |
| Public IPv4 or IPv6 | `http://8.8.8.8`, `http://0x08080808` (canonicalizes to 8.8.8.8) |
| Any hostname that is not `localhost` or `*.localhost` | `http://myapp.local`, `http://staging.example.com`, `http://host.docker.internal` |

**Fix.** Use a local address. Allowed: `localhost`, `*.localhost`,
`127.0.0.0/8`, `0.0.0.0`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`,
`[::1]`, `fc00::/7`, `fe80::/10`. The scheme may be omitted —
`localhost:3000` is accepted and treated as `http://localhost:3000`.

If your dev server is only reachable by a DNS name, address it by IP instead.
Hostnames are refused rather than resolved, on purpose: resolving them would
reintroduce DNS rebinding. See [ADR 0003](./adr/0003-ssrf-allowlist-not-denylist.md).
There is no flag to relax this.

### `CONNECTION_REFUSED`

**Raised by** `toCaptureError()` on `ERR_CONNECTION_REFUSED`, `ECONNREFUSED`,
`ERR_EMPTY_RESPONSE` or `ERR_CONNECTION_RESET`.

**Causes.** The dev server is not running; it is running on a different port; it
is still compiling its first bundle; or it crashed mid-request. The two
connection-reset variants get their own wording ("closed the connection without
responding") because they usually mean "compiling" or "crashed" rather than "not
started".

**Fix.** Start the dev server and confirm the port it printed. Check the terminal
where it runs for a compile error. Confirm the port is actually listening:

```bash
curl -I http://localhost:3000
```

If the server binds only to a specific interface, use the address it reports. A
server bound to `127.0.0.1` will refuse `http://192.168.1.20:3000` even though
both are allowed by the validator.

### `DNS_FAILURE`

**Raised by** `toCaptureError()` on `ERR_NAME_NOT_RESOLVED`.

**Cause.** Rare by construction: non-`localhost` hostnames are rejected as
`INVALID_URL` before a browser exists. The realistic path here is a
`*.localhost` name that does not actually resolve on your machine — for example
`http://api.localhost:3000` on a system whose resolver does not implement RFC
6761 loopback semantics.

**Fix.** Use `localhost` or `127.0.0.1` directly, or add the name to
`/etc/hosts`.

### `UNSAFE_PORT`

**Raised by** `toCaptureError()` on `ERR_UNSAFE_PORT`.

**Cause.** Chromium refuses to connect to a fixed list of ports regardless of
what is listening there, including 1, 7, 69, 79, 6000 and 6666. This is a browser
policy, not a VibeLens rule, and it cannot be overridden from here.

**Fix.** Run the dev server on a conventional port: 3000, 5173, 8080, 4200, 8000.

### `TIMEOUT`

**Raised by** `toCaptureError()` when the failure message contains `Timeout` or
`timeout`, typically `page.goto` exceeding `NAVIGATION_TIMEOUT_MS` (30 s).

**Causes.** The page never reached the `load` event: a request that hangs rather
than fails, a dev server doing a very slow cold compile, an SSR route blocked on
a backend that is not running, or an infinite redirect.

**Fix.** Load the URL in a normal browser and see whether it also hangs. If the
first compile is simply slow, warm the server by loading the page once, then call
the tool again. If a specific asset or API hangs, that is the bug worth fixing —
`failedRequests` in a successful capture of another route will often name it.
Raising `delay` does not help here: `delay` runs *after* navigation completes, so
it cannot rescue a navigation that never finished.

### `BROWSER_NOT_INSTALLED`

**Raised by** `launchBrowser()` when the launch error mentions
`Executable doesn't exist`, `please run the following command`, or
`browserType.launch: Failed to launch`.

**Fix.** See [Chromium is missing](#chromium-is-missing).

### `BROWSER_LAUNCH_FAILED`

**Raised by** `launchBrowser()` for any other launch failure, including exceeding
`LAUNCH_TIMEOUT_MS` (45 s).

**Causes.** A partially downloaded or corrupted browser build; missing shared
libraries on a slim Linux image; no sandbox permissions in a container; a machine
so loaded that launch times out; or a Playwright install that does not match the
installed browser revision.

**Fix.**

```bash
npx playwright install chromium          # re-download the matching build
npx playwright install-deps chromium     # Linux only: system libraries
```

On Linux verify the message names a missing `.so`; if so, `install-deps` is the
answer. Confirm the browser works independently of VibeLens:

```bash
node -e "import('playwright').then(p=>p.chromium.launch().then(b=>b.close()).then(()=>console.log('launch ok')))"
```

If that fails, the problem is the Playwright installation, not VibeLens.

### `UNKNOWN`

**Raised by** `toCaptureError()` for anything unclassified, and by
`buildErrorPayload()` for a non-`CaptureError` throw.

**Cause.** By definition unmapped. The raw message is included verbatim after
`Problem:`.

**Fix.** Retry once — some are transient. If it persists, that message is the
useful part of a bug report; include it along with your OS, Node version and the
URL shape. A recurring `UNKNOWN` usually means a new Chromium error string needs a
branch in `toCaptureError()`.

---

## The screenshot is blank or half-rendered

The capture succeeded, so there is no error code. The image is white, shows a
loading skeleton, or shows a layout that has not settled.

**Why it happens.** Navigation waits for `load`, then a best-effort
`networkidle` wait capped at 5 s, then `delay`. An app whose content appears
after client-side hydration, a data fetch, or an entry animation can be captured
before any of that finishes. The `networkidle` wait is deliberately
non-fatal — an app with a websocket or long-poll never reaches idle, so the wait
times out silently and the capture proceeds.

**Fixes, in order:**

1. Raise `delay` to 2000–3000 ms. This is the intended control and solves most
   cases. The maximum is 15000.
2. Check the text payload before assuming a timing problem. A blank page with a
   `pageError` such as `TypeError: Cannot read properties of undefined` is a
   crashed render, not a slow one, and no delay will fix it.
3. Check `failedRequests`. A blank page whose bundle 404s is a build problem.
4. Compare `summary.pageTitle` and `summary.url` against expectations. A blank
   page at an unexpected URL means a redirect, often an auth redirect to a login
   route that renders nothing without a session.
5. For a long page, set `fullPage: true`. Content below the fold is otherwise
   simply outside the viewport, which looks like missing content in a viewport
   capture.

Note that authenticated pages are a structural limitation, not a timing one:
each call gets a fresh browser context with no cookies or storage, so a page
requiring a session renders as logged-out.

---

## Chromium is missing

**Symptom.** `BROWSER_NOT_INSTALLED`, with the hint
`npx playwright install chromium`.

**Cause.** Playwright manages its own browser builds and does not use your
system Chrome. Installing the npm package does not download a browser; that is a
separate, one-time step of roughly 95 MB.

**Fix.**

```bash
npx playwright install chromium
```

Points that catch people out:

- **Do this once per machine, not once per project.** Browsers live in a shared
  cache (`~/Library/Caches/ms-playwright` on macOS,
  `~/.cache/ms-playwright` on Linux), not in `node_modules`.
- **`npx -y mcp-vibelens@1` will not install it for you.** The package
  intentionally does not download a browser on install.
- **After a Playwright version bump, re-run it.** A new Playwright expects a new
  browser revision; the old one no longer satisfies it.
- **In a container, add the system libraries too:**
  `npx playwright install-deps chromium`.
- **If `PLAYWRIGHT_BROWSERS_PATH` is set** in your shell but not in the
  environment your IDE spawns the server with, the server will not find the
  browser your terminal can see. Either unset it or set it in the MCP server
  config's `env` block.

---

## The tool is not listed in my IDE

First, separate the two possibilities: the server is not being started, or it is
starting and failing. Almost always it is a config path or a JSON syntax error,
not a code problem.

Config shape is the same everywhere:

```json
{
  "mcpServers": {
    "vibelens": { "command": "npx", "args": ["-y", "mcp-vibelens@1"] }
  }
}
```

| IDE | Where the config lives | How to verify |
| --- | --- | --- |
| Claude Code | `claude mcp add vibelens --scope user -- npx -y mcp-vibelens@1`, or `.mcp.json` in the project for `--scope project` | Run `/mcp` in a session; `vibelens` should show as connected |
| OpenAI Codex (CLI and IDE extension) | `~/.codex/config.toml` under `[mcp_servers.vibelens]`, or `codex mcp add vibelens -- npx -y mcp-vibelens@1` | `codex mcp list` |
| Cursor | `.cursor/mcp.json` in the project, or `~/.cursor/mcp.json` | Settings -> MCP; the server must also be toggled on |
| Google Antigravity | `~/.gemini/antigravity/mcp_config.json` or `~/.gemini/config/mcp_config.json`, depending on build | Open it from the in-app MCP menu so you are certain which file is live |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | Reload the window after editing |
| VS Code (Copilot agent mode) | `.vscode/mcp.json`, using the `servers` key rather than `mcpServers` | The MCP view in the sidebar |
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS | Fully quit and reopen the app; a window reload is not enough |

Checklist when it is still missing:

1. **Validate the JSON.** A trailing comma silently disables the whole file in
   most hosts. `node -e "JSON.parse(require('fs').readFileSync('<path>','utf8'))"`
   will tell you.
2. **Use the right top-level key.** VS Code expects `servers`; the others expect
   `mcpServers`.
3. **Restart the host.** Config is read at startup. Claude Desktop needs a full
   quit, not a reload.
4. **Confirm `npx` is on the PATH the IDE sees.** GUI apps on macOS do not
   inherit a shell profile, so a Node installed by `nvm` may be invisible to
   them. If `command: "npx"` fails, use an absolute path
   (`/usr/local/bin/npx`, or the output of `which npx`).
5. **Check the Node version.** `node -v` must be 20 or newer; the package
   declares `engines.node >= 20.0.0`.
6. **Prove the server itself runs**, independently of any IDE:

   ```bash
   npx -y mcp-vibelens@1
   ```

   It should print `[vibelens] vibelens v<version> ready on stdio` to stderr and
   then wait. If it does, the server is fine and the problem is host config.
7. **Read the host's MCP log.** Every VibeLens diagnostic goes to stderr prefixed
   `[vibelens]`, and hosts surface child-process stderr in their MCP logs.

---

## The Claude Code plugin installs but the server will not connect

The plugin does not contain the server. `plugin/.mcp.json` launches
`npx -y mcp-vibelens@1`, so a plugin that installs cleanly can still fail to
connect for reasons that have nothing to do with the plugin.

Work through it in this order:

1. **Is the plugin installed and enabled?** `claude plugin list`. Installation
   and enablement are separate states.
2. **Is the MCP server connected?** `/mcp` inside a session. The plugin's server
   appears under the name `vibelens`.
3. **Can npx reach the package?** Run `npx -y mcp-vibelens@1` in a terminal; it
   should print the `[vibelens] ... ready on stdio` line to stderr and wait, then
   stop it with Ctrl-C. Offline machines, a private registry without an upstream
   proxy, or a corporate proxy that blocks `registry.npmjs.org` all break this —
   and the failure looks like a broken plugin.
4. **Is Chromium installed?** The plugin never installs it. The server connects
   fine without it and then every call returns `BROWSER_NOT_INSTALLED`.
5. **Did you install from the right source?** The marketplace entry must point at
   `./plugin`. If a fork changed it to `./`, Claude Code will run `npm install`
   in the repository root and pull roughly 112 MB of devDependencies into the
   plugin cache. `node scripts/validate-manifests.mjs` fails on this
   ([ADR 0005](./adr/0005-plugin-ships-from-subdirectory.md)).
6. **Did the plugin update but the behaviour did not?** Claude Code ships an
   update only when `version` in `plugin/.claude-plugin/plugin.json` changes.
   Since the plugin launches `mcp-vibelens@1`, a new patch of the npm package
   arrives independently of any plugin version.
7. **Are the plugin's own components present?** The plugin provides slash commands for
   its skills (`/vibelens:check-ui`, `/vibelens:responsive-audit`,
   `/vibelens:console-triage`, `/vibelens:a11y-audit`, `/vibelens:before-after`), two
   subagents in `plugin/agents/`, and a `PostToolUse` hook that reminds you a frontend
   edit is unverified until re-captured. If the slash commands are missing but `/mcp`
   shows the server connected, the plugin is not installed and you have a bare MCP
   server configured instead.

---

## Stdout corruption

The most confusing failure mode, because there is no error message.

**Symptoms.**

- The host reports the server as failed or disconnected shortly after start.
- `tools/list` returns nothing, or the host reports a JSON parse error.
- A tool call hangs forever and no `[vibelens]` line explains it.
- The server works when run manually but not under the IDE.
- Logs mention unexpected token, invalid JSON-RPC, or an unparseable frame.

**Cause.** Under stdio transport, stdout carries JSON-RPC frames and nothing
else. Any other byte written there corrupts the stream. This is invariant 1 in
`CLAUDE.md`: no module in `src/` calls `console.log`, and every diagnostic goes
through `log()` in `server.ts`, which writes to stderr with a `[vibelens]`
prefix.

**If you are a user:** the published package does not write to stdout, so
suspect the surroundings.

- Anything in `command` that prints before the server starts will break it —
  wrapper scripts that echo a banner, a version-manager shim that prints, a shell
  profile writing to stdout for non-interactive shells (a classic: `echo` in
  `.bashrc` or `.zshenv`).
- Prove it with a direct run: `npx -y mcp-vibelens@1 > /tmp/vl.out 2> /tmp/vl.err`,
  then stop it. `/tmp/vl.err` should hold the `[vibelens] ... ready on stdio`
  line and `/tmp/vl.out` should be empty until a request is sent. Bytes in
  `/tmp/vl.out` at startup identify the culprit.

**If you are a contributor:** you added a stdout write, directly or through a
dependency. `npm test` may still pass, because the protocol tests use
`InMemoryTransport` and never touch a pipe. The check that catches it is
`node scripts/smoke.mjs`, which spawns `dist/index.js` and completes an
`initialize` -> `tools/list` -> `tools/call` exchange over real stdio. Run it
before declaring transport-adjacent work done.

---

## Other symptoms

**Captures are slow.** Every call launches and closes its own Chromium, so cold
start is included in `summary.captureMs`, along with your `delay` and the
`networkidle` wait of up to 5 s. There is no browser pool in v1; the reasoning is
in `ARCHITECTURE.md`. Lower `delay` if you do not need it.

**`domTruncated: true`.** The sanitized DOM hit `MAX_DOM_CHARS` (20,000) and the
tree in the response is partial, marked in-band. Inspect a narrower route rather
than the whole application shell. Element-scoped capture is on the roadmap.

**A class the model needs is missing from the snapshot.** The sanitizer keeps
`id`, `class`, `role`, `aria-*`, `data-testid`/`-test`/`-cy`/`-qa`, and form and
table structure attributes; everything else is dropped, so a custom attribute you
rely on will not appear. Contents of `svg`, `canvas`, `iframe`, `video`, `audio`,
`object`, `embed`, `map` and `picture` are removed entirely — the element remains
as an empty box because it still affects layout.

**A `console.log` I added is not in the output.** Only `error` and `warning` are
captured; `console.log` is dropped as noise. Use `console.error` while debugging
with this tool.

**Text in the snapshot ends with `…[truncated]`.** Per-node text is capped at 160
characters and attributes at 300. Expected behaviour, not data loss in the page.

**A logged-in page renders as logged-out.** Each call creates a fresh browser
context with no cookies or storage. There is no way to pass a session today.

**Fonts or images differ from my browser.** The capture runs in headless
Chromium with `locale: en-US`, `timezoneId: UTC` and `--hide-scrollbars`, using
only fonts installed on the machine. Small differences from your everyday
browser are expected; layout structure is faithful.

**Mobile capture looks unexpectedly large or sharp.** The mobile and tablet
presets use `deviceScaleFactor: 2`, so a 390x844 mobile capture is a 780x1688
image. The CSS viewport is still 390 wide, which is what breakpoints respond to.

---

## Collecting diagnostics

If you need to file an issue, this is the useful set:

```bash
node -v
npm view mcp-vibelens version
npx playwright --version
```

Plus:

- the full VibeLens error text, including the code in parentheses;
- the `summary` block from a successful call, if one succeeds;
- the shape of the URL (port and path; the host is always local);
- your IDE and its MCP config block, with any secrets removed;
- the `[vibelens]`-prefixed lines from the host's MCP log.

From a clone of the repository, the fastest confirmation that the whole pipeline
works on your machine is `npm run typecheck && npm test` — 63 tests, including
real Chromium captures against a local fixture server — followed by
`node scripts/smoke.mjs` for the stdio path.
