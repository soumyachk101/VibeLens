# Contributing to VibeLens

Thanks for taking the time to look at this. VibeLens is a single-purpose MCP
server: it exposes one tool, `inspect_localhost_ui`, which drives a real
Chromium on the contributor's own machine. That makes **security and resource
cleanup more important than features**, and it shapes almost every rule below.

Before you write code, read [CLAUDE.md](./CLAUDE.md). It is the architecture and
invariant reference for both humans and AI assistants working in this repo. This
document is the process layer on top of it.

- [Getting set up](#getting-set-up)
- [The pre-PR verification checklist](#the-pre-pr-verification-checklist)
- [The invariants](#the-invariants)
- [Where each kind of change goes](#where-each-kind-of-change-goes)
- [Test conventions](#test-conventions)
- [Commit messages](#commit-messages)
- [What a good pull request looks like](#what-a-good-pull-request-looks-like)
- [Reporting bugs and security issues](#reporting-bugs-and-security-issues)

---

## Getting set up

You need **Node.js 20 or newer**. Playwright 1.62 requires >=20 and vitest 4
supports `^20 || ^22 || >=24`, so 20 is the floor for the whole toolchain. CI
runs the suite on 20, 22 and 24.

```bash
git clone https://github.com/soumyachk101/VibeLens.git
cd VibeLens
npm install
npx playwright install chromium   # one-time, ~95 MB, required for the tests
```

Then confirm the checkout is healthy before changing anything:

```bash
npm run typecheck
npm test          # 63 tests; several launch a real Chromium
npm run build
node scripts/smoke.mjs
```

If that is green, you have a working baseline. If it is not, fix the environment
first — a red baseline makes it impossible to tell whether your change broke
something.

Useful during development:

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the server from source over stdio (`tsx src/index.ts`). |
| `npm run test:watch` | vitest in watch mode. |
| `npm run typecheck` | `tsc --noEmit` with `strict` and `noUncheckedIndexedAccess`. |
| `npm run build` | Emits `dist/`. |
| `node scripts/smoke.mjs` | Spawns `dist/` and drives it over real stdio, end to end. |
| `node scripts/validate-manifests.mjs` | Checks the plugin/marketplace manifests and version sync. |
| `npm run validate:plugin` | `claude plugin validate .` (needs the Claude Code CLI). |

Dependencies are **pinned exactly**, deliberately. Do not widen a range, do not
add a dependency without a concrete reason stated in the PR, and do not swap
Playwright for Puppeteer — the DOM sanitizer and the capture engine both depend
on Playwright semantics.

## The pre-PR verification checklist

Run all of these locally before you open a pull request, and paste the outcome
into the PR description. CI runs the same things, but finding a failure locally
is a minute instead of ten.

```bash
npm run typecheck                    # 1. strict TypeScript, no emit
npm test                             # 2. full vitest run, real Chromium
npm run build                        # 3. dist/ compiles
node scripts/smoke.mjs               # 4. the built server answers over stdio
node scripts/validate-manifests.mjs  # 5. manifests parse, versions in sync
claude plugin validate .             # 6. marketplace catalog at the repo root
claude plugin validate ./plugin      # 7. the plugin itself
```

Notes on the ones that are easy to skip:

- **Step 4 is not redundant with step 2.** The vitest suite drives the server
  in-process through `InMemoryTransport`. `scripts/smoke.mjs` spawns the built
  `dist/index.js` as a child process and speaks JSON-RPC over real pipes, which
  is the only check that catches a stray stdout write or a broken shebang.
- **Steps 6 and 7 need the Claude Code CLI.** If you do not have it installed,
  say so in the PR and make sure step 5 passed; CI runs the manifest validator
  on every push.
- If you changed anything under `plugin/`, also confirm `plugin/` still has **no
  `package.json`** (see invariant 9).

## The invariants

CLAUDE.md lists these under "Invariants — do not break these". They are
non-negotiable: a PR that breaks one will be asked to change approach, not
argued about. Each line below is the *why*, because an invariant you understand
is one you will not break by accident.

1. **stdout belongs to the MCP transport. Never `console.log`.** Use the `log()`
   helper in `server.ts`, which writes to stderr. *Why:* stdout carries the
   JSON-RPC stream; one stray write corrupts it and the integration dies
   silently, with no error the user can see.
2. **The browser is always closed in a `finally` block.** *Why:* the server is
   long-lived and each leaked Chromium costs hundreds of MB of RSS — painful on
   the laptops this tool runs on.
3. **Validate the URL before launching anything.** `validateLocalUrl()` is the
   only gate. No bypass flag, no "allow any host" option, no DNS resolution of
   arbitrary hostnames, and instance-metadata addresses stay unconditionally
   blocked. *Why:* the tool is a browser you can point at a URL, i.e. a
   ready-made SSRF primitive; resolving hostnames would also reintroduce DNS
   rebinding.
4. **A failed capture must never crash the process.** Catch it, wrap it in
   `CaptureError`, return `{ isError: true, content: [text] }`. *Why:* a crashed
   stdio server takes the whole MCP session down and the user has to restart
   their IDE.
5. **Every error the model sees needs a next step.** `CaptureError` carries a
   `message` (what happened) and a `hint` (what to do). *Why:* the consumer is
   an LLM; an error without a hint turns into a guess instead of a fix.
6. **Respect the token budget.** Everything in `LIMITS` exists to protect the
   caller's context window. Raising a limit needs justification; adding a new
   unbounded field to the payload is not acceptable. *Why:* an unbounded payload
   silently eats the context the assistant needs to actually fix the bug.
7. **`sanitizeDomInPage` must stay self-contained.** No imports, no
   module-scope references — configuration arrives through its single argument.
   *Why:* Playwright serializes the function with
   `Function.prototype.toString()` and evaluates it inside the page, where those
   bindings do not exist.
8. **The tool stays read-only.** It observes pages. It does not click, type,
   navigate the user's app into a mutating state, or write files. *Why:* the
   tool is annotated `readOnlyHint`, and assistants (plus users) trust that
   annotation. Roadmap work on pre-capture interaction changes this invariant
   deliberately, in CLAUDE.md, before any code lands.
9. **The plugin stays in `plugin/`, and `plugin/` never contains a
   `package.json`.** *Why:* Claude Code runs `npm install` inside a plugin
   directory that has one, which previously pushed ~112 MB of devDependencies
   into every user's plugin cache. `scripts/validate-manifests.mjs` enforces
   `source: "./plugin"`.
10. **A version bump goes in `package.json` *and*
    `plugin/.claude-plugin/plugin.json`.** *Why:* Claude Code only serves an
    update when `plugin.json`'s version string changes, and the manifest
    validator fails the build when the two drift.

## Where each kind of change goes

```
src/index.ts     Executable entrypoint. Stdio wiring only — keep it thin.
src/server.ts    MCP server: tool schema, description, response assembly,
                 error formatting. No side effects on import.
src/browser.ts   Playwright capture engine: launch -> observe -> capture -> close.
src/dom.ts       sanitizeDomInPage() (runs in the browser) + truncateDom() (Node).
src/security.ts  validateLocalUrl() — the SSRF allowlist.
src/types.ts     Shared types, VIEWPORT_PRESETS, LIMITS, CaptureError.
```

| If you are changing... | Touch | Also update |
| --- | --- | --- |
| A tool parameter | `src/server.ts` (`inputSchema`, with a `.describe()` written for a model and a safe default), `src/types.ts` (`CaptureOptions`), `src/browser.ts` (`captureUIState`) | A test, `README.md`'s parameter table, `docs/PRD-TRD.md`, and `summary`/`meta` so the model can see the value it actually got |
| The SSRF allowlist | `src/security.ts` | **New cases in `tests/security.test.ts`** (mandatory), `README.md`'s Security section, `SECURITY.md` if the threat model shifts |
| DOM sanitizing or truncation | `src/dom.ts` | `tests/dom.test.ts`, the fixture page if a new node type matters, `README.md`'s context-window section |
| Diagnostics or capture behaviour | `src/browser.ts` | `tests/capture.test.ts` plus the fixture page |
| Error messages or hints | `src/types.ts` (`CaptureError`), `src/server.ts` | `README.md`'s troubleshooting table and `docs/TROUBLESHOOTING.md` |
| Limits | `src/types.ts` (`LIMITS`) | A justification in the PR body; never inline a magic number |
| Skills, agents or hooks | `plugin/` | `plugin/.claude-plugin/plugin.json` if the manifest lists them, `README.md`'s plugin table |
| Release or distribution wiring | `package.json`, `.mcp.json`, `plugin/.mcp.json`, `.claude-plugin/marketplace.json` | `RELEASE.md`, and re-run `node scripts/validate-manifests.mjs` — renaming the npm package means updating **both** `.mcp.json` copies and every IDE snippet in `README.md` |
| Anything an AI assistant needs to know | `CLAUDE.md` | This file, if the process changed too |

Please open an issue before starting anything on the roadmap list
(element-scoped capture, pre-capture interaction, multi-viewport diffing,
network waterfall, accessibility tree). Those have design decisions attached and
one of them changes invariant 8.

## Test conventions

The suite is `vitest`, run with `npm test`. It is not fast, because it is not
pretend: several tests launch a real Chromium and capture a real page.

| File | Scope |
| --- | --- |
| `tests/security.test.ts` | Table-driven allow/block cases for `validateLocalUrl`, `parseIPv4`, `isPrivateIPv4`, `isPrivateIPv6`. |
| `tests/dom.test.ts` | Pure truncation logic. |
| `tests/capture.test.ts` | End-to-end against `tests/fixture-server.ts` with a real browser. |
| `tests/server.test.ts` | The real MCP server driven through `InMemoryTransport` with a real `Client` — the protocol surface an IDE sees. |

Three rules matter more than the rest:

**1. `tests/security.test.ts` is table-driven, and any change to
`src/security.ts` requires new cases in it.** The allow list and the block list
are arrays of URLs (the block list is `[url, reason]` pairs, so the reason shows
up in the test name). Add your case to the right table rather than writing a
bespoke `it()` block — that is what keeps the file readable as a threat
inventory. If you are relaxing the allowlist at all, add both the newly allowed
form *and* the nearest neighbour that must still be blocked.

**2. `tests/capture.test.ts` runs a real Chromium against
`tests/fixture-server.ts`.** The fixture page deliberately contains a console
error, an uncaught exception, a 404 image, a base64 data URI, a huge SVG path
and long text, so one capture exercises every branch of the sanitizer and the
diagnostics collector.

**3. Extend the fixture rather than mocking Playwright.** If you need a new
condition — a hydration warning, a slow XHR, a nested iframe — add it to the
fixture page and assert on the captured result. A mocked `page.screenshot()`
tests our own stub, not the pipeline that actually breaks. If a new fixture
element could disturb existing assertions, gate it behind its own route.

Other expectations:

- New behaviour needs a test. Bug fixes need a test that fails before the fix.
- Keep tests deterministic. No fixed sleeps to paper over a race; wait for the
  condition.
- Tests must clean up: close browsers and stop fixture servers in `finally` or
  an `afterAll`. Invariant 2 applies to test code too.
- Do not increase the total runtime carelessly. Prefer adding assertions to an
  existing capture over launching another browser.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<optional scope>): <imperative summary>

<optional body explaining the why>

<optional footer: BREAKING CHANGE: ..., Closes #12>
```

Types used here:

| Type | Use for |
| --- | --- |
| `feat` | A new capability or tool parameter. |
| `fix` | A bug fix. |
| `docs` | Documentation only, including `CLAUDE.md` and ADRs. |
| `test` | Tests only. |
| `refactor` | No behaviour change. |
| `perf` | Faster or lighter, same behaviour. |
| `build` | Build config, `tsconfig`, packaging. |
| `ci` | Workflows and CI scripts. |
| `chore` | Everything else, including dependency bumps (`chore(deps)`). |
| `security` | A hardening change to the allowlist or sanitizer. |

Useful scopes: `server`, `browser`, `dom`, `security`, `plugin`, `skills`,
`docs`, `deps`. Examples:

```
feat(server): add a selector parameter for element-scoped capture
fix(browser): close the context when networkidle times out
security(security): block IPv4-mapped IPv6 metadata addresses
docs(adr): record why hostnames are refused instead of resolved
```

Keep the summary in the imperative mood, under about 72 characters, and no
trailing period. Put the reasoning in the body — the *why* is the part reviewers
and future readers need. A breaking change needs `!` after the type or a
`BREAKING CHANGE:` footer.

## What a good pull request looks like

- **One concern per PR.** A refactor bundled with a behaviour change is much
  harder to review and to revert.
- **Fill in the PR template** honestly, including the verification checklist. If
  you could not run something, say which and why.
- **Green CI.** The workflow runs typecheck, tests, build and the stdio smoke
  test on Node 20, 22 and 24, plus the manifest validator. Do not modify the
  workflows to make a failure go away.
- **Explain the why in the description**, not just the what. The diff already
  shows the what.
- **Include evidence for UI-adjacent or capture changes** — the relevant slice
  of a `summary` payload, or the before/after of a sanitized DOM. You have a
  tool that produces exactly this.
- **Update the docs in the same PR.** A new parameter that is not in `README.md`
  effectively does not exist for users.
- **Match the existing style.** Small named single-purpose functions, no classes
  except `CaptureError`, `LIMITS` constants instead of magic numbers, and
  comments that explain trade-offs rather than restating the code.
- **Expect review questions on anything touching `src/security.ts`, `LIMITS`, or
  the stdio path.** Those three are where a mistake is invisible in normal use
  and expensive in production.
- Draft PRs are welcome for early feedback. Say what you want reviewed.

Maintainer review is best-effort by one person, so please be patient; a clear
description and a green checklist make it much faster.

## Reporting bugs and security issues

- Bugs and feature requests: use the [issue
  forms](https://github.com/soumyachk101/VibeLens/issues/new/choose). The bug
  form asks for the exact tool arguments and the `[vibelens]`-prefixed stderr
  lines, which is usually enough to reproduce.
- Questions and setup help: see [SUPPORT.md](./SUPPORT.md).
- **Security vulnerabilities: do not open a public issue.** Follow
  [SECURITY.md](./SECURITY.md) and report privately through GitHub Security
  Advisories.

By contributing you agree that your contribution is licensed under the
[MIT License](./LICENSE), and to abide by the
[Code of Conduct](./CODE_OF_CONDUCT.md).
