# Design knowledge base

Reference material for building and reviewing a frontend that reads as designed
rather than generated. The plugin's skills stay short and link here when they
need depth.

## Who reads this

An AI agent, mid-task. You have either just been asked to build UI, or you have
captured a page with `inspect_localhost_ui` and now have to judge it.

These files exist because "make it look good" is not actionable, and because a
model writing CSS from memory reaches for the same defaults every time — the
ones that make output recognisable as machine-written. The corrections here are
specific enough to apply without further interpretation.

## How to use it

Read the file that matches the decision in front of you. Do not read all five
before starting; that spends context you will need for the code.

| Situation | Read |
| --- | --- |
| Reviewing a capture, looking for what is wrong | [ANTI-SLOP.md](./ANTI-SLOP.md) |
| Setting up a project's visual foundation from nothing | COLOR, then TYPOGRAPHY, then SPACING-LAYOUT |
| One specific decision (a size, a colour, a duration) | that file's table only |
| Adding or auditing animation | [MOTION.md](./MOTION.md) |
| Deciding whether a section should be a card grid | ANTI-SLOP §10, then SPACING-LAYOUT |

## The files

| File | Contents | Use when |
| --- | --- | --- |
| [ANTI-SLOP.md](./ANTI-SLOP.md) | The recognisable tells of machine-generated UI, why each reads that way, and the concrete correction | Reviewing any page, or before writing the first line of a new component |
| [TYPOGRAPHY.md](./TYPOGRAPHY.md) | Modular type scale, line-height and measure, letter-spacing, font pairing, variable fonts, loading mechanics, OpenType features, `text-wrap` | Text looks flat or uniform, lines run too wide, or the page shifts on font load |
| [COLOR.md](./COLOR.md) | Deriving a palette from one accent, OKLCH ramps, tinted neutrals, semantic tokens over primitives, WCAG contrast, dark mode as a mapping | Choosing any colour, or checking contrast |
| [SPACING-LAYOUT.md](./SPACING-LAYOUT.md) | 4px spacing scale, proximity, optical alignment, grid vs flex, container queries, `min()`/`clamp()`/`aspect-ratio`/`gap`, density, named z-index | Spacing is arbitrary or uniform, or layout defaults to a card grid |
| [MOTION.md](./MOTION.md) | Duration bands, easing by intent, compositor-safe properties, `prefers-reduced-motion`, stagger, view transitions, what never to animate | Adding animation, or a transition feels slow, floaty or gratuitous |

## Ground rules that apply across all five

1. **Decide with a system, not per element.** Every size, colour, space and
   duration comes from a named scale. A value that appears once and belongs to no
   scale is the signal that a decision was improvised.
2. **Uniformity is not consistency.** Consistency means the same decision in the
   same situation. Uniformity — one radius, one padding, one shadow, one text
   size everywhere — removes the hierarchy a reader navigates by.
3. **Contrast is a requirement, not a preference.** WCAG 2.2 AA: 4.5:1 for body
   text, 3:1 for large text (18.66px bold or 24px regular and above) and for UI
   component boundaries and focus indicators. Check it; do not estimate it.
4. **Every interactive element needs four states.** Rest, hover,
   `:focus-visible`, disabled — plus active where the element commits an action.
   Missing focus styling is an accessibility failure, not a polish item.
5. **Every data-driven surface needs four states.** Loading, empty, error,
   populated. A component that renders only the happy path is unfinished.
6. **Prefer the platform.** `oklch()`, container queries, `text-wrap: balance`,
   `aspect-ratio`, `gap`, `:focus-visible`, `color-mix()` and view transitions
   are CSS features, not libraries. Add a dependency only when the platform
   genuinely lacks the capability.
7. **Respect user preferences.** `prefers-reduced-motion` and
   `prefers-color-scheme` are inputs to the design, not edge cases.
8. **Verify with a capture.** Reasoning about rendered output without looking at
   it is how the original problem started. Change, re-capture, compare.

## Working order for a new project

Foundations first: later decisions depend on earlier ones, and retrofitting a
scale after components exist means touching every file.

| Step | Decision | File |
| --- | --- | --- |
| 1 | One accent hue, neutral tint, semantic token names | [COLOR.md](./COLOR.md) |
| 2 | Font stack and the ratio for the type scale | [TYPOGRAPHY.md](./TYPOGRAPHY.md) |
| 3 | Spacing base, radius scale, container widths, z-index names | [SPACING-LAYOUT.md](./SPACING-LAYOUT.md) |
| 4 | Named durations and easings | [MOTION.md](./MOTION.md) |
| 5 | Build components using only tokens from 1–4 | — |
| 6 | Review against the fast pass | [ANTI-SLOP.md](./ANTI-SLOP.md) |

If the project already has a design system, tokens or a component library, use
it. Do not introduce a second scale alongside an existing one — read the existing
tokens first and extend them.

## Reviewing rather than building

When you have a capture and the task is judgement, not construction:

1. Run the fast review pass in [ANTI-SLOP.md](./ANTI-SLOP.md) against the
   screenshot before reading any code.
2. Check `consoleLogs` and `failedRequests` — an empty box is usually a 404, not
   a styling problem.
3. Use `simplifiedDOM` for real selectors. Never name a class you have not seen
   in the tree.
4. Report defects with the evidence that shows them, and cite the file and
   section that defines the correction.
5. Distinguish a defect (fails contrast, no focus ring, overflows) from a
   preference (a hue you would have chosen differently). Report the first as a
   problem and the second as an option, if at all.

## Token vocabulary

The five files assume one shared naming convention so a token written in one
place is recognisable in another. If the project already names things
differently, follow the project.

| Prefix | Holds | Defined in |
| --- | --- | --- |
| `--surface-*`, `--text-*`, `--border-*` | Semantic colour roles | [COLOR.md](./COLOR.md) |
| `--accent*`, `--success*`, `--warning*`, `--danger*` | Accent and status colour | [COLOR.md](./COLOR.md) |
| `--text-<size>` | Type scale steps | [TYPOGRAPHY.md](./TYPOGRAPHY.md) |
| `--space-<n>` | Spacing scale steps | [SPACING-LAYOUT.md](./SPACING-LAYOUT.md) |
| `--radius-*` | Radius scale | [SPACING-LAYOUT.md](./SPACING-LAYOUT.md) |
| `--z-*` | Named stacking levels | [SPACING-LAYOUT.md](./SPACING-LAYOUT.md) |
| `--dur-*`, `--ease-*` | Motion durations and curves | [MOTION.md](./MOTION.md) |
| `--elev-*` | Layered shadows | [ANTI-SLOP.md](./ANTI-SLOP.md) §7 |

Two rules about tokens. A component reads semantic tokens, never primitives — so
a theme change is a token remap rather than a component edit. And a hard-coded
value in a component is a bug report about the scale: either the scale is missing
a step, or the value should not exist.

## Scope

These files cover visual and interaction craft. They do not cover component API
design, state management, framework choice, or full accessibility conformance —
the contrast, focus, motion-preference and tap-target guidance here is a floor,
not an audit. For accessibility work beyond that floor, test with a keyboard and
a screen reader, and consult WCAG directly.

Everything asserted here is a CSS feature, a WCAG threshold, or a stated design
rationale. There are no benchmarks or measurements in these files; if you need a
number about your own app, measure it.
