# Colour

Do not pick colours one at a time. Choose one accent hue, derive everything else
from it, name the results by role, and check the contrast. A palette built this
way is coherent by construction and themeable without touching components.

## The order of decisions

| Step | Decision | Output |
| --- | --- | --- |
| 1 | One accent hue | A hue angle |
| 2 | A lightness ramp for that hue | `--blue-50` … `--blue-900` primitives |
| 3 | A neutral ramp tinted toward the accent | `--gray-*` primitives |
| 4 | Status hues: success, warning, danger | Three more ramps, usually short |
| 5 | Semantic names mapped onto primitives | `--surface`, `--text`, `--border`, … |
| 6 | A second mapping for dark mode | Same semantic names, different primitives |
| 7 | Contrast verification of every text-on-surface pair | Pass or fail |

Components only ever read step 5 names. That is what makes step 6 possible.

## Why OKLCH, not HSL

HSL's lightness is not perceptual. `hsl(60 100% 50%)` (yellow) and
`hsl(240 100% 50%)` (blue) claim the same 50% lightness but differ enormously in
perceived brightness, so an HSL ramp stepped evenly in `L` produces uneven steps
and hue shifts. OKLCH is designed so equal `L` steps look equally spaced and so
`L` is comparable across hues.

```css
/* oklch(lightness chroma hue) - L is 0-1 (or a percentage), C is
   chroma (0 = grey), H is the hue angle in degrees. */
--blue-500: oklch(0.58 0.15 258);
```

Practical consequences:

- Build a ramp by walking `L` in even steps and holding `H`.
- Reduce `C` at both ends. Very light and very dark colours cannot carry high
  chroma without looking artificial, and out-of-gamut values get clipped.
- Two hues at the same `L` are genuinely comparable, so a hue swap does not break
  a contrast check the way it does in HSL.
- `oklch()` also reaches colours outside sRGB on wide-gamut displays. If you must
  support engines without `oklch()`, provide an sRGB fallback declaration first
  and let the later `oklch()` declaration win where supported.

## Primitive ramps

```css
:root {
  /* Accent: one hue (258), even lightness steps, chroma easing off at the ends. */
  --blue-50:  oklch(0.97 0.02 258);
  --blue-100: oklch(0.93 0.04 258);
  --blue-200: oklch(0.87 0.07 258);
  --blue-300: oklch(0.78 0.11 258);
  --blue-400: oklch(0.68 0.14 258);
  --blue-500: oklch(0.58 0.15 258);
  --blue-600: oklch(0.50 0.15 258);
  --blue-700: oklch(0.42 0.13 258);
  --blue-800: oklch(0.33 0.10 258);
  --blue-900: oklch(0.24 0.07 258);

  /* Neutrals: same hue, tiny chroma. Not pure grey - see below. */
  --gray-50:  oklch(0.985 0.003 258);
  --gray-100: oklch(0.96  0.005 258);
  --gray-200: oklch(0.92  0.006 258);
  --gray-300: oklch(0.86  0.007 258);
  --gray-400: oklch(0.71  0.008 258);
  --gray-500: oklch(0.58  0.009 258);
  --gray-600: oklch(0.47  0.010 258);
  --gray-700: oklch(0.37  0.011 258);
  --gray-800: oklch(0.27  0.012 258);
  --gray-900: oklch(0.18  0.012 258);
}
```

Neutrals are tinted, not `oklch(L 0 0)`. Pure grey next to a saturated accent
looks dead, and a shared hue makes the neutrals feel like they belong to the same
palette. Keep chroma very low — enough to feel warm or cool, not enough to read
as a colour. Warm the neutrals (a hue near 60–90) for editorial and consumer
work, cool them (200–280) for tools and dashboards.

Derive related shades in place rather than inventing values:

```css
.btn { background: var(--accent); }
.btn:hover  { background: color-mix(in oklch, var(--accent), black 10%); }
.btn:active { background: color-mix(in oklch, var(--accent), black 18%); }
```

## Semantic tokens

Primitives say what a colour *is*. Semantic tokens say what it is *for*. A
component that reads `--blue-600` is stuck with blue; one that reads `--accent`
is themeable.

| Token | Role |
| --- | --- |
| `--surface` | Page background |
| `--surface-elevated` | Cards, panels, popovers — a step off the page |
| `--surface-sunken` | Wells, inset areas, code blocks |
| `--border` | Default dividers and control outlines |
| `--border-strong` | Emphasised separation, focused input border |
| `--text` | Primary body text |
| `--text-muted` | Secondary text, help text, timestamps |
| `--text-subtle` | Tertiary; must still pass 4.5:1 if it is real content |
| `--accent` | Primary action, active state, links |
| `--accent-fg` | Text or icon placed on `--accent` |
| `--accent-subtle` | Tinted background for selected or active rows |
| `--success` / `--warning` / `--danger` | Status, each with a `-fg` and `-subtle` pair |

```css
:root {
  --surface:          var(--gray-50);
  --surface-elevated: #fff;              /* the one place near-white is fine: small elevated surfaces */
  --surface-sunken:   var(--gray-100);
  --border:           var(--gray-200);
  --border-strong:    var(--gray-300);
  --text:             var(--gray-900);
  --text-muted:       var(--gray-600);
  --accent:           var(--blue-600);
  --accent-fg:        var(--gray-50);
  --accent-subtle:    var(--blue-50);
  --danger:           oklch(0.55 0.18 25);
  --danger-subtle:    oklch(0.96 0.03 25);
}
```

Keep the set small. If a component needs a colour that no semantic token
provides, either the token set is missing a role or the component is decorating.

## Contrast

WCAG 2.2 AA thresholds, measured as a contrast ratio against the actual
background the element renders on:

| Content | Minimum |
| --- | --- |
| Body text and images of text | 4.5:1 |
| Large text — 24px regular, or 18.66px bold and above | 3:1 |
| UI component boundaries, icons conveying meaning, focus indicators | 3:1 |
| Disabled controls, purely decorative graphics | No requirement |

AAA raises body text to 7:1 and large text to 4.5:1. Meet AA as the floor.

How to check, in order of reliability:

1. Browser DevTools shows the computed ratio in the colour picker for any text
   node, and flags AA/AAA pass or fail.
2. The accessibility audit in DevTools (or an axe-based tool) catches pairs you
   did not think to inspect.
3. Compute it if you need a number in code — the ratio is defined on relative
   luminance, so convert to sRGB first. Do not eyeball it and do not assume
   `--text-muted` passes because it looked fine.

Contrast is a property of a *pair*. `--text-muted` on `--surface` may pass while
the same token on `--surface-sunken` fails. Check every combination that ships,
including text on `--accent`, placeholder text, and hover backgrounds.

Never use colour as the only carrier of meaning. A red border needs an icon or a
message beside it; a green dot needs a label. Users with colour-vision
deficiencies and users reading a greyscale screenshot get nothing from hue alone.

## Dark mode

Dark mode is a second mapping of the same semantic names, not an inversion. An
inverted palette gets the elevation wrong: in light mode elevated surfaces get
lighter, and in dark mode they also get lighter, so flipping the ramp pushes
cards *away* from the viewer.

```css
:root { color-scheme: light; /* light tokens as above */ }

@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;                    /* themes scrollbars and form controls */
    --surface:          var(--gray-900);
    --surface-elevated: var(--gray-800);   /* lighter than the page, same as light mode's direction */
    --surface-sunken:   oklch(0.14 0.012 258);
    --border:           var(--gray-700);
    --text:             var(--gray-100);
    --text-muted:       var(--gray-400);
    --accent:           var(--blue-400);   /* lighter step: 600 fails on a dark surface */
    --accent-fg:        var(--gray-900);
  }
}
```

Four things change beyond the swap:

| Concern | Adjustment |
| --- | --- |
| Accent lightness | Move up the ramp; a mid-dark accent loses contrast on dark surfaces |
| Chroma | Reduce it slightly; saturated colour vibrates against dark backgrounds |
| Elevation | Signal it with a lighter surface, not a bigger shadow — shadows barely read on dark |
| Images | Consider a small `filter: brightness(.9)` on bright photography, not on UI |

Set `color-scheme` so native scrollbars, form controls and the canvas background
follow the theme. If you offer a manual toggle, drive it with a `data-theme`
attribute and keep the media query as the default so the system preference is
respected before the user chooses.

## Why not pure black and pure white

| Value | Problem |
| --- | --- |
| `#000` background | Maximum contrast with light text causes halation; no room for a darker recessed surface |
| `#fff` text on black | Same halation from the other side; tiring for sustained reading |
| `#000` text on `#fff` | Harsh at long measures; a near-black at high contrast reads better |
| `#000` shadows | Read as grey holes rather than as light being blocked |

Stay inside the extremes: dark surfaces around `oklch(0.18 ...)`, light text
around `oklch(0.96 ...)`, and tint both toward the palette hue. Keep `#fff`
available for small elevated surfaces in light mode where it functions as the
top of the elevation ramp.

## State colour vs decorative colour

| Purpose | Rule |
| --- | --- |
| State (selected, error, disabled, active) | Must be consistent everywhere and paired with a non-colour cue |
| Status (success, warning, danger, info) | Fixed hues, used only for status — never as decoration |
| Accent | The primary action and navigation state; one per view |
| Data visualisation | Its own categorical scale, contrast-checked against the plot background |
| Decoration | Neutrals and low-chroma accent tints. Not the status hues |

The common failure is spending the status hues on decoration: a green gradient in
a hero, a red icon that means nothing. Once red appears decoratively, a real error
no longer registers. Keep the status hues scarce so they still carry weight.

## Review checklist

- One accent hue, derived into a ramp, not a stock palette import.
- Neutrals carry a slight tint from the accent hue.
- Components reference semantic tokens only; no primitive or hex in a component.
- Every shipped text-on-surface pair verified at 4.5:1, or 3:1 for large text and
  UI boundaries.
- Dark mode is a token remap with a lighter accent step, plus `color-scheme`.
- No `#000` surfaces and no `#fff` body text.
- Status hues appear only for status.
