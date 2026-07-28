# Typography

Type carries most of the hierarchy in an interface. Get the scale, the measure
and the loading right and a page reads as designed even with a plain font.

## The scale

Pick one ratio and generate every size from it. A modular scale beats arbitrary
sizes for two reasons: adjacent steps are guaranteed to be visibly different, and
the relationship between a heading and its body is the same everywhere, so the
page has one rhythm instead of a per-component decision.

| Ratio | Name | Character |
| --- | --- | --- |
| 1.125 | Major second | Very tight; dense dashboards only |
| 1.200 | Minor third | Calm, information-dense product UI |
| 1.250 | Major third | The reliable default for app and marketing UI |
| 1.333 | Perfect fourth | Editorial, strong display contrast |
| 1.500 | Perfect fifth | Loud; large jumps, few levels |

A ratio of 1.25 from a 16px base:

```css
:root {
  --text-xs:   0.64rem;  /* 10.24px - legal, dense table meta */
  --text-sm:   0.8rem;   /* 12.8px  - captions, labels */
  --text-base: 1rem;     /* 16px    - body */
  --text-lg:   1.25rem;  /* 20px    - lead paragraph, card title */
  --text-xl:   1.563rem; /* 25px    - h3 */
  --text-2xl:  1.953rem; /* 31.25px - h2 */
  --text-3xl:  2.441rem; /* 39px    - h1 */
  --text-4xl:  3.052rem; /* 48.8px  - display */
}
```

Rules for using it:

- Use `rem` for type so a user's browser font-size setting is honoured. Never set
  a `px` font-size on `html`.
- Skip steps between adjacent hierarchy levels. `h2` at `--text-2xl` above body
  at `--text-base` reads as a level; one step apart reads as an accident.
- Body copy sits at 16–18px. Below 16px is uncomfortable for sustained reading on
  a phone.
- Four to six sizes on a page is plenty. A seventh size usually means a weight or
  colour change was the real intent.

For display sizes that must respond to viewport, interpolate with `clamp()`
rather than adding breakpoint overrides:

```css
h1 { font-size: clamp(2rem, 1.5rem + 2.5vw, 3.052rem); }
```

Include a `rem` term in the middle argument so the value still scales when the
user changes their browser font size — a pure `vw` middle argument breaks zoom.

## Line-height and measure

Line-height is a function of size and measure, not one number. Large text needs
proportionally less leading; long lines need more, because the eye needs help
finding the next line's start.

| Context | Size | `line-height` |
| --- | --- | --- |
| Display heading | 40px+ | 1.0–1.1 |
| Section heading | 24–39px | 1.15–1.25 |
| Card title, lead | 20–24px | 1.3–1.4 |
| Body copy | 16–18px | 1.5–1.65 |
| Dense UI, table cell | 12–14px | 1.35–1.45 |

Set it unitless so it scales with inherited font-size. Measure — the line length
— belongs in `ch`, which is relative to the font's `0` width and therefore tracks
the actual character count.

```css
body    { line-height: 1.55; }
.prose  { max-inline-size: 68ch; }   /* ~45-75 characters reads comfortably */
h1, h2  { line-height: 1.15; text-wrap: balance; }
.caption{ max-inline-size: 45ch; }
```

45–75 characters is the readable band for body copy. Narrower forces too many
return sweeps; wider loses the line. `ch` is an approximation of character count
rather than an exact one, so verify in a capture.

## Letter-spacing

| Case | Tracking |
| --- | --- |
| Display and large headings | Tighten: `-0.02em` to `-0.03em` |
| Section headings | Slight tighten: `-0.01em` |
| Body copy | None. Leave the font's designed spacing alone |
| All-caps labels, eyebrows | Open up: `0.04em` to `0.1em` |
| Tabular numerals in a column | None; use `tabular-nums` instead |

Two hard rules. Never letterspace lowercase running text — the designer already
spaced the pairs, and adding tracking breaks the word shapes readers recognise.
Always letterspace all-caps, because uppercase glyphs were spaced for use inside
lowercase words and look cramped in a run of capitals.

```css
.display { letter-spacing: -0.025em; }
.eyebrow { text-transform: uppercase; letter-spacing: 0.08em; font-size: var(--text-sm); }
```

## Pairing

| Strategy | When | Risk |
| --- | --- | --- |
| One family, multiple weights | Default choice. Almost always sufficient | None; this is the safe option |
| One family plus a mono | Any product with code, IDs, or numeric data | None |
| Display family plus text family | Editorial or marketing with a real display need | Mismatched proportions and x-height |
| Two text families | Rarely justified | Reads as indecision |

The safest option is one well-made family used across a weight range. Hierarchy
comes from size, weight, colour and space — not from a second typeface. If you do
pair, contrast the families clearly (a geometric display against a neutral text
face) rather than slightly; two similar sans faces look like a mistake.

Reserve weights: 400 for body, 500–600 for emphasis and UI labels, 700+ for
headings. Do not use weights below 400 for body text — thin weights lose stroke
contrast against the background and hurt contrast perception.

## Variable fonts

A variable font ships one file covering a weight range, so using 400, 500, 600
and 700 costs one download instead of four. Declare the range in
`font-weight` inside `@font-face`:

```css
@font-face {
  font-family: "Inter var";
  src: url("/fonts/inter-var.woff2") format("woff2-variations");
  font-weight: 100 900;          /* the axis range this file covers */
  font-style: normal;
  font-display: swap;
  unicode-range: U+0000-00FF;    /* subset: latin basic + supplement */
}
```

Do not synthesise weights the file does not have — the browser will fake bold by
smearing outlines. If an axis exists, use `font-variation-settings` only for axes
with no high-level property (optical size `opsz`, grade `GRAD`); use
`font-weight` and `font-stretch` for the ones that do.

## Loading without layout shift

Fonts cause two visible problems: invisible text while loading, and reflow when
the real font replaces the fallback. Address both.

| Mechanism | What it does | Use it for |
| --- | --- | --- |
| `font-display: swap` | Renders the fallback immediately, swaps in the webfont when ready | Body and heading text |
| `font-display: optional` | Uses the webfont only if it is nearly instant; no swap | Nice-to-have faces where shift is worse than the wrong font |
| `<link rel="preload">` | Starts the font request without waiting for CSS parse | The one or two fonts above the fold |
| `unicode-range` subsetting | Ships only the glyphs needed | Every self-hosted font |
| `size-adjust`, `ascent-override` | Scales the fallback to match the webfont's metrics | Killing the reflow that `swap` causes |

```html
<!-- Preload only what renders above the fold; more preloads compete for bandwidth. -->
<link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>
```

```css
/* Metric-compatible fallback: the local font is scaled so line boxes match,
   so the swap changes glyph shapes without moving anything. */
@font-face {
  font-family: "Inter fallback";
  src: local("Arial");
  size-adjust: 107%;
  ascent-override: 90%;
  descent-override: 22%;
  line-gap-override: 0%;
}
body { font-family: "Inter var", "Inter fallback", sans-serif; }
```

Serve `woff2` only — every browser that matters supports it, and additional
formats just add bytes. Always set `crossorigin` on a font preload; without it
the browser makes a second, non-anonymous request.

## The system font stack

The fastest font is the one already installed. Use this when the brand does not
require a specific face:

```css
:root {
  --font-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue",
               Arial, "Noto Sans", sans-serif, "Apple Color Emoji",
               "Segoe UI Emoji";
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas,
               "Liberation Mono", monospace;
  --font-serif: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
}
```

`system-ui` resolves to the platform UI face. Keep the explicit fallbacks after
it: `system-ui` has historically resolved badly on some Linux configurations, and
the emoji families at the end stop emoji from falling back to a serif face.

## OpenType features

| Feature | Property | Use for |
| --- | --- | --- |
| Tabular figures | `font-variant-numeric: tabular-nums` | Any column of numbers, timers, prices |
| Slashed zero | `font-variant-numeric: slashed-zero` | IDs, hashes, codes, monospace data |
| Proportional figures | `font-variant-numeric: proportional-nums` | Numbers inside running prose |
| Fractions | `font-variant-numeric: diagonal-fractions` | Recipes, measurements |
| Small caps | `font-variant-caps: all-small-caps` | Abbreviations in prose |
| Ligature control | `font-variant-ligatures: none` | Code, where `fi`/`fl` ligatures mislead |

```css
/* Without tabular-nums, digits have different widths and a column jitters
   whenever a value changes. */
td.numeric, .metric { font-variant-numeric: tabular-nums; }
code, .id           { font-variant-numeric: slashed-zero; font-variant-ligatures: none; }
```

## Wrapping and hyphenation

| Property | Effect | Apply to |
| --- | --- | --- |
| `text-wrap: balance` | Evens line lengths across a short block | Headings, blockquotes, card titles — short blocks only |
| `text-wrap: pretty` | Avoids orphans and bad rags over a longer block | Body paragraphs |
| `hyphens: auto` | Hyphenates using the language dictionary | Narrow columns; needs `lang` on the element |
| `overflow-wrap: anywhere` | Breaks unbreakable strings | URLs, tokens, user-supplied identifiers |
| `text-wrap: nowrap` | Prevents any wrap | Labels, badges, buttons that must stay one line |

```css
h1, h2, h3, blockquote { text-wrap: balance; }   /* short blocks only */
p, li                  { text-wrap: pretty; }
.narrow-column         { hyphens: auto; }        /* requires lang="..." */
.token                 { overflow-wrap: anywhere; }
```

`text-wrap: balance` applies only up to a limited number of lines, so it is for
headings, not paragraphs. Hyphenation needs a correct `lang` attribute to pick
the right dictionary; without it nothing happens. Both properties degrade
silently where unsupported, so no fallback is required.

## Review checklist

- Every size on the page comes from the scale.
- Body copy has a `max-inline-size` in the 45–75ch band.
- Line-height decreases as size increases.
- No tracking on lowercase body; tracking present on all-caps.
- Numeric columns use `tabular-nums`.
- Fonts are `woff2`, subset, with `font-display` set and above-the-fold faces
  preloaded.
- Nothing shifts between first paint and font load — verify with a capture, not
  by reading the CSS.
