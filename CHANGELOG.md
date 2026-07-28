# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [1.0.0] - 2026-07-28

Initial public release of `mcp-vibelens`: an MCP server that gives an AI coding
assistant vision into a locally running web app.

### Added

- **`inspect_localhost_ui` tool** — one call returns three content blocks' worth
  of context about a running page: a JPEG screenshot, console/network
  diagnostics, and a token-optimized DOM snapshot. Annotated `readOnlyHint`; it
  observes a page and never modifies the project.
  - Parameters: `url` (required), `viewport` (`desktop` 1920x1080 /
    `tablet` 820x1180 @2x / `mobile` 390x844 @2x with touch and mobile
    emulation), `delay` (0-15000 ms, default 1000), `fullPage` (default false).
  - A missing URL scheme is assumed to be `http://`.
- **Diagnostics collection** — console errors and warnings with source
  locations, uncaught page errors, and failed network requests with method,
  status and failure reason. This is the part a screenshot cannot show:
  hydration errors, uncaught exceptions and 404 assets.
- **DOM sanitizer** (`sanitizeDomInPage`, run inside the browser) — removes
  `script`, `style`, `noscript`, `template`, `link`, `meta` and comments;
  collapses `svg`, `canvas`, `iframe`, `video`, `audio`, `object` and `embed` to
  empty placeholders so the box still shows in the tree; keeps `id`, `class`,
  `role`, `aria-*`, `data-testid`/`-test`/`-cy`/`-qa` and form/table structure
  attributes; strips `data:` URIs; caps attributes at 300 characters, inline
  `style` at 120, text nodes at 160, and the whole tree at 20,000 with an
  explicit truncation marker. A page whose raw HTML is ~10 KB comes back as
  ~700 characters with every class name intact.
- **SSRF guard** (`validateLocalUrl`) — an allowlist checked before Chromium is
  launched. Allows `localhost`, `*.localhost`, `127.0.0.0/8`, `0.0.0.0`,
  `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `[::1]`, `fc00::/7` and
  `fe80::/10`. Blocks every public host and IP, all non-`localhost` DNS names
  (resolving them would reintroduce DNS rebinding), cloud instance-metadata
  endpoints (`169.254.169.254`, `169.254.170.2`, `fd00:ec2::254`,
  `100.100.100.200`) and all of `169.254.0.0/16`, non-HTTP schemes, and URLs
  carrying credentials.
- **Actionable error contract** — every failure is wrapped in a `CaptureError`
  carrying both a message and a hint, returned as `{ isError: true }` rather
  than crashing the stdio server: `BROWSER_NOT_INSTALLED`,
  `CONNECTION_REFUSED`, `INVALID_URL`, `UNSAFE_PORT`, `TIMEOUT`.
- **Ephemeral browser lifecycle** — each call launches Chromium and closes it in
  a `finally` block, so a failed capture cannot leave a zombie process holding
  hundreds of MB of RSS.
- **Claude Code plugin** (`plugin/`) with the `check-ui` and `responsive-audit`
  skills, both slash-invocable and model-invocable, plus a one-plugin
  marketplace catalog at `.claude-plugin/marketplace.json`.
- **Documentation** — `README.md` with per-IDE configuration for Claude Code,
  OpenAI Codex, Cursor, Google Antigravity, Windsurf, VS Code Copilot agent mode
  and Claude Desktop; `CLAUDE.md` with the architecture and the non-negotiable
  invariants; `docs/PRD-TRD.md`; and `RELEASE.md`.
- **Test suite** — 63 vitest tests: a table-driven security allow/block
  inventory, DOM truncation units, an end-to-end capture against a fixture page
  that deliberately contains a console error, an uncaught exception, a 404
  image, a base64 data URI, a huge SVG path and long text, and a full MCP
  protocol test driving the real server through a real client.
- **CI and release automation** — GitHub Actions running typecheck, tests,
  build and a real-stdio smoke test on Node 20, 22 and 24, plus a manifest
  validator that keeps `package.json` and the plugin manifest versions in sync;
  tag-triggered npm publish with provenance.

[Unreleased]: https://github.com/soumyachk101/VibeLens/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/soumyachk101/VibeLens/releases/tag/v1.0.0
