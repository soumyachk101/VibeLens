# Spacing and layout

Spacing is the cheapest hierarchy available and the first thing that looks
improvised when it is chosen per element. Use a scale, use it to signal grouping,
and let the content decide the layout.

## The spacing scale

Base 4px. Every gap, padding and margin is a step on this scale.

| Token | Value | Typical use |
| --- | --- | --- |
| `--space-1` | 4px | Icon-to-label, badge padding |
| `--space-2` | 8px | Inside dense controls, tight stacks |
| `--space-3` | 12px | Form field padding, list row padding |
| `--space-4` | 16px | Default gap between related elements |
| `--space-5` | 20px | Card padding, small |
| `--space-6` | 24px | Card padding, default |
| `--space-8` | 32px | Between groups inside a section |
| `--space-10` | 40px | Between subsections |
| `--space-12` | 48px | Section padding, compact |
| `--space-16` | 64px | Section padding, default |
| `--space-24` | 96px | Section padding, marketing |

```css
:root {
  --space-1: 0.25rem; --space-2: 0.5rem;  --space-3: 0.75rem; --space-4: 1rem;
  --space-5: 1.25rem; --space-6: 1.5rem;  --space-8: 2rem;    --space-10: 2.5rem;
  --space-12: 3rem;   --space-16: 4rem;   --space-24: 6rem;
}
```

Why a scale beats arbitrary values: 4px is small enough to express real
differences and large enough that adjacent steps are visibly distinct, so
misalignment of a few pixels becomes impossible. A limited set also makes
"14px here, 15px there" — the clearest sign nothing was measured — unrepresentable.

Notes:

- Use `rem` so spacing scales with the user's font size.
- Skip odd steps at the large end. Nobody can tell 40px from 44px in a section
  gap, so shipping both is noise.
- Break the scale only for optical corrections (below), and comment why.

## Spacing as proximity

Elements close together are read as one group. This is the mechanism, so use it
deliberately: **the space inside a group must be smaller than the space around
it.** The most common spacing bug is a label sitting equidistant from its own
field and the field above, which makes the form unreadable regardless of how
correct each value is.

| Relationship | Gap |
| --- | --- |
| Label to its own input | `--space-1` / `--space-2` |
| Help text to its input | `--space-1` |
| Field to next field | `--space-4` / `--space-5` |
| Field group to next group | `--space-8` |
| Section to next section | `--space-16` and up |

Reduce space to group things before you add a border or a background to group
them. A divider that only exists because the spacing was wrong is one more thing
to maintain.

## Optical vs mathematical alignment

Equal numbers do not always look equal. Fix by eye, then encode the fix.

| Situation | Mathematical result | Optical correction |
| --- | --- | --- |
| Icon beside text | Icon bounding box aligned to text box | Align to cap height; the box includes descender space text does not use |
| Circle or triangle beside a square | Same width | Make the round or pointed shape slightly larger so it reads the same size |
| Text inside a pill | Equal left/right padding | Add 1–2px more on the side facing a round cap |
| Button with a trailing chevron | Equal padding both sides | Reduce the trailing padding; the chevron's whitespace already reads as space |
| Left-aligned quote or bullet | Text edge flush | Hang the punctuation or marker into the margin so the text edge stays straight |
| Multi-line heading | Default `line-height` box | Trim leading above the first line so the cap sits on the intended baseline |

Also watch the extra spacing that comes free and then has to be removed: a
heading's default margin plus a container's padding, or a `line-height` box adding
space above the first line of a card title.

## Container width and measure

Container width and text measure are separate constraints. A wide container is
fine; a wide paragraph is not.

```css
.container { max-inline-size: 72rem; margin-inline: auto;
             padding-inline: max(var(--space-4), env(safe-area-inset-left)); }
.prose     { max-inline-size: 68ch; }         /* measure, not layout */
.sidebar   { inline-size: min(20rem, 100%); } /* never wider than its parent */
```

| Container | Width |
| --- | --- |
| Prose, article body | 60–75ch |
| Marketing section | 64–80rem |
| App shell | Full width, with internal max-widths per region |
| Dialog | `min(32rem, calc(100vw - 2 * var(--space-4)))` |
| Form column | 24–32rem — wide inputs invite wrong input |

Use logical properties (`max-inline-size`, `padding-inline`, `margin-block`) so
the layout works in right-to-left writing modes without a second stylesheet.

## Grid or flex

| Use | Because |
| --- | --- |
| **Flex** for a row or column of items whose sizes come from their content | Toolbars, button rows, chips, nav, badge groups |
| **Flex** when items should wrap freely with no column alignment | Tag lists |
| **Grid** when items must align across both axes | Card grids, forms, dashboards, tables of layout |
| **Grid** for the page shell | Named areas beat nested wrappers |
| **Grid** for overlaying items in one cell | `grid-area: 1/1` avoids absolute positioning |

The short rule: if you need alignment in one direction, use flex; if you need it
in two, use grid. Reach for `grid-template-areas` when the shell would otherwise
need wrapper divs that exist only for layout.

```css
/* Responsive without breakpoints: as many columns as fit, min 16rem each. */
.auto-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(16rem, 100%), 1fr));
  gap: var(--space-6);
}

/* Page shell. */
.shell {
  display: grid;
  grid-template: "header header" auto
                 "nav    main"   1fr
                 "footer footer" auto / 16rem 1fr;
  min-block-size: 100dvh;
}
```

`min(16rem, 100%)` inside `minmax()` matters: a bare `16rem` minimum overflows a
viewport narrower than 16rem.

## Container queries

A component's layout should respond to the space it has, not to the viewport. The
same card in a sidebar and in a main column needs different internal layout at the
same viewport width, which media queries cannot express.

```css
.card-host { container-type: inline-size; container-name: card; }

/* Applies when the container is wide, wherever the container happens to be. */
@container card (inline-size > 28rem) {
  .card { grid-template-columns: 12rem 1fr; gap: var(--space-6); }
}
```

Use `container-type: inline-size` (not `size`) for normal flow content —
`size` requires the block dimension to be constrained too. Keep media queries for
genuinely viewport-level decisions: page shell, navigation pattern, safe areas.
Container query units (`cqi`, `cqw`) are available for sizing relative to the
container.

## Modern layout primitives

| Primitive | Use | Example |
| --- | --- | --- |
| `gap` | Spacing between flex/grid children | `gap: var(--space-4)` — replaces child margins and the last-child reset |
| `min()` / `max()` | A bound without a breakpoint | `inline-size: min(65ch, 100%)` |
| `clamp()` | Fluid value with hard limits | `padding-block: clamp(3rem, 8vw, 6rem)` |
| `aspect-ratio` | Reserve space before media loads | `aspect-ratio: 16/9` — prevents layout shift |
| `dvh` / `svh` | Viewport height that accounts for mobile browser chrome | `min-block-size: 100dvh` |
| `:has()` | Parent styling from a child's state | `.field:has(:invalid) { --border: var(--danger); }` |

Always pair `aspect-ratio` on media with intrinsic `width` and `height`
attributes on the element, so space is reserved before CSS applies.

## Density hierarchy

One padding value everywhere means nothing signals importance. Decide a density
per region and keep it internally consistent.

| Density | Padding | Row height | Where |
| --- | --- | --- | --- |
| Compact | `--space-1` / `--space-2` | 28–32px | Toolbars, menus, data tables, sidebars |
| Default | `--space-3` / `--space-4` | 36–44px | Forms, list rows, most controls |
| Comfortable | `--space-6` | — | Cards, panels, dialogs |
| Spacious | `--space-12`+ | — | Hero, empty states, marketing sections |

Two constraints on going compact: any touch target stays at least 24×24 CSS
pixels with adequate spacing (WCAG 2.2 Target Size (Minimum), 2.5.8), and 44×44
is the comfortable figure for primary touch controls. Compact density is for
pointer-dense surfaces, so raise the density on small viewports.

## Z-index as a named scale

Magic z-index numbers escalate: someone writes `9999`, the next person writes
`10000`. Name the layers once and forbid raw numbers.

```css
:root {
  --z-base: 0;
  --z-raised: 10;      /* sticky table header, hovered row */
  --z-dropdown: 100;
  --z-sticky: 200;     /* sticky page header */
  --z-overlay: 300;    /* modal scrim */
  --z-modal: 400;
  --z-popover: 500;    /* must sit above a modal's own content */
  --z-toast: 600;
  --z-tooltip: 700;
}
```

Two things that remove most z-index problems entirely:

- **Fewer stacking contexts.** `transform`, `filter`, `opacity` below 1,
  `will-change` and `isolation: isolate` each create one, and a child cannot
  escape its parent's context no matter how high its z-index. When something
  "won't go on top", look for the ancestor that created a context.
- **Top-layer elements.** `<dialog>` opened with `showModal()` and popovers using
  the Popover API render in the browser's top layer, above all z-index. Use them
  for modals and menus and the stacking question disappears — along with focus
  trapping and dismissal, which they handle.

## Review checklist

- Every spacing value is a scale token; no arbitrary pixel values.
- Inside-group space is smaller than around-group space, everywhere.
- Prose has a measure; the container width and the measure are separate values.
- Grid where two-axis alignment is needed, flex where one axis is.
- Component-level responsiveness uses container queries, not viewport queries.
- Media has `aspect-ratio` plus intrinsic dimensions, so nothing shifts on load.
- Distinct densities exist; touch targets meet 24×24 minimum.
- No raw z-index numbers.
