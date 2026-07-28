# ADR 0002: Playwright over Puppeteer

## Status

Accepted, 2026-07-28

## Context

VibeLens needs a headless browser to render a dev server page and report four
things: pixels, console errors and warnings, uncaught page exceptions, and failed
network requests. The realistic candidates were Playwright and Puppeteer; both
drive Chromium over the DevTools protocol and both have mature Node APIs.

The requirements that separate them:

1. **Device emulation as a first-class concept.** The three viewport presets need
   `deviceScaleFactor: 2`, `isMobile` and `hasTouch` for mobile and tablet, so pages
   render as they would on a handset, meta-viewport handling included.
   `browser.newContext()` takes all of these as plain options.
2. **Deterministic captures.** Playwright contexts accept `locale` and
   `timezoneId`, which the code pins to `en-US` and `UTC` so two inspections of the
   same page are comparable.
3. **Network-level and HTTP-level failures as separate events.** A 404 image is a
   *successful* request with a failing status, so `requestfailed` alone is not
   enough. Playwright exposes both `requestfailed` and `response`, which
   `browser.ts` uses together, deduplicating by URL plus failure text.
4. **A load-state primitive that can be waited on and abandoned.** The capture waits
   for `networkidle` with a 5 s cap and swallows the timeout, because an app with a
   websocket never reaches it. `page.waitForLoadState(state, { timeout })` is
   exactly that.
5. **A predictable browser install story.** One documented command,
   `npx playwright install chromium`, and a missing binary must be detectable so the
   tool can return `BROWSER_NOT_INSTALLED` with that command as the hint —
   Playwright's launch error text is stable enough to match on.

## Decision

Use `playwright`, pinned to 1.62.0, with Chromium only.

The dependency is confined to `src/browser.ts`; no other module imports it. All
browser interaction happens through one exported function, `captureUIState()`, which
returns plain data (`CaptureResult`). Firefox and WebKit are not installed and not
exposed — Chromium is what most dev-server users target, and each extra engine is
another download and another rendering baseline to support. `CLAUDE.md` records the
standing instruction: do not swap Playwright for Puppeteer.

## Consequences

- Viewport emulation, locale and timezone pinning, and dual failure signals are
  configuration rather than code. The mobile preset is four fields.
- Chromium's version is pinned transitively by the Playwright version, so a capture
  is reproducible from a lockfile, and upgrading Playwright is a deliberate act that
  also moves the browser.
- The end-to-end tests can launch a real browser against a local fixture server,
  which is why mocking Playwright is explicitly discouraged: 63 tests include real
  captures, and a green run means the actual pipeline works.
- **Given up: install weight.** Chromium is a one-time download of roughly 95 MB on
  top of the npm package — the single largest onboarding friction, and one that can
  only be documented, not removed. Hence the dedicated `BROWSER_NOT_INSTALLED` code.
- **Given up: reusing a browser the developer already has.** Playwright manages its
  own builds and does not use the system Chrome. That duplication is the price of
  version determinism.
- **Given up: Puppeteer's smaller footprint.** Playwright ships surface VibeLens
  never imports (test runner integration, tracing, multiple engines) but that is
  still installed.

## Alternatives considered

**Puppeteer.** Rejected, not because it cannot do the job, but because each of
the five requirements above costs more setup: device emulation via
`page.emulate()` with a descriptor rather than context options, and no equivalent
of the context-level locale/timezone pinning. Neither is prohibitive, but the
weight of the whole list favoured Playwright, and the choice is not worth
revisiting without a concrete failure.

**Chrome DevTools Protocol directly, against a browser the user launches.**
Rejected. It removes the browser download but pushes the burden onto the user
(launch Chrome with a debugging port, keep it running) and forces VibeLens to
reimplement navigation, load-state and screenshot semantics.

**A screenshot service or WebDriver/Selenium.** Rejected. A hosted service cannot
reach `localhost` and contradicts ADR 0001 and ADR 0003. WebDriver adds a driver
process and gives weaker console and network instrumentation than the DevTools
protocol.

**Installing all three Playwright engines.** Rejected for v1: tripling the
download to serve a use case nobody asked for is the wrong first trade. The
engine choice is one line in `launchBrowser()` if that changes.
