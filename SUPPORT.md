# Support

Start here — most questions are already answered:

- **[docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)** — every error code the
  tool can return (`BROWSER_NOT_INSTALLED`, `CONNECTION_REFUSED`, `INVALID_URL`,
  `UNSAFE_PORT`, `TIMEOUT`), blank screenshots, and the tool not appearing in
  your IDE.
- **[docs/FAQ.md](./docs/FAQ.md)** — what VibeLens does and does not do, IDE
  support, why it is localhost-only, and how the DOM snapshot is trimmed.
- **[README.md](./README.md)** — install, per-IDE config, and the tool's
  parameters.

Still stuck?

| I want to... | Go to |
| --- | --- |
| Ask a question or share a workflow | [Discussions](https://github.com/soumyachk101/VibeLens/discussions) |
| Report a bug | [New issue](https://github.com/soumyachk101/VibeLens/issues/new/choose) — the bug form asks for the exact tool arguments and the `[vibelens]` stderr lines |
| Request a feature | [New issue](https://github.com/soumyachk101/VibeLens/issues/new/choose) |
| Report a security vulnerability | [SECURITY.md](./SECURITY.md) — privately, never a public issue |
| Contribute code | [CONTRIBUTING.md](./CONTRIBUTING.md) |

Before filing a bug, please run `npx playwright install chromium` and confirm
your dev server is actually reachable in a normal browser — together those cover
most reports.

This is a small project maintained by one person in their own time, so support is
best-effort. A clear reproduction gets a much faster answer than a description.
