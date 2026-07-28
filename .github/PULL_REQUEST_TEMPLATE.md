# Summary

<!-- What does this change and why? The diff shows the what; explain the why.
     Link the issue it closes: Closes #123 -->

## Type of change

- [ ] `feat` — new capability or tool parameter
- [ ] `fix` — bug fix
- [ ] `security` — hardening of the allowlist or sanitizer
- [ ] `perf` — faster or lighter, same behaviour
- [ ] `refactor` — no behaviour change
- [ ] `docs` — documentation only (including `CLAUDE.md` and ADRs)
- [ ] `test` — tests only
- [ ] `build` / `ci` / `chore`
- [ ] Breaking change (`!` on the type, or a `BREAKING CHANGE:` footer)

## Verification

Run these locally and check what passed. If you could not run something, say so
below rather than leaving it blank.

- [ ] `npm run typecheck`
- [ ] `npm test` — full suite, real Chromium (`npx playwright install chromium` first)
- [ ] `npm run build`
- [ ] `node scripts/smoke.mjs` — the built server answers over real stdio
- [ ] `node scripts/validate-manifests.mjs` — manifests parse and versions are in sync
- [ ] `claude plugin validate .` — the marketplace catalog at the repo root
- [ ] `claude plugin validate ./plugin` — the plugin itself
- [ ] Added or updated tests covering this change; a bug fix has a test that failed before it

Anything you could not run, and why:

<!-- e.g. "no Claude Code CLI on this machine, so the two plugin validate steps
     were skipped; the manifest validator passed" -->

## Invariants

Confirm this change does not break the invariants in
[CLAUDE.md](../CLAUDE.md#invariants--do-not-break-these). Tick every line — "not
applicable" still means it holds.

- [ ] **stdout is untouched.** No `console.log` anywhere; all logging goes through the `log()` helper to stderr.
- [ ] **The browser is closed in a `finally` block** on every path, including new error paths.
- [ ] **`validateLocalUrl()` still runs before anything launches.** No bypass, no allow-any-host flag, no DNS resolution of arbitrary hostnames; metadata addresses stay blocked.
- [ ] **No new way for a failed capture to crash the process** — failures are wrapped in `CaptureError` and returned as `{ isError: true }`.
- [ ] **Every new error carries both a message and a hint.**
- [ ] **The token budget is respected.** No new unbounded payload field; any raised `LIMITS` value is justified in the summary above.
- [ ] **`sanitizeDomInPage` is still self-contained** — no imports or module-scope references; config arrives through its single argument.
- [ ] **The tool is still read-only.** No clicking, typing, mutating navigation or file writes.
- [ ] **`plugin/` still contains no `package.json`**, and the marketplace source is still `./plugin`.
- [ ] **Version bumps, if any, are in BOTH `package.json` and `plugin/.claude-plugin/plugin.json`** and the two strings match. Claude Code only ships an update when `plugin.json` changes, and the manifest validator fails on drift.
- [ ] Changes to `src/security.ts` add new cases to the tables in `tests/security.test.ts`.

## Docs

- [ ] `README.md` updated (a new parameter that is not documented does not exist for users)
- [ ] `docs/` updated (`PRD-TRD.md`, `TROUBLESHOOTING.md`, `FAQ.md`, or a new ADR)
- [ ] `CLAUDE.md` updated if an assistant working on this repo needs to know
- [ ] `CHANGELOG.md` entry added under `## [Unreleased]`
- [ ] Not needed

## Evidence

<!-- For capture, sanitizer or UI-adjacent changes: paste the relevant slice of a
     `summary` payload, or a before/after of the sanitized DOM. You have a tool
     that produces exactly this. -->

---

- [ ] I have read [CONTRIBUTING.md](../CONTRIBUTING.md) and my commits follow Conventional Commits.
- [ ] I agree to license this contribution under the [MIT License](../LICENSE).
