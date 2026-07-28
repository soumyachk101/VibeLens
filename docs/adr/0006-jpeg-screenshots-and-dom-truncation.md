# ADR 0006: JPEG screenshots and DOM truncation

## Status

Accepted, 2026-07-28

## Context

Everything VibeLens returns is spent from the caller's context window. The tool is
only useful if it can be called repeatedly inside one conversation: capture, fix,
recapture to verify. If a single call is expensive, the model stops verifying its
own work, which removes the reason the tool exists.

Two fields dominate the cost.

**The screenshot.** A full-colour PNG of a 1920x1080 viewport is a large payload, and it
grows with `fullPage` and with the `deviceScaleFactor: 2` used by the tablet and mobile
presets. PNG is lossless, which is the wrong optimisation target: the model reads layout,
spacing, alignment, overflow and approximate colour, and none of those turn on exact
pixel values.

**The DOM.** A raw `document.body.outerHTML` from a framework app is easily 100 KB of
mostly noise — inline scripts, injected style blobs, base64 data URIs, SVG path data,
framework bookkeeping attributes, long body text. The sanitizer described in
`ARCHITECTURE.md` handles the ordinary case well: the test fixture's ~10 KB page reduces
to ~680 characters with every Tailwind class intact. But a sanitizer is proportional — a
page with 50,000 real elements produces a large output no matter how good the rules are,
and proportional is not a budget.

## Decision

Two independent controls: lossy image encoding, and hard caps on every text field.

**Screenshots are JPEG at quality 75.** Encoded once in `SCREENSHOT` in
`src/types.ts` and used by both the capture and the MCP response
(`mimeType: "image/jpeg"`). There is no format parameter — the model cannot
request PNG.

**Every text field has an absolute cap**, all of them in `LIMITS`:

| Constant | Value | Bounds |
| --- | --- | --- |
| `MAX_DOM_CHARS` | 20,000 | The sanitized DOM string |
| `MAX_TEXT_LENGTH` | 160 | Each text node |
| `MAX_ATTR_LENGTH` | 300 | Each kept attribute |
| `MAX_CONSOLE_ENTRIES` | 40 | Console entries, and page errors |
| `MAX_CONSOLE_LENGTH` | 600 | Each console entry or page error |
| `MAX_FAILED_REQUESTS` | 20 | Failed requests, deduplicated |

**Truncation is always visible.** `truncateDom()` appends
`<!-- VibeLens: DOM truncated at N characters (original M). -->`, and
`summary.domTruncated` reports the same fact in structured form. Attribute truncation is
marked `…[truncated]`, and stripped data URIs become `data:<mime>[stripped]`. A model
that knows the tree is partial narrows its next request; a model that does not know
reasons about markup it never received. Two supporting choices: `console.log` is
discarded and only `error` and `warning` recorded, and `simplifiedDOM` is serialized last
in `buildTextPayload()` so a client truncating the text block loses DOM rather than
diagnostics.

## Consequences

- A capture is cheap enough to repeat, which is what makes verify-after-fix a normal habit
  rather than a luxury. The worst case is bounded, not merely improbable: the cap is a hard
  slice in Node after the in-page sanitizer has run, and in normal use nothing reaches
  `MAX_DOM_CHARS` — the caps exist for the pathological page.
- **Given up: pixel-exact screenshots.** JPEG introduces compression artifacts around
  sharp edges and text. VibeLens is unsuitable for visual regression diffing or for
  judging anti-aliasing, gradient banding or exact colour values; a 1px border is at the
  edge of what the image supports.
- **Given up: complete text content and complete markup on large pages.** Text nodes cut
  at 160 characters mean copy review and verbatim-text tasks are not served, and a very
  large page returns a truncated tree in which the element the model needs may be past
  the cut. The in-band marker makes the latter visible but does not solve it;
  element-scoped capture is the roadmap answer.
- **Given up: seeing `console.log`**, and **caller control** — no parameter adjusts
  quality or any cap. Raising a limit is a code change requiring justification, which is
  the point: the budget cannot be eroded one prompt at a time.

## Alternatives considered

**PNG screenshots.** Rejected: several times the payload for fidelity the model does not
use, worth reopening only if visual regression becomes a goal, which would be a different
product. **WebP** was not adopted either — better size at equal quality, but it adds a
support question across MCP hosts and vision pipelines for a marginal gain over JPEG 75.

**A `quality` or `format` parameter.** Rejected under ADR 0004: every extra parameter is
a chance for a wrong call, and the default would nearly always be right. **The sanitizer
alone, with no hard cap**, was rejected too: its output is proportional to page size, so
the caller's context would be at the mercy of whatever page it was pointed at.

**Silent truncation.** Rejected. A model that cannot tell the tree is partial will
confidently conclude an element does not exist. In-band marking costs a few characters
and prevents a class of wrong answers — as does doing the filtering in the page at all,
which is what turns ~10 KB into ~680 characters instead of shipping raw HTML for the
model to sift.
