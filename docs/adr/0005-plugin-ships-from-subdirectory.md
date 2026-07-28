# ADR 0005: The plugin ships from a subdirectory

## Status

Accepted, 2026-07-28

## Context

VibeLens is distributed through two channels from one repository: the npm package
`mcp-vibelens`, which is the server binary every IDE launches with
`npx -y mcp-vibelens@1`; and a Claude Code plugin, which bundles that MCP server
together with skills that encode the capture-fix-recapture workflow.

Claude Code installs a plugin from a marketplace catalog. The catalog entry has a
`source` field, and the natural first choice is `"./"` — the repository root, where
`.claude-plugin/` already lives.

That was measured and it is wrong. Claude Code runs `npm install` inside a plugin
directory that contains a `package.json`. The repository root has one, listing
`typescript`, `tsx`, `vitest`, `@types/node` and the transitive `playwright`
dependency tree. Installing a plugin whose source was the repo root therefore copied
roughly **112 MB** of devDependencies into the user's plugin cache — none of which
the plugin needs, because it does not run the server from source. Its `.mcp.json`
launches the *published npm package*. The plugin's actual payload is manifests and
Markdown — skills, subagents, a hook definition: kilobytes, not megabytes.

## Decision

The plugin lives in `plugin/`, and `plugin/` must never contain a `package.json`.

- `.claude-plugin/marketplace.json` at the repo root sets `"source": "./plugin"`.
- `plugin/.claude-plugin/plugin.json` is the plugin manifest.
- `plugin/.mcp.json` launches `npx -y mcp-vibelens@1`, so the plugin consumes the
  same published artifact as every other IDE.
- `plugin/skills/*/SKILL.md` holds the skills, with subagents in `plugin/agents/` and a
  hook definition in `plugin/hooks/hooks.json`.
- A root `.mcp.json`, byte-identical to `plugin/.mcp.json`, serves anyone who clones
  the repository.

`scripts/validate-manifests.mjs` enforces the parts a human will otherwise get
wrong, and runs in CI:

- `source` must be exactly `"./plugin"`, with a failure message that explains the
  cache blow-up;
- `plugin.json`'s `version` must equal `package.json`'s, because Claude Code only
  ships an update when that string changes and the two drift silently otherwise;
- the marketplace entry must **not** carry a `version` field — `plugin.json` wins, so
  a version there is dead config that misleads readers;
- `plugin/.mcp.json` must reference the package name from `package.json`, so renaming
  the npm package cannot leave the plugin launching a package that no longer exists;
- the two `.mcp.json` copies must be identical.

## Consequences

- Installing the plugin transfers only manifests and Markdown. No `npm install`
  runs, so no devDependency tree is copied.
- npm stays the single source of truth for executable code: the plugin cannot drift
  from the server, because it does not contain the server. Releases are therefore
  ordered — npm publishes first, since the plugin only launches an already-published
  package, as recorded in `RELEASE.md`.
- **Given up: a one-line release.** A version bump must be applied in two files,
  `package.json` and `plugin/.claude-plugin/plugin.json`. The validator turns
  forgetting into a CI failure rather than a silently non-updating plugin, but the
  duplication is real.
- **Given up: running the plugin from source.** With no `package.json` and no build
  in `plugin/`, a contributor cannot test local server changes through the installed
  plugin. Local development goes through `npm run dev` or a direct
  `node dist/index.js` MCP entry.
- **Given up: a flat repository layout.** Newcomers reasonably expect
  `.claude-plugin/` and the plugin content to sit together. They do not, and both
  `CLAUDE.md` and the README carry a note explaining why.

## Alternatives considered

**`source: "./"` (repository root).** Rejected on measurement: ~112 MB of
devDependencies in the plugin cache per user, for zero benefit.

**Keep the root as source but remove `package.json`.** Impossible. It is the npm
package manifest, the script runner, and the dependency list.

**Publish the plugin from a separate repository.** Rejected. Two release processes,
two issue trackers, and guaranteed drift between the skills and the tool they
describe. One version-sync check in one repository is cheaper.

**Bundle the built server inside the plugin instead of launching npm.** Rejected. It
would put compiled JavaScript in the plugin cache, require a build step in the plugin
directory, and give plugin users a different binary from every other IDE.

**Trust contributors to remember the layout rule.** Rejected. The failure is
invisible at author time and expensive at user time, which is the class of mistake
worth spending a CI check on.
