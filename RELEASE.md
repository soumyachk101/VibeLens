# Releasing VibeLens

Two artifacts ship from this one repository:

| Artifact | Consumed by | Source of truth |
| --- | --- | --- |
| npm package `mcp-vibelens` | every MCP client (`npx -y mcp-vibelens@1`) | `package.json` |
| Claude Code plugin `vibelens` | `claude plugin install vibelens@vibelens` | `.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json` + `.mcp.json` |

The plugin's `.mcp.json` launches the npm package, so **npm must be published
first**. A plugin release without a matching npm version installs but cannot
start the server.

---

## One-time setup

### 1. Create the GitHub repository

```bash
gh repo create VibeLens --public --source=. --remote=origin \
  --description "MCP server that gives AI coding assistants eyes on localhost"
git push -u origin main
```

### 2. Claim the npm name

`vibelens-mcp` and `vibelens` are already taken on npm by unrelated projects, so
this package publishes as **`mcp-vibelens`**. Confirm it is still free before the
first publish:

```bash
npm view mcp-vibelens version   # should 404
```

If you would rather ship under your own scope, change `name` in `package.json`
to `@<your-npm-user>/vibelens` and update the `args` in `.mcp.json` plus the IDE
snippets in `README.md` to match. `scripts/validate-manifests.mjs` enforces that
they stay in sync, so CI will catch a half-done rename.

### 3. Add the npm token to GitHub

Create an **Automation** access token at npmjs.com → Access Tokens, then:

```bash
gh secret set NPM_TOKEN
```

Automation tokens bypass 2FA, which the publish workflow needs. Granular tokens
also work; classic "Publish" tokens do not if you have 2FA-on-publish enabled.

---

## Every release

1. **Bump the version in both places.** They must match or CI fails:

   ```bash
   npm version 1.0.1 --no-git-tag-version    # package.json
   # then edit .claude-plugin/plugin.json → "version": "1.0.1"
   ```

   Claude Code resolves the plugin version from `plugin.json` and only serves an
   update to existing users when that string changes. Forgetting it means nobody
   gets the new version.

2. **Verify locally.**

   ```bash
   npm run typecheck
   npm test                     # 63 tests, real Chromium
   npm run build
   node scripts/smoke.mjs       # spawns dist/ over real stdio
   node scripts/validate-manifests.mjs
   npm run validate:plugin      # claude plugin validate .
   npm pack --dry-run           # confirm only dist/ + docs ship
   ```

3. **Commit, tag and push.** The tag is what triggers publishing:

   ```bash
   git add -A
   git commit -m "release: v1.0.1"
   git tag v1.0.1
   git push origin main --tags
   ```

   `.github/workflows/release.yml` re-runs the full verification, checks the tag
   against `package.json`, and publishes with `--provenance`.

4. **Confirm the publish.**

   ```bash
   npm view mcp-vibelens version
   npx -y mcp-vibelens@latest --help 2>&1 | head -3   # should start and log to stderr
   ```

5. **Confirm the plugin path.** In a scratch directory:

   ```bash
   claude plugin marketplace update vibelens
   claude plugin install vibelens@vibelens
   ```

   Then in a session: `/mcp` should list `vibelens` as connected, and
   `/vibelens:check-ui http://localhost:3000` should run against a live dev
   server.

6. **Cut GitHub release notes.**

   ```bash
   gh release create v1.0.1 --generate-notes
   ```

---

## Optional: submit to the community marketplace

Anthropic reviews third-party plugins for the `claude-community` marketplace.
Run `claude plugin validate .` first (the review pipeline runs the same check),
then submit via <https://platform.claude.com/plugins/submit>. Approved plugins
are pinned to a commit SHA and the pin advances automatically as you push.

## Rollback

npm forbids republishing a version number. To pull a bad release:

```bash
npm deprecate mcp-vibelens@1.0.1 "Broken release, use 1.0.2"
```

Then publish a fixed patch version. `npm unpublish` is only available within 72
hours and breaks anyone who already installed it — prefer deprecate plus a fix.
