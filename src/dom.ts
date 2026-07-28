/**
 * VibeLens — DOM sanitization.
 *
 * Raw `document.body.outerHTML` from a modern app is tens of thousands of
 * tokens, most of it noise (inline scripts, framework style blobs, base64
 * images, SVG path data). Shipping that to the model wastes context and buries
 * the signal.
 *
 * `sanitizeDomInPage` therefore runs *inside* the browser and returns only what
 * is useful for reasoning about layout: the element tree, ids, classes
 * (Tailwind!), ARIA/role/test hooks and short text. `truncateDom` then applies
 * a final Node-side cap so a pathological page can never blow the budget.
 *
 * NOTE: `sanitizeDomInPage` is serialized with `Function.prototype.toString()`
 * by Playwright, so it MUST stay self-contained — no imports, no references to
 * module scope. All configuration arrives via its single argument.
 */

import type { DomSanitizeOptions } from "./types.js";

/**
 * Runs in the page. Clones `<body>`, strips noise, and returns clean markup.
 *
 * @param opts truncation budgets, passed in because closures are not available.
 */
export function sanitizeDomInPage(opts: DomSanitizeOptions): string {
  const maxTextLength = opts.maxTextLength;
  const maxAttrLength = opts.maxAttrLength;

  /** Elements removed entirely — they carry zero layout signal for the AI. */
  const DROP_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEMPLATE",
    "LINK",
    "META",
    "BASE",
    "TITLE",
  ]);

  /** Elements kept as a self-closing placeholder (children discarded). */
  const COLLAPSE_TAGS = new Set([
    "SVG",
    "CANVAS",
    "IFRAME",
    "OBJECT",
    "EMBED",
    "VIDEO",
    "AUDIO",
    "MAP",
    "PICTURE",
  ]);

  /** Attributes worth their tokens. Everything else is dropped. */
  const KEEP_ATTRS = new Set([
    "id",
    "class",
    "role",
    "type",
    "name",
    "alt",
    "title",
    "placeholder",
    "href",
    "src",
    "value",
    "for",
    "label",
    "hidden",
    "disabled",
    "checked",
    "selected",
    "readonly",
    "required",
    "open",
    "colspan",
    "rowspan",
    "width",
    "height",
    "style",
  ]);

  /** Attribute prefixes kept wholesale (accessibility + test selectors). */
  const KEEP_PREFIXES = ["aria-", "data-testid", "data-test", "data-cy", "data-qa"];

  const shorten = (value: string, limit: number): string =>
    value.length > limit ? `${value.slice(0, limit)}…[truncated]` : value;

  const shouldKeepAttr = (name: string): boolean => {
    if (KEEP_ATTRS.has(name)) return true;
    for (const prefix of KEEP_PREFIXES) {
      if (name.startsWith(prefix)) return true;
    }
    return false;
  };

  const cleanAttrValue = (name: string, value: string): string => {
    // Inline base64 payloads are pure token burn.
    if (/^\s*data:/i.test(value)) {
      const kind = /^\s*data:([^;,]*)/i.exec(value)?.[1] ?? "";
      return `data:${kind}[stripped]`;
    }
    // Inline styles are useful only when short; long ones are usually generated.
    if (name === "style" && value.length > 120) {
      return shorten(value, 120);
    }
    return shorten(value, maxAttrLength);
  };

  const clone = document.body ? (document.body.cloneNode(true) as HTMLElement) : null;
  if (!clone) return "<!-- no <body> found -->";

  // Depth-first walk over the clone, mutating as we go.
  const walk = (node: Node): void => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === 8 /* COMMENT_NODE */) {
        child.parentNode?.removeChild(child);
        continue;
      }

      if (child.nodeType === 3 /* TEXT_NODE */) {
        const collapsed = (child.textContent ?? "").replace(/\s+/g, " ").trim();
        if (collapsed.length === 0) {
          child.parentNode?.removeChild(child);
        } else {
          child.textContent = shorten(collapsed, maxTextLength);
        }
        continue;
      }

      if (child.nodeType !== 1 /* ELEMENT_NODE */) {
        child.parentNode?.removeChild(child);
        continue;
      }

      const element = child as Element;
      const tag = element.tagName.toUpperCase();

      if (DROP_TAGS.has(tag)) {
        element.remove();
        continue;
      }

      // Prune attributes before recursing.
      for (const attr of Array.from(element.attributes)) {
        const name = attr.name.toLowerCase();
        if (!shouldKeepAttr(name)) {
          element.removeAttribute(attr.name);
          continue;
        }
        const cleaned = cleanAttrValue(name, attr.value);
        if (cleaned !== attr.value) element.setAttribute(attr.name, cleaned);
      }

      if (COLLAPSE_TAGS.has(tag)) {
        // Keep the box (it affects layout) but throw away the internals.
        element.textContent = "";
        continue;
      }

      walk(element);
    }
  };

  walk(clone);

  // Collapse the whitespace the cloning left behind.
  return clone.outerHTML.replace(/>\s+</g, "><").replace(/[ \t]{2,}/g, " ").trim();
}

/**
 * Applies the final hard cap on DOM size.
 *
 * Truncation is explicit in the output so the model knows the tree is partial
 * and can narrow its next request instead of reasoning about missing markup.
 */
export function truncateDom(
  html: string,
  maxChars: number,
): { dom: string; truncated: boolean } {
  if (html.length <= maxChars) {
    return { dom: html, truncated: false };
  }
  return {
    dom: `${html.slice(0, maxChars)}\n<!-- VibeLens: DOM truncated at ${maxChars} characters (original ${html.length}). -->`,
    truncated: true,
  };
}
