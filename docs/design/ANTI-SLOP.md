# Anti-slop: the tells of machine-generated UI

Generated UI is rarely broken. It is recognisable — the same defaults, the same
symmetry, the same absence of hierarchy. This file names each tell, explains why
it reads as generated, and gives the correction.

Use it two ways: as a checklist when reviewing a capture, and as a set of
constraints before writing a component.

## Fast review pass

Run these against a screenshot before reading any code. Each one that fires is a
defect with a fix below.

| # | Check | Fires when |
| --- | --- | --- |
| 1 | Accent colour | Untouched `blue-500` / `indigo-600` framework default |
| 2 | Radius | One radius on every element regardless of size |
| 3 | Padding | Same padding everywhere; no dense and no spacious regions |
| 4 | Alignment | Everything centred, including body copy and forms |
| 5 | Gradient text | Gradient on headings as decoration |
| 6 | Icons | Emoji used as iconography |
| 7 | Elevation | A shadow on every surface |
| 8 | Type scale | One body size; headings barely larger |
| 9 | Extremes | `#000` background or `#fff` text |
| 10 | Layout | Every section is a card grid |
| 11 | Feature count | Exactly three features, three tiers, three steps |
| 12 | Copy | "Seamlessly integrate", "Powerful", "Effortlessly" |
| 13 | States | No loading, empty or error rendering |
| 14 | Focus | No visible keyboard focus, or `outline: none` |
| 15 | Hover | Identical hover treatment on every interactive element |
| 16 | Icon weight | Mixed stroke widths in one icon row |
| 17 | Measure | `text-align: justify`, or line length past ~75 characters |

---

## 1. The untouched framework accent

**Tell.** Every accent is Tailwind `blue-500`/`blue-600` or `indigo-600`, or
Bootstrap `#0d6efd`. Links, primary buttons, focus rings, active tabs, icon
tints — all one stock hue.

**Why it reads as generated.** It is the value that appears when nobody chose. A
designed product picks a hue for a reason (brand, category convention,
differentiation from competitors) and derives everything from it.

**Fix.** Choose one accent, off the default hue, and derive a ramp from it. Use
the accent sparingly — it should mark the single most important action in a view,
not decorate every clickable thing. See [COLOR.md](./COLOR.md).

```css
:root {
  /* One decision, then derived. Not a stock palette import. */
  --accent: oklch(0.58 0.15 258);
  --accent-hover: oklch(0.52 0.15 258);
  --accent-subtle: oklch(0.96 0.03 258);
}
```

## 2. One border-radius on everything

**Tell.** `rounded-lg` on the page container, the card, the button, the input,
the avatar and the 16px badge.

**Why it reads as generated.** Radius is a function of element size. A large
radius on a small element eats its interior; a small radius on a large panel
looks unrelated to the small ones. Applying one value means the relationship was
never considered.

**Fix.** A radius scale, assigned by element size, plus nesting-aware radii.

| Element | Radius |
| --- | --- |
| Badge, tag, small chip | 4px, or fully round for pills |
| Input, button | 6–8px |
| Card, panel | 10–14px |
| Modal, sheet, page container | 16–20px |
| Avatar, status dot | `50%` |

For a nested element, inner radius = outer radius − padding. Concentric corners
otherwise look wrong even when both values are "from the scale".

## 3. Uniform padding, no density hierarchy

**Tell.** `p-4` or `p-6` on every container. Section padding equals card padding
equals button padding.

**Why it reads as generated.** Real interfaces have dense regions (tables,
toolbars, sidebars, dropdowns) and spacious ones (hero, empty states, marketing
sections). One padding value flattens that, so nothing signals importance.

**Fix.** Pick a density per region and apply the scale accordingly.

| Region | Padding band |
| --- | --- |
| Toolbar, menu item, table cell | 4–8px |
| Form field, list row | 8–12px |
| Card, panel | 16–24px |
| Page section | 48–96px block |

See [SPACING-LAYOUT.md](./SPACING-LAYOUT.md) for the scale itself.

## 4. Everything centred

**Tell.** Every heading, paragraph, form and empty state is `text-align: center`
with `mx-auto`.

**Why it reads as generated.** Centring is the safe default when no reading order
was designed. Centred multi-line text has a ragged left edge, so the eye has to
re-find the start of every line.

**Fix.** Centre only short, self-contained text: a hero headline of one or two
lines, an empty-state message, a single-column dialog. Left-align (or align to
the block's writing direction) everything else — body paragraphs, form labels,
lists, card content, table data. Ask what the eye should scan down; give it a
straight edge to scan down.

## 5. Gradient text as decoration

**Tell.** `bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text
text-transparent` on the hero heading.

**Why it reads as generated.** It is applied because it is available, not because
it communicates anything. It also lowers legibility: contrast varies along the
run, so part of the text usually fails 4.5:1, and `text-transparent` degrades
badly if the background paint fails to apply.

**Fix.** Make headings a solid colour with real contrast. If you need visual
interest, get it from type — weight, size, tighter tracking, a strong measure —
or from a background treatment behind opaque text. If a gradient is genuinely
part of the brand, apply it to one word, verify contrast at both ends, and keep
a solid fallback colour on the element.

## 6. Emoji as iconography

**Tell.** Feature lists led by rocket, sparkle, lock, chart emoji.

**Why it reads as generated.** Emoji render differently per platform and font, do
not inherit `currentColor` or stroke weight, cannot be sized optically, and are
announced literally by screen readers. They read as a placeholder for an icon set
nobody installed.

**Fix.** Use one icon library at one stroke width, sized against the text it
accompanies, inheriting `currentColor`. Mark decorative icons
`aria-hidden="true"`; give meaningful ones an accessible label.

```css
.icon {
  inline-size: 1em;      /* scales with the text it sits beside */
  block-size: 1em;
  stroke-width: 1.5;
  color: currentColor;
}
```

## 7. Drop shadows on every surface

**Tell.** `shadow-md` on cards, inputs, buttons, nav, sections, and the page
wrapper.

**Why it reads as generated.** Shadow encodes elevation. If everything is
elevated, nothing is, and the page reads as noisy. Default shadows are also
usually too dark and too diffuse to look like real light.

**Fix.** Reserve elevation for things that genuinely float over other content:
dropdowns, popovers, modals, toasts, sticky bars. Use a border or a background
step for resting surfaces. Layer two soft shadows rather than one heavy one, and
tint the shadow toward the surface hue instead of pure black.

```css
:root {
  --elev-0: none;                                            /* resting: use a border */
  --elev-1: 0 1px 2px oklch(0.2 0.02 258 / 0.06),
            0 1px 3px oklch(0.2 0.02 258 / 0.10);            /* popover */
  --elev-2: 0 4px 8px oklch(0.2 0.02 258 / 0.08),
            0 12px 24px oklch(0.2 0.02 258 / 0.12);          /* modal */
}
```

## 8. 16px body text and no type scale

**Tell.** Body at 16px, `h2` at 18–20px, `h1` at 24px. Everything within a few
pixels of everything else.

**Why it reads as generated.** Hierarchy needs distinguishable steps. Sizes a
couple of pixels apart look like a mistake rather than a level.

**Fix.** Generate sizes from a ratio and use non-adjacent steps for adjacent
levels. Body 16–18px, section headings clearly larger, display sizes larger
still, with tighter line-height and tracking as size grows. See
[TYPOGRAPHY.md](./TYPOGRAPHY.md).

## 9. Pure black and pure white

**Tell.** `background: #000`, `color: #fff`, `border: 1px solid #000`.

**Why it reads as generated.** Maximum contrast at both ends produces halation
on emissive screens — white text on pure black appears to bleed, which makes
long reading tiring. It also leaves no headroom: you cannot go darker than
`#000` for a recessed surface or lighter than `#fff` for an elevated one.

**Fix.** Pull both ends in and tint them. Dark backgrounds around
`oklch(0.18 0.01 258)`, light text around `oklch(0.96 0.005 258)`. Keep the true
extremes unused so elevation and recession remain expressible.

## 10. Cards in a grid as the answer to every layout

**Tell.** Every section is a 3-column grid of equal cards with an icon, a bold
line and two lines of text.

**Why it reads as generated.** A card grid is the lowest-information layout: it
says all items are equally important, which is almost never true. Repeating it
down a page removes any sense of narrative.

**Fix.** Choose the layout from the content's shape.

| Content | Layout |
| --- | --- |
| One item matters most | Asymmetric split, or one feature panel plus a compact list |
| Items are comparable on the same axes | Table or comparison grid, not cards |
| Sequence matters | Numbered steps, vertical timeline |
| Long homogeneous set | List with dividers; cards only when each item needs media |
| Prose | Single column at a real measure |

## 11. Three-feature, three-tier, three-step sections

**Tell.** Everything comes in threes, with the middle one "most popular".

**Why it reads as generated.** Three is what fills a 3-column grid, not what the
product has. It shows the layout chose the content.

**Fix.** Use the real count. Two differentiators stated well beat three padded
out. Five features get a list, not a grid. If the count is awkward, change the
layout — asymmetric spans, a lead item with a supporting list — rather than
inventing or dropping content to reach three.

## 12. Copy that says nothing

**Tell.** "Seamlessly integrate with your existing workflow." "Powerful features
for modern teams." "Effortlessly scale." "Lightning-fast performance."

**Why it reads as generated.** These sentences survive any noun substitution, so
they carry no information. They are the prose equivalent of `lorem ipsum` and are
the single fastest tell for a human reader.

**Fix.** Every line states something specific and falsifiable.

| Replace | With |
| --- | --- |
| "Seamlessly integrate" | What it connects to, by name |
| "Powerful analytics" | What question the analytics answer |
| "Lightning-fast" | The real measured number, or nothing |
| "Effortlessly manage" | The action removed, and from what |
| "Trusted by teams worldwide" | Named customers, or delete the section |

Never invent a metric, a customer name or a testimonial to fill a slot. Leave a
clearly marked placeholder and say the copy is needed.

## 13. No empty, loading or error states

**Tell.** The component renders a list. With no data it renders nothing; while
fetching it renders nothing; on failure it renders nothing or throws.

**Why it reads as generated.** Only the happy path was imagined. In use, empty
and loading are the first states a user sees.

**Fix.** Implement all four.

| State | Requirement |
| --- | --- |
| Loading | Skeleton matching the real layout's dimensions so nothing shifts on arrival |
| Empty | Explain what goes here and give the action that creates the first item |
| Error | Say what failed, whether it is retryable, and provide the retry |
| Populated | The happy path |

## 14. No `:focus-visible` styling

**Tell.** `outline: none`, or a reset that removes focus rings and never replaces
them. Keyboard tabbing shows nothing.

**Why it reads as generated.** Removing the ring is the standard advice for
making a page "look clean". It makes the interface unusable by keyboard and
fails WCAG 2.2 focus-appearance expectations.

**Fix.** Style focus deliberately. Use `:focus-visible` so pointer users do not
see rings on click, keep the indicator at 3:1 contrast against adjacent colours,
and give it an offset so it is not swallowed by the element's own border.

```css
:where(a, button, input, select, textarea, summary, [tabindex]):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: inherit;
}
```

## 15. Identical hover on every interactive element

**Tell.** Cards, links, buttons, table rows and icon buttons all lift and darken
the same way.

**Why it reads as generated.** Hover should tell you what kind of thing you are
about to interact with. One treatment means the affordances were never
distinguished — and it usually means a whole card is clickable while the link
inside it is not.

**Fix.** Differentiate by affordance, and keep hover changes small.

| Element | Hover |
| --- | --- |
| Primary button | One step darker fill |
| Secondary/ghost button | Background appears from transparent |
| Text link | Underline appears or thickens |
| List/table row | Faint background tint only |
| Card | Border darkens slightly; move at most 1px, or not at all |
| Icon button | Background circle appears |

Never gate information behind hover alone: touch devices have no hover, so pair
any hover-revealed control with a persistent or focus-reachable equivalent.

## 16. Icons at inconsistent stroke widths

**Tell.** One row mixes a 1px outline icon, a 2px outline icon and a filled
glyph, at three optical sizes.

**Why it reads as generated.** Icons were pasted from different sets. Mismatched
stroke weight is visible even at 16px and makes the row look assembled rather
than designed.

**Fix.** One family, one stroke width, one nominal box. Keep icon weight in
sympathy with adjacent text weight, and align icons to the text's cap height
rather than its bounding box. If a needed icon is missing from the set, draw it
on the set's grid — do not import a second library for one glyph.

## 17. Justified text, or no measure at all

**Tell.** `text-align: justify`, or a paragraph spanning the full 1920px viewport.

**Why it reads as generated.** CSS justification has no hyphenation dictionary or
optical adjustment by default, so it opens rivers of whitespace between words.
Over-long lines make the eye lose the return sweep.

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

1. Confirm it in the capture. Do not fix from memory of the code.
2. Find the source of the class or id in `simplifiedDOM`, then fix the component
   that produces it — not a global override.
3. Fix the cause once. If one radius is wrong everywhere, add the scale; do not
   patch each call site.
4. Re-capture at the same URL and viewport and compare.
5. Report the tell, the correction and what the re-capture showed.
