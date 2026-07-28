#!/usr/bin/env node
/**
 * Reproduces the DOM-reduction figure quoted in README.md and assets/dom-budget.svg.
 *
 * Builds a page carrying the noise a real app carries -- a framework style
 * block, an inline script bundle, base64 images, icon sprites with long path
 * data, and body copy -- then reports the raw DOM size against what VibeLens
 * actually hands the model.
 *
 * Usage: npm run build && node scripts/assets/measure-dom.mjs
 */

import { createServer } from "node:http";
import { once } from "node:events";

import { chromium } from "playwright";

import { sanitizeDomInPage, truncateDom } from "../../dist/dom.js";
import { LIMITS } from "../../dist/types.js";

const base64Blob = "A".repeat(6000);
const iconPath = `M0 0 ${"L10 10 ".repeat(600)}Z`;
const bodyCopy = "lorem ipsum dolor sit amet consectetur adipiscing elit ".repeat(90);

const cards = Array.from({ length: 12 }, (_, i) => `
  <article class="group relative flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md" data-testid="row-${i}">
    <h3 class="text-base font-semibold tracking-tight text-slate-900">Item ${i}</h3>
    <p class="text-sm leading-6 text-slate-500">${bodyCopy}</p>
    <img class="h-10 w-10 rounded" src="data:image/png;base64,${base64Blob}" alt="thumb ${i}" />
    <svg class="h-5 w-5 text-slate-400" viewBox="0 0 24 24"><path d="${iconPath}"/></svg>
    <button id="cta-${i}" class="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Open</button>
  </article>`).join("");

const html = `<!doctype html><html><head><title>DOM budget</title>
<style>${".x{color:red}".repeat(400)}</style></head>
<body class="min-h-screen bg-slate-50"><main id="app" class="mx-auto max-w-5xl p-8">${cards}</main>
<script>${"var a=1;".repeat(500)}</script></body></html>`;

const server = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const { port } = server.address();

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);

  const rawDocument = await page.evaluate(() => document.documentElement.outerHTML.length);
  const rawBody = await page.evaluate(() => document.body.outerHTML.length);
  const sanitized = await page.evaluate(sanitizeDomInPage, {
    maxTextLength: LIMITS.MAX_TEXT_LENGTH,
    maxAttrLength: LIMITS.MAX_ATTR_LENGTH,
  });
  const { dom, truncated } = truncateDom(sanitized, LIMITS.MAX_DOM_CHARS);

  const rows = [
    ["raw document.documentElement", rawDocument],
    ["raw document.body", rawBody],
    ["sanitized", sanitized.length],
    [`after the ${LIMITS.MAX_DOM_CHARS}-char cap`, dom.length],
  ];
  for (const [label, value] of rows) {
    console.log(`${label.padEnd(32)} ${String(value).padStart(8)} chars`);
  }
  console.log(`${"reduction vs raw body".padEnd(32)} ${(100 - (dom.length / rawBody) * 100).toFixed(1)}%`);
  console.log(`${"truncated".padEnd(32)} ${truncated}`);

  // The point of the exercise: the noise is gone, the selectors are not.
  console.log("\nsignal preserved:");
  console.log("  utility classes kept   ", /bg-indigo-600/.test(dom));
  console.log("  ids kept               ", /id="cta-0"/.test(dom));
  console.log("  test hooks kept        ", /data-testid="row-0"/.test(dom));
  console.log("  base64 stripped        ", !/AAAAAAAA/.test(dom));
  console.log("  svg path data stripped ", !/L10 10 L10 10/.test(dom));
  console.log("  script/style stripped  ", !/<script|<style/.test(dom));
} finally {
  await browser.close();
  server.close();
}
