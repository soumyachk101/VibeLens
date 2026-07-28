# Motion

Animation is for explaining a change, not for decorating one. Every transition
should answer a question the user would otherwise have: where did this come from,
what did I just affect, is something still loading. Motion that answers nothing is
latency you added on purpose.

## Tokens

```css
:root {
  --dur-instant: 80ms;    /* colour/opacity feedback on a control */
  --dur-fast:    140ms;   /* hover, focus, checkbox, small toggle */
  --dur-base:    220ms;   /* dropdown, tooltip, accordion, small entrance */
  --dur-slow:    320ms;   /* modal, drawer, large panel entrance */
  --dur-slower:  480ms;   /* full-screen or page-level travel only */

  --ease-out:      cubic-bezier(0.16, 1, 0.3, 1);      /* entering: fast start, soft settle */
  --ease-in:       cubic-bezier(0.5, 0, 0.75, 0);      /* exiting: accelerate away */
  --ease-in-out:   cubic-bezier(0.65, 0, 0.35, 1);     /* moving between two on-screen points */
  --ease-standard: cubic-bezier(0.2, 0, 0.2, 1);       /* general UI default */
  --ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1);  /* overshoots: direct manipulation only */
}
```

## Duration by distance and importance

Duration scales with how far something travels and how much of the screen it
occupies. A 4px colour change and a full-screen drawer cannot share a duration:
the first feels sluggish, the second feels violent.

| Change | Band | Token |
| --- | --- | --- |
| Colour, opacity, border on hover or focus | 80–150ms | `--dur-instant` / `--dur-fast` |
| Checkbox, switch, small icon rotation | 100–150ms | `--dur-fast` |
| Dropdown, tooltip, popover appearing | 150–250ms | `--dur-base` |
| Accordion, inline expand | 200–300ms | `--dur-base` |
| Modal, side drawer, sheet | 250–350ms | `--dur-slow` |
| Full-screen or route transition | 350–500ms | `--dur-slower` |
| Exit of anything | 60–80% of its entrance | — |

Two asymmetries worth keeping. Exits are faster than entrances, because the user
has already decided and is waiting on you. And anything triggered by direct input
(a press, a drag) needs feedback inside roughly 100ms or it feels disconnected
from the action.

Above ~500ms motion registers as waiting. If a transition needs longer, the
problem is usually the amount of travel, not the timing.

## Easing by intent

| Intent | Easing | Why |
| --- | --- | --- |
| Entering the screen | `ease-out` | Arrives quickly, decelerates into place — reads as settling |
| Leaving the screen | `ease-in` | Accelerates away; no need to watch it finish |
| Moving between two visible points | `ease-in-out` | Symmetrical, natural for travel |
| General UI state change | `ease-standard` | Predictable default |
| Direct manipulation, drag release, playful confirm | spring / `--ease-spring` | Overshoot mimics physical momentum |
| Continuous, non-narrative (spinner, marquee) | `linear` | Any easing makes a loop visibly pulse |

Never use `ease-in` for something entering — it starts slow, so the element looks
stuck before it moves. Never use the default `ease` (`cubic-bezier(.25,.1,.25,1)`)
by omission; it is a browser default, not a decision.

Springs overshoot. That is right for something the user physically moved and wrong
for a modal or a menu, where the overshoot reads as instability.

## What to animate

Only two property groups are cheap: `transform` and `opacity`. They can be
handled without recalculating layout or repainting, so they stay smooth under
load. Animating a property that changes geometry forces layout on every frame for
that element and its subtree.

| Instead of | Animate |
| --- | --- |
| `width`, `height` | `transform: scale()`, or `grid-template-rows` on a contained expander |
| `top`, `left`, `right`, `bottom`, `margin` | `transform: translate()` |
| `box-shadow` | `opacity` on a pseudo-element that carries the shadow |
| `background-position` on a gradient | `transform` on an overlay layer |
| `filter: blur()` on a large area | A pre-blurred layer whose `opacity` changes |

```css
.panel {
  transition: transform var(--dur-slow) var(--ease-out),
              opacity   var(--dur-base) var(--ease-out);
}
.panel[data-state="closed"] { transform: translateY(8px) scale(0.98); opacity: 0; }
.panel[data-state="open"]   { transform: none;                       opacity: 1; }
```

Transition named properties, never `transition: all`. `all` animates properties
you did not intend — including expensive ones added later — and makes the rule
impossible to reason about.

## The compositor and `will-change`

`will-change` tells the browser to prepare a property for change, typically by
promoting the element to its own layer. It is a hint with a real cost: each
promoted layer consumes memory, and a permanently promoted element never gets
released.

| Rule | Reason |
| --- | --- |
| Do not set `will-change` in a base style | It is permanent promotion; memory cost with no benefit while idle |
| Add it just before the change, remove it after | That is the intended lifecycle |
| Prefer adding it on `:hover` of the parent for click-driven animation | Promotion happens just in time |
| Never apply it broadly (`* { will-change: transform }`) | Guarantees the regression it is meant to avoid |
| Measure before adding it | Most `transform`/`opacity` animations are already composited |

Also remember that `transform`, `filter`, `opacity < 1` and `will-change` each
create a stacking context, which changes how z-index resolves inside the element.

## `prefers-reduced-motion`

Reduced motion is a request to remove large, vestibular-triggering movement — not
to remove feedback. Stripping all animation loses information: the user no longer
knows a panel appeared rather than the page having changed.

| Under reduced motion | Do |
| --- | --- |
| Slide, scale, parallax, large travel | Replace with a short opacity change |
| Hover and focus feedback | Keep it; shorten if it is long |
| Loading indicator | Keep motion — it communicates ongoing work |
| Auto-playing carousel, background video, marquee | Stop it, and expose a control |
| Stagger | Collapse to a single fade with no per-item delay |
| Parallax and scroll-linked movement | Remove entirely |

```css
/* Blanket kill switch: use only as a floor, then restore what carries meaning. */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  /* Degrade, do not delete: the panel still announces itself. */
  .panel { transition: opacity var(--dur-fast) linear !important; transform: none !important; }
  .spinner { animation: spin 1s linear infinite !important; }  /* still means "working" */
}
```

Also honour it in JavaScript before starting an animation:

```js
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
element.animate(reduced ? [{ opacity: 0 }, { opacity: 1 }] : slideKeyframes,
                { duration: reduced ? 120 : 320, easing: "cubic-bezier(.16,1,.3,1)" });
```

## Stagger

Staggering a list entrance shows that items are separate. It only works with few
items and small delays; past that it becomes a queue the user waits through.

```css
li { animation: rise var(--dur-base) var(--ease-out) backwards;
     animation-delay: calc(var(--i) * 30ms); }   /* --i set inline per item */
@keyframes rise { from { opacity: 0; transform: translateY(6px); } }
```

| Constraint | Value |
| --- | --- |
| Per-item delay | 20–50ms |
| Maximum items to stagger | ~8; cap the total delay rather than the count |
| Total stagger window | Under ~250ms |
| Never stagger | Re-renders, filtered results, anything the user is waiting to read |

Stagger the first appearance only. Re-staggering on every data change makes the
list feel unstable.

## Layout changes: view transitions and FLIP

Animating layout properties directly is the expensive path. Two techniques get the
same result with transforms.

**FLIP** — First, Last, Invert, Play. Measure the element's position before the
change, apply the change, measure again, apply an inverting `transform` so it
appears not to have moved, then remove the transform with a transition. The
movement is a composited transform even though the underlying change was layout.

**View transitions** do this for you. `document.startViewTransition()` snapshots
the old and new states and cross-fades or morphs matched elements:

```css
@view-transition { navigation: auto; }              /* same-document navigations */
.card { view-transition-name: var(--card-id); }     /* unique per element, or the transition breaks */
::view-transition-old(root) { animation-duration: var(--dur-base); }
```

```js
if (document.startViewTransition) document.startViewTransition(() => applyDomChange());
else applyDomChange();   /* progressive enhancement: the change still happens */
```

Two constraints. A `view-transition-name` must be unique among rendered elements
at transition time — duplicates abort the transition. And support is uneven, so
the DOM update must work without it, as above.

## Do not animate

| Thing | Why |
| --- | --- |
| Anything on initial page load | Delays first meaningful content and reruns on every visit |
| Text colour on large text blocks | Reads as flicker |
| `height: auto` transitions | Not interpolable; use a grid-row or transform technique |
| Scroll position, unasked | Hijacking scroll removes user control |
| Error and validation messages appearing | The user needs to read them now |
| Focus rings | Delays the one signal a keyboard user depends on |
| Skeleton to content, with a slide | Cross-fade in place; the skeleton already reserved the space |
| Anything on every keystroke or scroll frame | Guarantees jank |
| Infinite non-loading loops | Constant motion in peripheral vision is fatiguing |
| Layout on hover, in a list | Neighbouring rows shift and the pointer lands on the wrong one |

## Review checklist

- Every duration and easing comes from a token; no inline magic numbers.
- Only `transform` and `opacity` are transitioned; no `transition: all`.
- Entrances use `ease-out`, exits use `ease-in` and are shorter.
- `prefers-reduced-motion` degrades motion to a fade and keeps loading indicators.
- No `will-change` in a base style.
- Nothing animates on initial load.
- Every animated element still reaches its final state if the animation is skipped
  — verify by capturing the page after the transition should have finished.
