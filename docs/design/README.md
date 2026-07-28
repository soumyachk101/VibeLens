# Design knowledge base

Reference material for building and reviewing a frontend that reads as designed
rather than generated. The plugin's skills stay short and link here when they
need depth.

## Who reads this

An AI agent, mid-task. You have either just been asked to build UI, or you have
captured a page with `inspect_localhost_ui` and now have to judge it. These
files exist because "make it look good" is not actionable and because a model
writing CSS from memory reaches for the same defaults every time — the ones
that make output recognisable as machine-written.

Read the file that matches the decision in front of you. Do not read all five
before starting; that wastes context you will need for the code.

## How to use it

| Situation | Read |
| --- | --- |
| Reviewing a screenshot and looking for what is wrong | [ANTI-SLOP.md](./ANTI-SLOP.md) |
| Setting up a project's visual foundation from nothing | COLOR, then TYPOGRAPHY, then SPACING-LAYOUT |
| A specific decision (one size, one colour, one duration) | the matching file's table only |
| Adding animation | [MOTION.md](./MOTION.md) |

## The files

| File | Contents | Use when |
| --- | --- | --- |
| [ANTI-SLOP.md](./ANTI-SLOP.md) | The recognisable tells of machine-generated UI, why each reads that way, and the concrete correction | Reviewing any page, or before writing the first line of a new component |
| [TYPOGRAPHY.md](./TYPOGRAPHY.md) | Modular type scale, line-height and measure, letter-spacing, font pairing, variable fonts, loading mechanics, OpenType features, `text-wrap` | Text looks flat, uniform, too wide, or shifts on load |
| [COLOR.md](./COLOR.md) | Deriving a palette from one accent, OKLCH ramps, tinted neutrals, semantic tokens over primitives, WCAG contrast, dark mode as a mapping | Choosing any colour, or checking contrast |
| [SPACING-LAYOUT.md](./SPACING-LAYOUT.md) | 4px spacing scale, proximity, optical alignment, grid vs flex, container queries, `min()`/`clamp()`/`aspect-ratio`/`gap`, density, named z-index | Spacing is arbitrary or uniform, layout is a card grid by default |
| [MOTION.md](./MOTION.md) | Duration bands, easing by intent, compositor-safe properties, `prefers-reduced-motion`, stagger, view transitions, what never to animate | Adding or auditing animation |

## Ground rules that apply across all five

1. **Decide with a system, not per element.** Every size, colour, space and
   duration comes from a named scale. A value that appears once and belongs to
   no scale is the signal that a decision was improvised.
2. **Contrast is a requirement, not a preference.** WCAG 2.2 AA: 4.5:1 for body
   text, 3:1 for large text (18.66px bold or 24px regular and above) and for UI
   component boundaries and focus indicators. Check it; do not estimate it.
3. **Every interactive element needs four states.** Rest, hover, `:focus-visible`
   and disabled — plus active where the element commits an action. Missing
   focus styling is an accessibility failure, not a polish item.
4. **Every data-driven surface needs four states.** Loading, empty, error and
   populated. A component that only renders the happy path is unfinished.
5. **Uniformity is not consistency.** Consistency means the same decision in the
   same situation. Uniformity — one radius, one padding, one shadow, one text
   size everywhere — removes the hierarchy a reader uses to navigate.
6. **Prefer the platform.** `oklch()`, container queries, `text-wrap: balance`,
   `aspect-ratio`, `gap`, `:focus-visible`, `color-mix()` and view transitions
   are CSS features, not libraries. Reach for a dependency only when the
   platform genuinely lacks the capability.
7. **Verify with a capture.** Reasoning about rendered output without looking at
   it is how the original problem started. Change, re-capture, compare.

## Scope

These files cover visual and interaction craft. They do not cover component API
design, state management, framework choice, or full accessibility conformance —
contrast, focus, motion preference and tap-target guidance here are a floor, not
an audit. For accessibility work beyond that floor, test with a keyboard and a
screen reader.
