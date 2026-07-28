# FAQ

Answers reflect what the code in `src/` actually does. Where the honest answer is
"no" or "not yet", it says so.

### Why not just paste a screenshot into the chat myself?

You can, and for a one-off it is fine. Three things change when the assistant
takes the capture itself. It gets the console and network errors alongside the
pixels, which a screenshot cannot show — a hydration mismatch or a 404 hero image
is invisible in an image. It gets the real DOM, so it edits a class that exists
instead of the one it remembers writing. And it can recapture after its own edit
to check the fix, without you doing another round trip. The last one is the
biggest change in practice: verification stops depending on your attention.

### Does it work with my framework?

It renders a URL in Chromium, so the framework is irrelevant: Next.js, Vite,
React, Vue, Svelte, Angular, Astro, Rails, Django, a static `python -m
http.server`. If your dev server answers HTTP on a local port, it works. The only
framework-shaped concern is timing — apps that render after hydration or a data
fetch may need `delay` raised to 2000–3000 ms.

### Can it inspect my staging or production site?

No, and that is deliberate rather than unimplemented. Only `localhost`,
`*.localhost` and private-network addresses are allowed. The URL is chosen by a
model that may have read untrusted content, and VibeLens opens it in a real
browser on your machine with your local network access — that is an SSRF
primitive if unconstrained. The allowlist is the boundary. There is no flag to
relax it, because an opt-out would be the first thing an injected prompt tried to
talk the model into setting. See
[ADR 0003](./adr/0003-ssrf-allowlist-not-denylist.md).

### Why are hostnames rejected even when they resolve locally?

Because resolving them is the vulnerability. If VibeLens looked up a hostname and
checked the resulting IP, Chromium would then perform its own separate lookup
milliseconds later — and an attacker-controlled DNS zone with a short TTL can
return a private address to the check and a public one to the browser. Refusing
hostnames outright removes the race. `localhost` and `*.localhost` are exempt
because RFC 6761 reserves them as always-local, so they need no lookup.

### Why only one tool? A `screenshot` tool would be simpler.

The three signals are only useful together: the image shows the button overflows,
the DOM shows which class is responsible, the console explains why the render does
not match either. Splitting them means the model has to know which one it needs
before it has looked, and three calls would be three browser launches of three
possibly-different page states. One tool also removes the routing decision, which
is where models most often make a wrong first call. See
[ADR 0004](./adr/0004-single-tool-not-many.md).

### Why JPEG instead of PNG? The screenshot looks slightly soft.

Because the payload is spent from your assistant's context window, and the tool is
only useful if it can be called repeatedly. JPEG at quality 75 preserves layout,
spacing, alignment, overflow and approximate colour, which is what the model
reasons about. It does cost you fidelity: VibeLens is not suitable for visual
regression diffing, and judging a 1px border or a subtle gradient is at the edge
of what the image supports. See
[ADR 0006](./adr/0006-jpeg-screenshots-and-dom-truncation.md).

### How much of my context window does one call cost?

The image plus a JSON text block. The DOM is the field that would otherwise
dominate, and the sanitizer collapses it hard: the test fixture's ~10 KB page
comes back as ~680 characters with every Tailwind class intact. Every text field
is also hard-capped — 20,000 characters of DOM, 160 per text node, 300 per
attribute, 40 console entries, 20 failed requests. In normal use nothing reaches
those caps; they exist for the pathological page.

### Can it click a button, fill a form, or scroll before capturing?

Not today. The tool is annotated `readOnlyHint: true` and it only observes:
navigate, wait, read, capture. Pre-capture interaction is on the roadmap, and it
is a genuine design change rather than a small feature, because it breaks the
read-only guarantee that the annotation and the documentation currently promise.

### Can it inspect a page that requires login?

Not usefully. Every call creates a fresh browser context with no cookies, no
`localStorage` and no service workers, so an authenticated route renders as
logged-out or redirects to a login page. That isolation is intentional — it is
what makes two captures of the same URL comparable — but it does mean
authenticated pages are currently out of reach. If your app has a dev-mode bypass
or a seeded session cookie set by the server, that works.

### Does it leave browser processes running, and why not reuse one?

No, it does not leak: each call launches its own Chromium and closes it in a
`finally` block, which itself swallows close errors so a teardown failure cannot
mask the real one. That strictness matters because the server lives for your whole
IDE session, and a leaked Chromium costs hundreds of MB of RSS you would notice
hours later as a slow laptop rather than as a failed call.

A pool would save the launch cost, but it has to answer eviction, idle timeouts,
crash recovery and shutdown-on-disconnect, and every one of those answers is a new
way to leak a browser — the exact failure the current design makes impossible. The
usage pattern also does not reward it: calls arrive a handful of times per session,
seconds to minutes apart, so a pooled browser would sit idle holding memory on a
laptop already running your dev server and IDE. Reuse would additionally bleed
state between captures. `summary.captureMs` is in every response, so if launch
overhead ever dominates real usage there will be data to justify changing this.

### Why do I still need `npx playwright install chromium`?

Playwright manages its own pinned browser builds rather than using your system
Chrome, which is what makes a capture reproducible from a lockfile. Installing the
npm package does not download a browser; that is a separate one-time step of
roughly 95 MB, shared across all projects on the machine. If you skip it, the tool
returns `BROWSER_NOT_INSTALLED` with that exact command as the hint rather than
failing opaquely.

### The screenshot is blank. Is it broken?

Usually it is timing. The capture waits for `load`, then up to 5 s of
best-effort `networkidle`, then your `delay` (default 1000 ms). An app that
renders after hydration or a fetch can be captured before content appears —
raise `delay` to 2000–3000. Before assuming timing, read the text payload: a
blank page with an entry in `uncaughtPageErrors` is a crashed render that no delay
will fix, and a blank page with a 404 on its bundle in `failedRequests` is a build
problem.

### Is it safe to point this at a page with sensitive data?

The capture stays on your machine except for one thing that matters: the
screenshot and DOM are returned to your AI assistant, which for most hosts means
they are sent to a model provider. Anything visible on the page — a customer
record in a dev database, a token rendered into the DOM — travels with it. Treat a
capture like pasting a screenshot into the chat, because that is effectively what
it is.

### Can a malicious page attack my assistant through the DOM snapshot?

It can try, and this is a documented residual risk rather than something the code
prevents. Text scraped from a rendered page could contain instructions aimed at
your assistant. The allowlist bounds *where* the browser goes, not what the page
says. The mitigation is on the consuming side: the DOM snapshot is data, never
direction. Since VibeLens only reaches local addresses, the realistic exposure is
content your own dev server renders from an untrusted source.

### Why does my `console.log` never appear in the output?

Only `error` and `warning` levels are recorded; `console.log` is dropped as the
noisiest thing on a dev server. Use `console.error` while debugging with this
tool. Uncaught exceptions are captured separately as `uncaughtPageErrors`, so a
React render crash surfaces even if nothing was logged.

### Is `192.168.x.x` really allowed? That is my whole home network.

Yes, and it is the loosest part of the allowlist. It is there because dev servers
legitimately bind to a LAN address — you test on a phone against your laptop's IP,
or run the server in a VM. The narrower rule would break a real workflow. What is
excluded is the part that actually hurts: all of link-local `169.254.0.0/16`, plus
the specific metadata endpoints (`169.254.169.254`, `169.254.170.2`,
`fd00:ec2::254`, `100.100.100.200`), which are checked before the allowlist so no
future edit can accidentally permit them.

### How do I know the whole pipeline works on my machine?

From a clone: `npm run typecheck && npm test`. The suite is 63 vitest cases and it
launches a real Chromium against a local fixture page that deliberately contains a
console error, an uncaught exception, a 404 image, a base64 data URI and a huge SVG
path — so a green run means the actual capture pipeline works, not a mocked one.
Then `node scripts/smoke.mjs`, which spawns `dist/index.js` and completes an
`initialize` -> `tools/list` -> `tools/call` exchange over real stdio. That second
step is the only one that catches a stdout-corruption regression.

### Do I need the Claude Code plugin, or is the MCP server enough?

The server is enough; the plugin adds the workflow layer on top of it — skills
(`check-ui`, `responsive-audit`, `console-triage`, `a11y-audit`, `before-after`), two
subagents, and a `PostToolUse` hook that flags a frontend edit as unverified until it is
re-captured — so you do not have to describe the workflow every time. Note that the plugin
does not contain the server: its `.mcp.json` launches the published npm package, exactly
like every other IDE config. That is why a cleanly installed plugin can still fail to
connect if npm is unreachable, and why Chromium is still a separate install.
