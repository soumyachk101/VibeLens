#!/usr/bin/env node
/**
 * Builds the VibeLens documentation site into site-dist/.
 *
 * Design constraint: the markdown in docs/ and the repository root stays the
 * single source of truth. Nothing here re-states documentation content; each
 * page is rendered from its .md file, and cross-links between those files are
 * rewritten to site URLs so the same text works on GitHub and on the web.
 *
 * The only hand-authored page is the landing page, which is marketing shaped
 * rather than reference shaped.
 *
 * Usage: node scripts/site/build.mjs [--base /VibeLens]
 */

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { marked } from "marked";
import { createHighlighter } from "shiki";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const outDir = join(repoRoot, "site-dist");

/** GitHub Pages serves a project site under /<repo>/, so links need a prefix. */
const baseArgIndex = process.argv.indexOf("--base");
const BASE = baseArgIndex === -1 ? "" : (process.argv[baseArgIndex + 1] ?? "").replace(/\/$/, "");

const { version: VERSION } = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));

/**
 * Syntax highlighting happens at build time, not in the browser: the output is
 * plain spans carrying CSS variables for both themes, so there is no runtime
 * cost and no flash of unhighlighted code when the theme is switched.
 */
const LANGS = ["bash", "shell", "json", "jsonc", "toml", "yaml", "typescript", "javascript",
  "tsx", "jsx", "css", "html", "diff", "ini", "markdown", "text"];
const highlighter = await createHighlighter({
  themes: ["github-light-default", "github-dark-default"],
  langs: LANGS,
});
const LANG_ALIASES = { js: "javascript", ts: "typescript", sh: "bash", md: "markdown", jsonc: "json", plaintext: "text" };

const SITE = {
  title: "VibeLens",
  tagline: "Give your AI coding assistant eyes on localhost.",
  description:
    "VibeLens is a free, MIT-licensed MCP server that returns a screenshot, console and network diagnostics, and a token-optimized DOM snapshot of your local dev server, so an AI coding assistant fixes UI from evidence instead of guesswork.",
  repo: "https://github.com/soumyachk101/VibeLens",
  npm: "https://www.npmjs.com/package/mcp-vibelens",
};

/**
 * The navigation is also the page manifest. `src` is a markdown file relative
 * to the repository root; pages without `src` are hand-authored below.
 */
const NAV = [
  {
    group: "Overview",
    pages: [
      { out: "index.html", title: "VibeLens", nav: "Introduction", kind: "home" },
      { out: "install.html", title: "Install and IDE setup", nav: "Install & IDE setup", kind: "install" },
      { out: "tool.html", title: "The inspect_localhost_ui tool", nav: "Tool reference", kind: "tool" },
      { out: "faq.html", title: "FAQ", nav: "FAQ", src: "docs/FAQ.md" },
      { out: "troubleshooting.html", title: "Troubleshooting", nav: "Troubleshooting", src: "docs/TROUBLESHOOTING.md" },
    ],
  },
  {
    group: "Claude Code plugin",
    pages: [
      { out: "plugin.html", title: "Skills, subagents and hooks", nav: "Skills & agents", src: "plugin/README.md" },
    ],
  },
  {
    group: "Design system",
    pages: [
      { out: "design/index.html", title: "Design knowledge base", nav: "Overview", src: "docs/design/README.md" },
      { out: "design/anti-slop.html", title: "Anti-slop", nav: "Anti-slop", src: "docs/design/ANTI-SLOP.md" },
      { out: "design/typography.html", title: "Typography", nav: "Typography", src: "docs/design/TYPOGRAPHY.md" },
      { out: "design/color.html", title: "Colour", nav: "Colour", src: "docs/design/COLOR.md" },
      { out: "design/spacing-layout.html", title: "Spacing and layout", nav: "Spacing & layout", src: "docs/design/SPACING-LAYOUT.md" },
      { out: "design/motion.html", title: "Motion", nav: "Motion", src: "docs/design/MOTION.md" },
    ],
  },
  {
    group: "Architecture",
    pages: [
      { out: "architecture.html", title: "Architecture", nav: "Architecture", src: "docs/ARCHITECTURE.md" },
      { out: "prd-trd.html", title: "Product and technical requirements", nav: "PRD & TRD", src: "docs/PRD-TRD.md" },
      { out: "adr/index.html", title: "Architecture decision records", nav: "ADR index", src: "docs/adr/README.md" },
      { out: "adr/0001-mcp-over-stdio.html", title: "ADR 0001", nav: "0001 · MCP over stdio", src: "docs/adr/0001-mcp-over-stdio.md" },
      { out: "adr/0002-playwright-over-puppeteer.html", title: "ADR 0002", nav: "0002 · Playwright", src: "docs/adr/0002-playwright-over-puppeteer.md" },
      { out: "adr/0003-ssrf-allowlist-not-denylist.html", title: "ADR 0003", nav: "0003 · SSRF allowlist", src: "docs/adr/0003-ssrf-allowlist-not-denylist.md" },
      { out: "adr/0004-single-tool-not-many.html", title: "ADR 0004", nav: "0004 · One tool", src: "docs/adr/0004-single-tool-not-many.md" },
      { out: "adr/0005-plugin-ships-from-subdirectory.html", title: "ADR 0005", nav: "0005 · Plugin subdirectory", src: "docs/adr/0005-plugin-ships-from-subdirectory.md" },
      { out: "adr/0006-jpeg-screenshots-and-dom-truncation.html", title: "ADR 0006", nav: "0006 · JPEG and truncation", src: "docs/adr/0006-jpeg-screenshots-and-dom-truncation.md" },
    ],
  },
  {
    group: "Project",
    pages: [
      { out: "contributing.html", title: "Contributing", nav: "Contributing", src: "CONTRIBUTING.md" },
      { out: "security.html", title: "Security policy", nav: "Security", src: "SECURITY.md" },
      { out: "support.html", title: "Support", nav: "Support", src: "SUPPORT.md" },
      { out: "changelog.html", title: "Changelog", nav: "Changelog", src: "CHANGELOG.md" },
      { out: "release.html", title: "Release process", nav: "Releasing", src: "RELEASE.md" },
      { out: "code-of-conduct.html", title: "Code of conduct", nav: "Code of conduct", src: "CODE_OF_CONDUCT.md" },
    ],
  },
];

const allPages = NAV.flatMap((section) => section.pages);

/** Source markdown path -> output page, used to rewrite cross-links. */
const srcToOut = new Map(allPages.filter((p) => p.src).map((p) => [p.src, p.out]));

// A few markdown files are referenced by the docs but are not pages of their
// own; send those at GitHub instead of producing a dead link.
const GITHUB_FALLBACK = `${SITE.repo}/blob/main/`;

const escapeHtml = (value) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[`*_]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

/** Absolute site URL for an output path. */
const url = (out) => `${BASE}/${out}`.replace(/\/index\.html$/, "/");

/**
 * Renders one markdown file to HTML, collecting the heading outline for the
 * table of contents on the way.
 */
function renderMarkdown(markdown, sourcePath) {
  const outline = [];
  const seen = new Map();
  let hasMermaid = false;

  const renderer = new marked.Renderer();

  // Renderer methods are declared with `function` rather than arrows so `this`
  // is the renderer: `this.parser.parseInline(tokens)` reuses the same parser
  // and renderer for nested inline content. Re-parsing raw text with a fresh
  // parseInline call instead recurses without terminating.

  renderer.heading = function ({ tokens, depth }) {
    const text = this.parser.parseInline(tokens);
    const plain = text.replace(/<[^>]+>/g, "");
    let id = slugify(plain);
    if (seen.has(id)) {
      const next = seen.get(id) + 1;
      seen.set(id, next);
      id = `${id}-${next}`;
    } else {
      seen.set(id, 1);
    }

    // The h1 is rendered from the page title, so skip it in the outline.
    if (depth === 2 || depth === 3) outline.push({ depth, id, text: plain });

    const anchor =
      depth === 2 || depth === 3
        ? `<a class="heading-anchor" href="#${id}" aria-label="Link to this section">#</a>`
        : "";
    return `<h${depth} id="${id}">${text}${anchor}</h${depth}>\n`;
  };

  renderer.code = function ({ text, lang }) {
    const requested = (lang ?? "").trim().split(/\s+/)[0] ?? "";
    if (requested === "mermaid") {
      hasMermaid = true;
      return `<pre class="mermaid">${escapeHtml(text)}</pre>\n`;
    }

    const resolvedLang = LANG_ALIASES[requested] ?? requested;
    const langTag = requested ? `<span class="code-lang">${escapeHtml(requested)}</span>` : "";
    const dotsHeader = `<div class="code-header"><div class="code-dots"><span class="dot dot-red"></span><span class="dot dot-yellow"></span><span class="dot dot-green"></span></div>${langTag}</div>`;

    if (LANGS.includes(resolvedLang)) {
      const highlighted = highlighter.codeToHtml(text, {
        lang: resolvedLang,
        themes: { light: "github-light-default", dark: "github-dark-default" },
        // defaultColor: false emits both themes as CSS variables instead of
        // baking one in, which is what lets the theme toggle work instantly.
        defaultColor: false,
      });
      return `<div class="code-block" data-lang="${escapeHtml(requested)}">${dotsHeader}${highlighted}</div>\n`;
    }

    return `<div class="code-block" data-lang="${escapeHtml(requested)}">${dotsHeader}<pre class="shiki"><code>${escapeHtml(text)}</code></pre></div>\n`;
  };

  renderer.blockquote = function (token) {
    const text = this.parser.parse(token.tokens);
    const alertMatch = text.match(/^<p>\s*\[\!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*<br\s*\/?>?/i);
    if (alertMatch) {
      const type = alertMatch[1].toUpperCase();
      const cleanContent = text.replace(/^<p>\s*\[\!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*<br\s*\/?>?/i, "<p>");
      return `<div class="callout callout-${type.toLowerCase()}"><div class="callout-header"><span class="callout-icon"></span><strong class="callout-title">${type}</strong></div><div class="callout-body">${cleanContent}</div></div>\n`;
    }
    return `<blockquote>${text}</blockquote>\n`;
  };

  renderer.table = function (token) {
    const head = token.header
      .map((cell) => `<th>${this.parser.parseInline(cell.tokens)}</th>`)
      .join("");
    const body = token.rows
      .map(
        (row) =>
          `<tr>${row.map((cell) => `<td>${this.parser.parseInline(cell.tokens)}</td>`).join("")}</tr>`,
      )
      .join("\n");
    // Wrapped so a wide table scrolls instead of breaking the page.
    return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>\n${body}\n</tbody></table></div>\n`;
  };

  renderer.link = function ({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens);
    const resolved = resolveLink(href ?? "", sourcePath);
    const external = /^https?:/.test(resolved);
    const attrs = [
      `href="${escapeHtml(resolved)}"`,
      title ? `title="${escapeHtml(title)}"` : "",
      external ? 'target="_blank" rel="noopener noreferrer"' : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `<a ${attrs}>${text}</a>`;
  };

  renderer.image = function ({ href, title, text }) {
    const resolved = resolveLink(href ?? "", sourcePath);
    const attrs = [
      `src="${escapeHtml(resolved)}"`,
      `alt="${escapeHtml(text ?? "")}"`,
      title ? `title="${escapeHtml(title)}"` : "",
      'loading="lazy" decoding="async"',
    ]
      .filter(Boolean)
      .join(" ");
    return `<img ${attrs}>`;
  };

  const rendered = marked.parse(markdown, { renderer, gfm: true, breaks: false });

  // Safety net. If any future markdown construct renders a link outside the
  // renderer above, it would silently ship a .md link that 404s on the site.
  // The link checker in check.mjs would catch it, but fixing it here keeps the
  // build honest by default.
  const html = rendered.replace(
    /(href|src)="([^"]+)"/g,
    (match, attr, value) => {
      if (/^(https?:|mailto:|data:|#|\/)/.test(value)) return match;
      return `${attr}="${escapeHtml(resolveLink(value, sourcePath))}"`;
    },
  );

  return { html, outline, hasMermaid };
}

/**
 * Rewrites a link found inside a markdown file so it works on the site.
 * Relative .md targets become site pages; assets become site assets; anything
 * unmapped falls back to the file on GitHub rather than 404ing.
 */
function resolveLink(href, sourcePath) {
  if (!href || /^(https?:|mailto:|#)/.test(href)) return href;

  const sourceDir = posix.dirname(sourcePath);
  const [pathPart, hash = ""] = href.split("#");
  const suffix = hash ? `#${hash}` : "";

  if (!pathPart) return href;

  const normalized = posix.normalize(posix.join(sourceDir, pathPart)).replace(/^\.\//, "");

  if (normalized.startsWith("assets/")) return `${BASE}/${normalized}${suffix}`;

  if (srcToOut.has(normalized)) return `${url(srcToOut.get(normalized))}${suffix}`;

  // Directory references such as ./docs/adr/ or ../docs/design.
  const asIndex = `${normalized.replace(/\/$/, "")}/README.md`;
  if (srcToOut.has(asIndex)) return `${url(srcToOut.get(asIndex))}${suffix}`;
  if (normalized.replace(/\/$/, "") === "docs/adr") return `${url("adr/index.html")}${suffix}`;
  if (normalized.replace(/\/$/, "") === "docs/design") return `${url("design/index.html")}${suffix}`;

  return `${GITHUB_FALLBACK}${normalized}${suffix}`;
}

// ------------------------------------------------------------------ layout --

function sidebarHtml(currentOut) {
  return NAV.map((section) => {
    const holdsCurrent = section.pages.some((page) => page.out === currentOut);
    // Long groups (the ADR list) start closed unless you are inside them, so the
    // sidebar stays scannable instead of becoming a wall of links.
    const collapsible = section.pages.length > 6;
    const open = holdsCurrent || !collapsible;

    const items = section.pages
      .map((page) => {
        const current = page.out === currentOut ? ' aria-current="page"' : "";
        return `<li><a href="${url(page.out)}"${current}>${escapeHtml(page.nav)}</a></li>`;
      })
      .join("\n");

    return `<details class="nav-group"${open ? " open" : ""}>
      <summary><span>${escapeHtml(section.group)}</span><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg></summary>
      <ul>\n${items}\n</ul>
    </details>`;
  }).join("\n");
}

/** The top-level nav maps a group to one primary link. */
const PRIMARY_NAV = [
  { label: "Docs", out: "install.html", groups: ["Overview"] },
  { label: "Skills", out: "plugin.html", groups: ["Claude Code plugin"] },
  { label: "Design", out: "design/index.html", groups: ["Design system"] },
  { label: "Architecture", out: "architecture.html", groups: ["Architecture"] },
  { label: "Project", out: "contributing.html", groups: ["Project"] },
];

function groupOf(out) {
  return NAV.find((section) => section.pages.some((page) => page.out === out))?.group ?? "";
}

function primaryNavHtml(currentOut) {
  const group = groupOf(currentOut);
  return PRIMARY_NAV.map((item) => {
    const active = item.groups.includes(group) ? ' aria-current="true"' : "";
    return `<a href="${url(item.out)}"${active}>${escapeHtml(item.label)}</a>`;
  }).join("\n");
}

function breadcrumbHtml(page) {
  const group = groupOf(page.out);
  if (!group || page.out === "index.html") return "";
  return `<nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="${url("index.html")}">Docs</a>
    <span aria-hidden="true">/</span>
    <span>${escapeHtml(group)}</span>
  </nav>`;
}

function editLinkHtml(page) {
  if (!page.src) return "";
  return `<a class="edit-link" href="${SITE.repo}/blob/main/${page.src}" target="_blank" rel="noopener noreferrer">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" stroke-linecap="round" stroke-linejoin="round"/></svg>
    Edit this page
  </a>`;
}

function tocHtml(outline) {
  if (outline.length < 2) return "";
  const items = outline
    .map(
      (entry) =>
        `<li class="lvl-${entry.depth}"><a href="#${entry.id}">${escapeHtml(entry.text)}</a></li>`,
    )
    .join("\n");
  return `<nav class="toc" aria-label="On this page"><p>On this page</p><ul>\n${items}\n</ul></nav>`;
}

function pageNavHtml(currentOut) {
  const index = allPages.findIndex((p) => p.out === currentOut);
  const previous = allPages[index - 1];
  const next = allPages[index + 1];
  if (!previous && !next) return "";

  const link = (page, kind) =>
    page
      ? `<a class="${kind}" href="${url(page.out)}"><small>${kind === "prev" ? "Previous" : "Next"}</small><strong>${escapeHtml(page.nav)}</strong></a>`
      : "";
  return `<nav class="page-nav" aria-label="Pagination">${link(previous, "prev")}${link(next, "next")}</nav>`;
}

function shell({ page, body, outline = [], hasMermaid = false, wide = false }) {
  const canonicalTitle =
    page.out === "index.html" ? `${SITE.title} — ${SITE.tagline}` : `${page.title} · ${SITE.title}`;
  const toc = tocHtml(outline);

  const content = wide
    ? body
    : `<main class="main" id="content">
        <div class="${toc ? "with-toc" : ""}">
          <article class="prose">
            ${breadcrumbHtml(page)}
            <div class="page-head">
              <h1>${escapeHtml(page.title)}</h1>
              ${editLinkHtml(page)}
            </div>
            ${body}
            ${pageNavHtml(page.out)}
          </article>
          ${toc}
        </div>
      </main>`;

  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(canonicalTitle)}</title>
<meta name="description" content="${escapeHtml(SITE.description)}">
<meta name="color-scheme" content="dark light">
<meta property="og:title" content="${escapeHtml(canonicalTitle)}">
<meta property="og:description" content="${escapeHtml(SITE.description)}">
<meta property="og:type" content="website">
<meta property="og:image" content="${BASE}/assets/banner.svg">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="icon" type="image/svg+xml" href="${BASE}/assets/logo.svg">
<link rel="stylesheet" href="${BASE}/styles.css">
<script>
  /* Applied before first paint so the stored theme does not flash. (prefers-color-scheme check) */
  try {
    var stored = localStorage.getItem("vibelens-theme");
    if (stored) document.documentElement.dataset.theme = stored;
    else if (window.matchMedia("(prefers-color-scheme: light)").matches)
      document.documentElement.dataset.theme = "dark";
    else document.documentElement.dataset.theme = "dark";
  } catch (e) {}
</script>
</head>
<body>
<a class="skip-link" href="#content">Skip to content</a>

<header class="site-header">
  <div class="header-inner">
    <button class="icon-button nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-label="Open documentation navigation">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke-linecap="round"/></svg>
    </button>

    <a class="brand" href="${url("index.html")}">
      <img src="${BASE}/assets/logo.svg" alt="" width="28" height="28">
      <!-- No whitespace between the two halves of the wordmark, or the browser
           renders "Vibe Lens" with a gap. -->
      <b>Vibe<span>Lens</span></b>
      <span class="version">v${VERSION}</span>
    </a>

    <nav class="primary-nav" aria-label="Sections">
      ${primaryNavHtml(page.out)}
    </nav>

    <div class="header-actions">
      <button class="search-trigger" type="button" data-search-open aria-label="Search documentation">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5" stroke-linecap="round"/></svg>
        <span>Search</span>
        <kbd>⌘K</kbd>
      </button>

      <a class="icon-button" href="${SITE.repo}" target="_blank" rel="noopener noreferrer" aria-label="VibeLens on GitHub">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.85-2.34 4.7-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>
      </a>

      <button class="icon-button" type="button" data-theme-toggle aria-label="Switch theme">
        <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" stroke-linecap="round"/></svg>
        <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z" stroke-linejoin="round"/></svg>
      </button>
    </div>
  </div>
</header>

<dialog class="search-dialog" data-search-dialog aria-label="Search documentation">
  <form class="search-box" method="dialog" onsubmit="return false">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5" stroke-linecap="round"/></svg>
    <input type="search" data-search-input placeholder="Search the documentation" autocomplete="off" spellcheck="false" aria-label="Search query">
    <kbd>Esc</kbd>
  </form>
  <div class="search-results" data-search-results role="listbox" aria-label="Search results"></div>
  <p class="search-hint">Enter to open · arrow keys to move · results come from a build-time index, no network calls</p>
</dialog>

<div class="nav-backdrop" data-nav-backdrop hidden></div>

<div class="shell">
  <nav class="sidebar" aria-label="Documentation">
    ${sidebarHtml(page.out)}
  </nav>
  ${content}
</div>

<footer class="site-footer">
  <div class="footer-inner">
    <p>Free and MIT licensed. No paid tier, no account, no telemetry.</p>
    <div class="footer-links">
      <a href="${SITE.repo}" target="_blank" rel="noopener noreferrer">GitHub</a>
      <a href="${SITE.npm}" target="_blank" rel="noopener noreferrer">npm</a>
      <a href="${url("changelog.html")}">Changelog</a>
      <a href="${url("security.html")}">Security</a>
    </div>
  </div>
</footer>

<script>window.VIBELENS_BASE = "${BASE}";</script>
<script src="${BASE}/app.js" defer></script>
${hasMermaid ? mermaidScript() : ""}
</body>
</html>
`;
}

/** Mermaid is only loaded on the one page that contains a diagram. */
function mermaidScript() {
  return `<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
  const dark = document.documentElement.dataset.theme !== "light";
  mermaid.initialize({
    startOnLoad: true,
    securityLevel: "strict",
    theme: dark ? "dark" : "neutral",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
  });
</script>`;
}

// -------------------------------------------------------------- home page --

function homePage(page) {
  const body = `
<main class="home" id="content">
  <section class="hero">
    <div class="hero-inner">
      <p class="eyebrow"><span class="pulse-dot"></span> <b>Free</b> · MIT · no telemetry</p>
      <h1>Your AI writes the UI. <em>VibeLens lets it see it.</em></h1>
      <p class="lede">
        One MCP tool call returns a screenshot of your running page, the console and
        network failures behind it, and a token-optimized DOM snapshot that keeps the
        real ids and Tailwind classes. The model stops guessing selectors and starts
        reading them.
      </p>
      <div class="cta-row">
        <a class="button button-primary" href="${url("install.html")}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18" stroke-width="2.2"><path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Install in one command
        </a>
        <a class="button button-secondary" href="${SITE.repo}" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.85-2.34 4.7-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>
          View on GitHub
        </a>
      </div>
      <div class="install-line" data-copy-cmd="claude plugin marketplace add soumyachk101/VibeLens" title="Click to copy">
        <span class="prompt">$</span>
        <code>claude plugin marketplace add soumyachk101/VibeLens</code>
        <button type="button" class="copy-cmd-btn" aria-label="Copy install command">
          <svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" width="15" height="15" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span class="copy-txt">Copy</span>
        </button>
      </div>
    </div>
  </section>

  <figure class="figure-wide">
    <img src="${BASE}/assets/demo.gif" alt="VibeLens capturing a dashboard where a button overflows its card, reading the offending classes out of the DOM, and re-capturing to confirm the fix" width="900">
    <figcaption>Every frame is real tool output, not a mockup — regenerate it with <code>npm run assets:gif</code>.</figcaption>
  </figure>

  <section class="section">
    <div class="section-head">
      <h2>One call, three signals</h2>
      <p>
        A screenshot alone misses hydration errors. A DOM dump alone misses what the
        page looks like. VibeLens returns both, plus the diagnostics, in a single
        response.
      </p>
    </div>
    <div class="payload-grid">
      <article class="card">
        <h3><span class="tag" style="background: var(--accent)"></span>Screenshot</h3>
        <p>Base64 JPEG at desktop, tablet or mobile. The model sees layout, spacing, colour, overflow and hierarchy for itself.</p>
      </article>
      <article class="card">
        <h3><span class="tag" style="background: var(--danger)"></span>Console and network</h3>
        <p>Console errors and warnings, uncaught exceptions, and requests that failed — including 4xx and 5xx responses a screenshot cannot show.</p>
      </article>
      <article class="card">
        <h3><span class="tag" style="background: var(--violet)"></span>Sanitized DOM</h3>
        <p>Structure, ids, classes, ARIA and test hooks. Scripts, styles, base64 blobs and SVG path data are stripped in the browser, before the payload is built.</p>
      </article>
    </div>
  </section>

  <section class="section">
    <div class="section-head">
      <h2>Twelve skills, four subagents, two advisories</h2>
      <p>
        The raw tool gives the model eyes. The Claude Code plugin gives it a method —
        including a design-craft set aimed at the problem screenshots alone do not
        fix: UI that works and still looks like nobody designed it.
      </p>
    </div>
    <div class="skill-groups">
      <div class="skill-group">
        <h3 style="color: var(--accent)">Debugging</h3>
        <dl>
          <dt>check-ui</dt><dd>Capture, read the evidence, locate the source, fix, re-capture.</dd>
          <dt>console-triage</dt><dd>Group failures by root cause and fix by severity.</dd>
          <dt>responsive-audit</dt><dd>Three viewports, narrowest breakpoint first.</dd>
          <dt>a11y-audit</dt><dd>Alt text, accessible names, labels, contrast, tap targets.</dd>
        </dl>
      </div>
      <div class="skill-group">
        <h3 style="color: var(--violet)">Design craft</h3>
        <dl>
          <dt>design-review</dt><dd>Does the page read as designed, or as generated?</dd>
          <dt>type-system</dt><dd>Scale, measure, leading, tracking, numerals.</dd>
          <dt>color-system</dt><dd>Tokens, ramps, contrast, colour as state.</dd>
          <dt>layout-audit</dt><dd>Spacing scale, grouping, optical alignment.</dd>
          <dt>motion-system</dt><dd>Duration, easing, reduced-motion.</dd>
          <dt>micro-interactions</dt><dd>The full state matrix for every control.</dd>
          <dt>polish-pass</dt><dd>The last ten percent, item by item.</dd>
        </dl>
      </div>
      <div class="skill-group">
        <h3 style="color: var(--success)">Verification</h3>
        <dl>
          <dt>before-after</dt><dd>Identical parameters before and after, then a concrete diff.</dd>
        </dl>
        <h3 style="color: var(--text-muted); margin-top: var(--s-6)">Subagents</h3>
        <dl>
          <dt>ui-debugger</dt><dd>Evidence-driven bug fixing.</dd>
          <dt>ui-reviewer</dt><dd>Independent pre-merge review.</dd>
          <dt>design-reviewer</dt><dd>Taste verdict, backed by the proving class.</dd>
          <dt>frontend-builder</dt><dd>Tokens before components, every state built.</dd>
        </dl>
      </div>
    </div>
  </section>

  <figure class="figure-wide">
    <img src="${BASE}/assets/workflow.svg" alt="The VibeLens loop: you ask, the model calls the tool, headless Chromium captures, one payload returns three signals, the model reasons from evidence, then re-captures to verify" width="1200">
  </figure>

  <section class="section">
    <div class="section-head">
      <h2>It protects your context window</h2>
      <p>
        A raw <code>document.body.outerHTML</code> from a real app is mostly noise. The
        sanitizer runs inside the page, so the noise never becomes tokens. This figure
        is measured, and you can reproduce it with <code>npm run assets:measure</code>.
      </p>
    </div>
    <img src="${BASE}/assets/dom-budget.svg" alt="Measured: 193,520 raw characters reduce to 8,890 after sanitization, a 95.4 percent reduction, with every utility class preserved" width="1200">
  </section>

  <section class="section">
    <div class="section-head">
      <h2>Local only, by construction</h2>
      <p>
        VibeLens drives a real browser on your machine, so every URL is checked against
        an allowlist before Chromium launches. Public hosts, DNS names, link-local
        addresses and cloud metadata endpoints are refused, and the tool is read-only:
        it observes a page, it cannot click, type or scroll.
      </p>
    </div>
    <div class="cta-row">
      <a class="button button-secondary" href="${url("security.html")}">Security policy</a>
      <a class="button button-secondary" href="${url("architecture.html")}">How it works</a>
      <a class="button button-secondary" href="${url("adr/index.html")}">Decision records</a>
    </div>
  </section>
</main>`;
  return shell({ page, body, wide: true });
}

// --------------------------------------------- hand-authored doc fragments --

const INSTALL_MD = `
VibeLens is a plain MCP server over stdio, so every MCP-capable client takes the
same shape. Claude Code additionally gets a plugin that bundles the skills,
subagents and hooks.

## Requirements

- Node.js 20 or newer. Playwright 1.62 requires it.
- Chromium for Playwright, installed once:

\`\`\`bash
npx playwright install chromium
\`\`\`

There is no global install step for the server itself: \`npx\` fetches it on
first run.

## Claude Code

Install as a plugin. This is the recommended path because it also installs the
twelve skills, four subagents and two advisory hooks:

\`\`\`bash
claude plugin marketplace add soumyachk101/VibeLens
claude plugin install vibelens@vibelens
\`\`\`

Or add it as a bare MCP server:

\`\`\`bash
claude mcp add vibelens --scope user -- npx -y mcp-vibelens@1
claude mcp add vibelens --scope project -- npx -y mcp-vibelens@1
\`\`\`

\`--scope user\` makes it available in every project; \`--scope project\` writes a
\`.mcp.json\` you can commit for your team. Verify with \`/mcp\` in a session:
\`vibelens\` should be listed as connected.

## OpenAI Codex

\`\`\`bash
codex mcp add vibelens -- npx -y mcp-vibelens@1
\`\`\`

Codex shares this configuration between the CLI and the IDE extension, so it
only needs doing once. To edit it by hand, add this to \`~/.codex/config.toml\`:

\`\`\`toml
[mcp_servers.vibelens]
command = "npx"
args = ["-y", "mcp-vibelens@1"]
\`\`\`

Check with \`codex mcp list\`. Codex supports local stdio servers only, which is
exactly what VibeLens is.

## Cursor

Create \`.cursor/mcp.json\` in your project, or \`~/.cursor/mcp.json\` for every
project:

\`\`\`json
{
  "mcpServers": {
    "vibelens": {
      "command": "npx",
      "args": ["-y", "mcp-vibelens@1"]
    }
  }
}
\`\`\`

Then enable **vibelens** under Settings, MCP.

## Google Antigravity

Open the MCP configuration from the UI — the three-dot menu in chat, then MCP
Servers, Manage MCP Servers, View raw config; or Settings, Customizations, Open
MCP Config — and paste the same JSON block. Depending on your build the file is
at one of:

- \`~/.gemini/antigravity/mcp_config.json\`
- \`~/.gemini/config/mcp_config.json\` on newer builds and the Antigravity CLI

Using the in-app menu is the reliable way to open the right one.

## Windsurf

\`~/.codeium/windsurf/mcp_config.json\`, same JSON block as Cursor.

## VS Code, GitHub Copilot agent mode

\`.vscode/mcp.json\` uses \`servers\` rather than \`mcpServers\`:

\`\`\`json
{
  "servers": {
    "vibelens": { "command": "npx", "args": ["-y", "mcp-vibelens@1"] }
  }
}
\`\`\`

## Claude Desktop

\`~/Library/Application Support/Claude/claude_desktop_config.json\` on macOS, same
JSON block as Cursor. Restart the app afterwards.

## From source

\`\`\`bash
git clone https://github.com/soumyachk101/VibeLens.git
cd VibeLens
npm install
npx playwright install chromium
npm run build
npm test
npm run smoke
\`\`\`

Then point your IDE at \`node /absolute/path/to/VibeLens/dist/index.js\`.

## It is not connecting

Start with [Troubleshooting](./TROUBLESHOOTING.md); it covers the per-IDE
diagnosis and every error code the tool can return.
`;

const TOOL_MD = `
VibeLens exposes exactly one tool. One tool with a small, bounded schema is
called correctly far more often than a family of narrow ones — the reasoning is
in [ADR 0004](./adr/0004-single-tool-not-many.md).

## Parameters

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| \`url\` | string, required | — | Local URL such as \`http://localhost:3000/dashboard\`. A missing scheme is assumed to be \`http://\`. |
| \`viewport\` | \`desktop\` \\| \`tablet\` \\| \`mobile\` | \`desktop\` | \`desktop\` 1920x1080, \`tablet\` 820x1180 at 2x, \`mobile\` 390x844 at 2x with touch emulation. |
| \`delay\` | number, 0 to 15000 | \`1000\` | Milliseconds to wait after load, for hydration, animation or data fetching. |
| \`fullPage\` | boolean | \`false\` | Capture the whole scrollable page instead of the viewport. |

## What it returns

Two MCP content blocks. First an \`image\` block containing a base64 JPEG at
quality 75, then a \`text\` block containing JSON:

\`\`\`json
{
  "summary": {
    "url": "http://localhost:3000/health",
    "pageTitle": "Service health",
    "viewport": "desktop (1920x1080)",
    "fullPage": false,
    "waitedMs": 1000,
    "captureMs": 1253,
    "consoleErrors": 1,
    "consoleWarnings": 0,
    "uncaughtPageErrors": 0,
    "failedRequests": 1,
    "domTruncated": false
  },
  "consoleLogs": [
    { "level": "error", "text": "Hydration failed...", "location": "http://localhost:3000/app.js:42:13" }
  ],
  "uncaughtPageErrors": ["TypeError: Cannot read properties of undefined"],
  "failedRequests": [
    { "url": "http://localhost:3000/avatar.png", "method": "GET", "failure": "HTTP 404", "status": 404 }
  ],
  "simplifiedDOM": "<body class=\\"...\\">...</body>"
}
\`\`\`

The DOM snapshot comes last because it is by far the largest field: putting the
diagnostics first means they survive any client-side truncation.

## Limits it enforces

| Limit | Value | Why |
| --- | --- | --- |
| DOM snapshot | 20,000 chars | Hard cap, with an in-band marker so the model knows the tree is partial. |
| Text node | 160 chars | Long body copy adds tokens but no layout signal. |
| Attribute | 300 chars | Kills base64 blobs and generated inline data. |
| Console entries | 40 | Per capture. |
| Console message | 600 chars | Per entry. |
| Failed requests | 20 | Deduplicated by URL and failure. |
| Navigation | 30s | Bounded so a hung page cannot hang the session. |

## It is read-only

The tool is annotated \`readOnlyHint\`. It observes a page: it cannot click,
hover, type, scroll, submit a form or reach a public host. That constraint
shapes every skill in the plugin — hover and \`:focus-visible\` styles are read
from the source rather than observed, and anything behind an interaction has to
be rendered by you first.

## Errors you can act on

Every failure comes back as a tool error carrying a code and a next step, never
a stack trace: \`INVALID_URL\`, \`CONNECTION_REFUSED\`, \`DNS_FAILURE\`,
\`UNSAFE_PORT\`, \`TIMEOUT\`, \`BROWSER_NOT_INSTALLED\`, \`BROWSER_LAUNCH_FAILED\`,
\`UNKNOWN\`. Each one is documented with its cause and fix in
[Troubleshooting](./TROUBLESHOOTING.md).

## Prompts that work well

\`\`\`text
Check localhost:3000 on mobile and tell me what breaks.
Look at localhost:5173/settings - the cards aren't aligned. Fix it.
Does localhost:3000/checkout throw anything in the console?
This page looks AI-generated. Tell me why, then fix the worst of it.
The accent is just default Tailwind blue - give me a real palette.
Compare localhost:3000 on desktop vs mobile and make the nav responsive.
\`\`\`
`;

// ------------------------------------------------------------------- build --

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// Static files. The site reuses the same assets the README does.
cpSync(join(repoRoot, "site", "styles.css"), join(outDir, "styles.css"));
cpSync(join(repoRoot, "site", "app.js"), join(outDir, "app.js"));
cpSync(join(repoRoot, "assets"), join(outDir, "assets"), { recursive: true });
// Tells GitHub Pages not to run the output through Jekyll.
writeFileSync(join(outDir, ".nojekyll"), "");

let built = 0;
/** Records for the client-side search: built here, so there is no runtime crawl. */
const searchIndex = [];

/** Strips tags and collapses whitespace so the index stores readable text. */
function toPlainText(html) {
  return html
    .replace(/<pre[\s\S]*?<\/pre>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

for (const page of allPages) {
  let html;

  if (page.kind === "home") {
    html = homePage(page);
  } else if (page.kind === "install" || page.kind === "tool") {
    // Hand-authored, but rendered through the same markdown pipeline so the
    // typography, tables and code blocks are identical to every other page.
    // Links are resolved as if the source lived in docs/.
    const source = page.kind === "install" ? INSTALL_MD : TOOL_MD;
    const { html: bodyHtml, outline } = renderMarkdown(source, "docs/_.md");
    html = shell({ page, body: bodyHtml, outline });
    searchIndex.push({
      u: url(page.out),
      t: page.title,
      g: groupOf(page.out),
      h: outline.map((entry) => ({ i: entry.id, t: entry.text })),
      b: toPlainText(bodyHtml).slice(0, 1600),
    });
  } else {
    const markdown = readFileSync(join(repoRoot, page.src), "utf8");
    // The h1 comes from the page title in the shell, so drop the document's own
    // leading h1 to avoid two competing headings.
    const withoutTitle = markdown.replace(/^#\s+.*\n+/, "");
    const { html: bodyHtml, outline, hasMermaid } = renderMarkdown(withoutTitle, page.src);
    html = shell({ page, body: bodyHtml, outline, hasMermaid });
    searchIndex.push({
      u: url(page.out),
      t: page.title,
      g: groupOf(page.out),
      h: outline.map((entry) => ({ i: entry.id, t: entry.text })),
      b: toPlainText(bodyHtml).slice(0, 1600),
    });
  }

  const target = join(outDir, page.out);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
  built += 1;
}

writeFileSync(join(outDir, "search-index.json"), JSON.stringify(searchIndex));
console.log(`search index: ${searchIndex.length} pages, ${(JSON.stringify(searchIndex).length / 1024).toFixed(0)} kB`);

// A 404 that keeps the reader inside the site.
writeFileSync(
  join(outDir, "404.html"),
  shell({
    page: { out: "404.html", title: "Page not found" },
    body: `<p>That page does not exist. Try the <a href="${url("index.html")}">introduction</a>,
      the <a href="${url("install.html")}">install guide</a>, or the
      <a href="${url("plugin.html")}">skill reference</a>.</p>`,
  }),
);

console.log(`built ${built} pages + 404 into ${relative(repoRoot, outDir)}/`);
console.log(`base path: ${BASE || "(root)"}`);
