# ADR 0004: One tool, not many

## Status

Accepted, 2026-07-28

## Context

The obvious decomposition of VibeLens is a toolbox: `screenshot_page`,
`get_console_errors`, `get_dom_snapshot`, maybe `check_responsive`. Each has a clear
name, a small schema, and a single responsibility — good API design for a human
caller, bad API design for a model caller, for three reasons.

**The signals are only useful together.** The image shows that the CTA overflows its card
but not which class causes it. The DOM shows `class="absolute -mx-4 px-6"` but not that
the result looks wrong. The console explains a hydration error that fits neither. A model
given one signal at a time has to know in advance which one it needs, which is exactly
what it cannot know before looking.

**Each extra tool multiplies the chance of a wrong first call.** More tools means more
descriptions competing for attention and more opportunity to pick the
plausible-but-wrong one. A single tool with an unambiguous description removes the
routing decision.

**Multiple calls mean multiple browser launches.** Every call launches and closes its own
Chromium, so three tools to answer one question is three launches, three navigations, and
three chances for the page to be in a different state — the screenshot and the DOM would
no longer be guaranteed to describe the same render.

## Decision

Expose exactly one tool, `inspect_localhost_ui`, returning all three signals from
one render.

The schema is one required string plus three bounded, defaulted options:

| Parameter | Shape |
| --- | --- |
| `url` | required string |
| `viewport` | enum `desktop` \| `tablet` \| `mobile`, default `desktop` |
| `delay` | integer 0–15000, default 1000 |
| `fullPage` | boolean, default false |

Variation lives in enumerated parameters, not in tool names. `viewport` is a
three-value enum rather than free `width`/`height` numbers for the same reason: a
bounded set is what a model gets right on the first attempt, and the presets carry
`deviceScaleFactor`, `isMobile` and `hasTouch` that a raw width could not.

The response is two content blocks: the image first, because the model's vision pass
anchors on it, then a JSON text block whose largest field, `simplifiedDOM`, is
serialized last so diagnostics survive client-side truncation. The tool is annotated
`readOnlyHint: true` and `openWorldHint: false`. `CLAUDE.md` states the rule for
future work: keep the schema small and bounded.

## Consequences

- One call answers "what does this page look like and what is wrong with it". The model
  does not have to plan a sequence, and the developer does not have to prompt for one.
- The three signals are guaranteed to describe the same render, taken from the same page
  instance milliseconds apart, so cross-referencing them is sound. It is also one
  browser launch per question, which is what makes the ephemeral-browser resource model
  affordable.
- The description can be written as workflow guidance ("read the classes in the DOM
  snapshot before proposing a fix") because there is no ambiguity about which tool it
  applies to.
- **Given up: paying only for what you need.** A model that wants just the console errors
  still receives a JPEG and a DOM tree. The `LIMITS` budget and JPEG quality 75 (ADR 0006)
  make that acceptable, but it is real waste on a narrow question.
- **Given up: composability.** There is no way to snapshot the DOM without rendering
  an image, or to capture three viewports in one call — multi-viewport work is three
  calls, which is why the `responsive-audit` skill scripts the sequence at the prompt
  layer. Hosts that allow or deny tools by name also cannot allow the DOM snapshot
  while denying screenshots.

## Alternatives considered

**Separate `screenshot`, `console` and `dom` tools.** Rejected for the three reasons above.
The decisive one is state consistency: three tools cannot promise the signals came from the
same render.

**One tool with an `include` array (`["image", "console", "dom"]`).** Rejected. It
recreates the routing problem inside the schema — the model still has to decide what it
needs before it has looked — and adds a variable response shape that prompt guidance
cannot rely on.

**A tool per viewport (`inspect_mobile`, `inspect_desktop`), or free-form `width` and
`height` instead of presets.** Both rejected. The first is name-space inflation for
what is one enum value. The second invites implausible viewports, loses the mobile
emulation flags that make a mobile capture faithful, and produces captures that cannot
be compared between sessions.

**A second tool for pre-capture interaction.** Deferred, not rejected. It is on the
roadmap, but it breaks the `readOnlyHint` annotation, so it needs its own record.
