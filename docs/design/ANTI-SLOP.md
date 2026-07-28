# Anti-slop: the tells of machine-generated UI

Generated UI is rarely broken. It is recognisable — the same defaults, the same
symmetry, the same absence of hierarchy. This file names each tell, says why it
reads as generated, and gives the correction. Use it as a checklist when
reviewing a capture and as a set of constraints before writing a component.

## Fast review pass

Run these against a screenshot before reading any code. Each one that fires is a
defect with a fix below.

| # | Check | Fires when |
| --- | --- | --- |
| 1 | Accent | Untouched `blue-500` / `indigo-600` framework default |
| 2 | Radius | One radius on every element regardless of size |
| 3 | Padding | Same padding everywhere; no dense and no spacious regions |
| 4 | Alignment | Everything centred, including body copy and forms |
| 5 | Gradient text | Gradient on headings as decoration |
| 6 | Icons | Emoji used as iconography |
| 7 | Elevation | A shadow on every surface |
| 8 | Type scale | One body size; headings barely larger |
| 9 | Extremes | `#000` background or `#fff` text |
| 10 | Layout | Every section is a card grid |
| 11 | Counts | Exactly three features, three tiers, three steps |
| 12 | Copy | "Seamlessly integrate", "Powerful", "Effortlessly" |
| 13 | States | No loading, empty or error rendering |
| 14 | Focus | No visible keyboard focus, or `outline: none` |
| 15 | Hover | Identical hover treatment on every interactive element |
| 16 | Icon weight | Mixed stroke widths in one icon row |
| 17 | Measure | `text-align: justify`, or lines past ~75 characters |

---

## 1. The untouched framework accent

**Tell.** Every accent is Tailwind `blue-500`/`indigo-600` or Bootstrap
`#0d6efd` — links, primary buttons, focus rings, active tabs, icon tints.
**Why.** It is the value that appears when nobody chose.
**Fix.** Pick one accent off the default hue, derive a ramp from it, and spend it
on the single most important action in a view rather than on everything
clickable. See [COLOR.md](./COLOR.md).

```css
--accent:        oklch(0.58 0.15 258);   /* one decision, then derived */
--accent-hover:  oklch(0.52 0.15 258);
--accent-subtle: oklch(0.96 0.03 258);
```

## 2. One border-radius on everything

**Tell.** `rounded-lg` on the page container, the card, the input and the 16px
badge.
**Why.** Radius is a function of element size. One value means the relationship
was never considered.
**Fix.** A radius scale assigned by size — 4px badges, 6–8px inputs and buttons,
10–14px cards, 16–20px modals, `50%` avatars. For nested elements, inner radius =
outer radius − padding, or the corners will not look concentric.
## 3. Uniform padding, no density hierarchy

**Tell.** `p-4` on every container: section padding equals card padding equals
button padding.
**Why.** Real interfaces have dense regions (tables, toolbars, menus) and
spacious ones (hero, empty states). One value flattens that, so nothing signals
importance.
**Fix.** Choose a density per region: 4–8px for toolbars, menu items and table
cells; 8–12px for form fields and list rows; 16–24px for cards; 48–96px block
padding for page sections. See [SPACING-LAYOUT.md](./SPACING-LAYOUT.md).

## 4. Everything centred

**Tell.** Every heading, paragraph, form and empty state is centred with
`mx-auto`.
**Why.** Centring is the safe default when no reading order was designed, and
centred multi-line text has a ragged left edge, so the eye must re-find the start
of each line.
**Fix.** Centre only short self-contained text — a one or two line hero headline,
an empty-state message, a single-column dialog. Align everything else to the
start edge: body copy, labels, lists, card content, table data.

## 5. Gradient text as decoration

**Tell.** `bg-clip-text text-transparent` with a purple-to-pink gradient on the
hero heading.
**Why.** It is applied because it is available. Contrast varies along the run, so
part of the text usually fails 4.5:1, and `text-transparent` degrades badly if
the background paint does not apply.
**Fix.** Solid heading colour with real contrast. Get visual interest from weight,
size, tracking and measure. If a gradient is genuinely brand, apply it to one
word, verify contrast at both ends, and keep a solid `color` on the element.

## 6. Emoji as iconography

**Tell.** Feature lists led by rocket, sparkle and lock emoji.
**Why.** Emoji render per platform, ignore `currentColor` and stroke weight,
cannot be optically sized, and are announced literally by screen readers.
**Fix.** One icon library, one stroke width, sized against adjacent text and
inheriting colour. Mark decorative icons `aria-hidden="true"`; label meaningful
ones.

```css
.icon { inline-size: 1em; block-size: 1em; /* scales with adjacent text */
        stroke-width: 1.5; color: currentColor; }
```

## 7. Drop shadows on every surface

**Tell.** `shadow-md` on cards, inputs, buttons, nav and the page wrapper.
**Why.** Shadow encodes elevation. If everything is elevated, nothing is.
**Fix.** Reserve elevation for things that genuinely float — dropdowns,
popovers, modals, toasts, sticky bars. Use a border or a background step for
resting surfaces. Layer two soft shadows instead of one heavy one and tint them
toward the surface hue rather than pure black.

```css
--elev-0: none;                                                          /* resting: use a border */
--elev-1: 0 1px 2px oklch(0.2 0.02 258 / 0.06), 0 1px 3px oklch(0.2 0.02 258 / 0.10);   /* popover */
--elev-2: 0 4px 8px oklch(0.2 0.02 258 / 0.08), 0 12px 24px oklch(0.2 0.02 258 / 0.12); /* modal */
```

## 8. 16px body text and no type scale

**Tell.** Body 16px, `h2` 18px, `h1` 24px — everything within a few pixels of
everything else.
**Why.** Hierarchy needs distinguishable steps; sizes two pixels apart read as a
mistake, not a level.
**Fix.** Generate sizes from a ratio and skip steps between adjacent levels.
Tighten line-height and tracking as size grows. See
[TYPOGRAPHY.md](./TYPOGRAPHY.md).

## 9. Pure black and pure white

**Tell.** `background: #000`, `color: #fff`.
**Why.** Maximum contrast at both ends causes halation on emissive screens, and
it leaves no headroom — nothing can be darker than `#000` or lighter than `#fff`,
so elevation and recession become inexpressible.
**Fix.** Pull both ends in and tint them: dark surfaces near
`oklch(0.18 0.01 258)`, light text near `oklch(0.96 0.005 258)`.

## 10. Cards in a grid as the answer to every layout

**Tell.** Every section is a 3-column grid of equal cards, each with an icon, a
bold line and two lines of text.
**Why.** A card grid asserts that all items are equally important, which is
almost never true, and repeating it removes any narrative.
**Fix.** Let the content's shape choose the layout.

| Content | Layout |
| --- | --- |
| One item matters most | Asymmetric split, or a feature panel plus a compact list |
| Items comparable on shared axes | Table or comparison grid, not cards |
| Sequence matters | Numbered steps or a vertical timeline |
| Long homogeneous set | List with dividers; cards only if each item has media |
| Prose | Single column at a real measure |

## 11. Three features, three tiers, three steps

**Tell.** Everything comes in threes, with the middle one "most popular".
**Why.** Three is what fills a 3-column grid, not what the product has. The
layout chose the content.
**Fix.** Use the real count. Two differentiators stated well beat three padded
out; five features get a list. If the count is awkward, change the layout — do
not invent or drop content to reach three.

## 12. Copy that says nothing

**Tell.** "Seamlessly integrate with your existing workflow." "Powerful features
for modern teams." "Lightning-fast performance."
**Why.** These sentences survive any noun substitution, so they carry no
information. This is the fastest tell for a human reader.
**Fix.** Every line states something specific and falsifiable.

| Replace | With |
| --- | --- |
| "Seamlessly integrate" | What it connects to, by name |
| "Powerful analytics" | The question the analytics answer |
| "Lightning-fast" | The real measured number, or nothing |
| "Effortlessly manage" | The action removed, and from what |
| "Trusted by teams worldwide" | Named customers, or delete the section |

Never invent a metric, customer or testimonial to fill a slot. Leave a marked
placeholder and say the copy is needed.

## 13. No empty, loading or error states

**Tell.** The list renders nothing while fetching, nothing when empty, and
nothing or a thrown error on failure.
**Why.** Only the happy path was imagined, but empty and loading are the first
states a user sees.
**Fix.** Implement all four.

| State | Requirement |
| --- | --- |
| Loading | Skeleton matching the real layout's dimensions so nothing shifts |
| Empty | Explain what goes here; give the action that creates the first item |
| Error | Say what failed, whether it is retryable, and offer the retry |
| Populated | The happy path |

## 14. No `:focus-visible` styling

**Tell.** `outline: none`, or a reset that strips focus rings and never replaces
them.
**Why.** It is the standard advice for a "clean" look, and it makes the interface
unusable by keyboard. WCAG requires a focus indicator at 3:1 contrast.
**Fix.** Style focus deliberately, with `:focus-visible` so pointer users do not
see rings on click, and with an offset so the ring is not swallowed by the
element's own border.

```css
:where(a, button, input, select, textarea, summary, [tabindex]):focus-visible {
  outline: 2px solid var(--accent); outline-offset: 2px; border-radius: inherit;
}
```

## 15. Identical hover on every interactive element

**Tell.** Cards, links, buttons and table rows all lift and darken the same way.
**Why.** Hover should say what kind of thing you are about to interact with. One
treatment means the affordances were never distinguished.
**Fix.** Differentiate by affordance and keep the change small: darker fill for a
primary button, background appearing for a ghost button, underline for a link, a
faint tint for a row, a 1px border shift for a card, a background circle for an
icon button. Never gate information behind hover alone — touch has no hover, so
pair it with a persistent or focus-reachable equivalent.

## 16. Icons at inconsistent stroke widths

**Tell.** One row mixes a 1px outline icon, a 2px outline icon and a filled glyph.
**Why.** They were pasted from different sets. Mismatched stroke weight is
visible even at 16px.
**Fix.** One family, one stroke width, one nominal box. Keep icon weight in
sympathy with adjacent text weight and align to cap height, not the bounding box.
If a glyph is missing, draw it on the set's grid rather than importing a second
library.

## 17. Justified text, or no measure at all

**Tell.** `text-align: justify`, or a paragraph spanning the full viewport width.
**Why.** CSS justification has no hyphenation dictionary or optical adjustment by
default, so it opens rivers of whitespace. Over-long lines break the return
sweep.
**Fix.** Cap the measure and leave the right edge ragged.

```css
.prose {
  max-inline-size: 68ch;   /* ~45-75 characters is the readable band */
  text-align: start;
  text-wrap: pretty;       /* fixes short last lines without justifying */
}
```

---
## When you find a tell

1. Confirm it in the capture — do not fix from memory of the code.
2. Find the class or id in `simplifiedDOM`, then fix the component that produces
   it, not a global override.
3. Fix the cause once. If one radius is wrong everywhere, add the scale.
4. Re-capture at the same URL and viewport, and compare.
5. Report the tell, the correction, and what the re-capture showed.
