---
description: Audit a localhost page across mobile, tablet and desktop viewports and fix responsive breakage. Use when the user mentions responsive design, mobile layout, breakpoints, or asks how a page looks on phones.
---

# Responsive audit

Target: **$ARGUMENTS** (if empty, ask for the URL).

## Steps

1. Capture the same URL three times with `inspect_localhost_ui`:
   `viewport: "mobile"` (390×844), `"tablet"` (820×1180), `"desktop"`
   (1920×1080). Use `fullPage: true` so nothing below the fold is missed.
2. For each capture, look for the failure modes that only appear at one width:
   - horizontal overflow / content escaping its container
   - text wrapping into one word per line, or not wrapping at all
   - nav or toolbar collapsing incorrectly, or not collapsing at all
   - tap targets under ~44px on mobile
   - images and grids that do not reflow
   - fixed pixel widths that exceed the viewport
3. Cross-reference the `simplifiedDOM` from the mobile capture. Responsive bugs
   are almost always a missing or wrong breakpoint prefix (`md:`, `lg:`) or a
   hardcoded width. Quote the exact class list you are changing.
4. Fix the narrowest breakpoint first, then re-capture that viewport to confirm.
   Only then move up — a mobile fix often resolves tablet too.
5. Re-capture all three at the end and report the before/after per viewport.

## Notes

- Report only real breakage. Do not restyle a page that already works because
  you would have designed it differently.
- Mobile and tablet render at deviceScaleFactor 2 with touch emulation, so
  hover-only interactions are a genuine finding on those viewports.
