# Architecture Decision Records

Each record captures one decision that shaped VibeLens: the context at the time,
what was decided, what it cost, and what was rejected. Records are immutable.
Reversing a decision means writing a new record that supersedes the old one, not
editing history.

Format: `# ADR NNNN: Title`, then `## Status`, `## Context`, `## Decision`,
`## Consequences`, `## Alternatives considered`.

## Index

| ADR | Title | Status | Primary subject |
| --- | --- | --- | --- |
| [0001](./0001-mcp-over-stdio.md) | MCP over stdio | Accepted | Transport and integration surface |
| [0002](./0002-playwright-over-puppeteer.md) | Playwright over Puppeteer | Accepted | Browser automation dependency |
| [0003](./0003-ssrf-allowlist-not-denylist.md) | SSRF allowlist, not denylist | Accepted | Security model |
| [0004](./0004-single-tool-not-many.md) | One tool, not many | Accepted | Model-facing API shape |
| [0005](./0005-plugin-ships-from-subdirectory.md) | The plugin ships from a subdirectory | Accepted | Distribution |
| [0006](./0006-jpeg-screenshots-and-dom-truncation.md) | JPEG screenshots and DOM truncation | Accepted | Context-window budget |

## Reading order

For a first pass, 0004 and 0006 explain the model-facing design, 0003 explains
the security boundary, and 0001, 0002 and 0005 explain the plumbing.
[ARCHITECTURE.md](../ARCHITECTURE.md) describes the resulting system; these
records describe why it is that system and not another one.

## Conventions

- One decision per record. If a record needs two decisions, it needs to be two
  records.
- `## Consequences` must state what was given up, not only what was gained. A
  record with no costs listed is incomplete.
- `## Alternatives considered` names the option and the reason it lost. "We did
  not consider alternatives" is a valid answer only if it is true.
- Numbers in a record must be measurable from this repository.
