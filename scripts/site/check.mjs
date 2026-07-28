#!/usr/bin/env node
/**
 * Builds the site for local serving, then verifies it two ways:
 *
 *   1. Statically: every internal link, image, stylesheet and script target
 *      must exist in the build output.
 *   2. Dynamically: VibeLens inspects its own documentation site. Any console
 *      error or failed request on our own pages is a defect, and the captures
 *      are written out so the design can be reviewed the same way the plugin
 *      reviews anyone else's UI.
 *
 * Usage: node scripts/site/build.mjs && node scripts/site/check.mjs
 * Exits non-zero if a link is broken or a page reports a console error.
 */

import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const outDir = join(repoRoot, "site-dist");
const shotDir = join(repoRoot, "scripts", "assets", "out");

let failures = 0;
const fail = (message) => {
  console.error(`FAIL: ${message}`);
  failures += 1;
};
const ok = (message) => console.log(`ok — ${message}`);

// Rebuild without a base path so the output can be served from /.
execFileSync(process.execPath, [join(here, "build.mjs")], { cwd: repoRoot, stdio: "inherit" });

// ---------------------------------------------------------- 1. link check --

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const files = walk(outDir);
const htmlFiles = files.filter((f) => f.endsWith(".html"));
const relativeSet = new Set(files.map((f) => posix.normalize(f.slice(outDir.length + 1))));

let linkCount = 0;
for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const pageDir = posix.dirname(file.slice(outDir.length + 1));

  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = match[1];
    if (/^(https?:|mailto:|data:|#)/.test(target)) continue;
    linkCount += 1;

    const [pathPart] = target.split("#");
    if (!pathPart) continue;

    // Site-absolute links start with / because the build emits them that way.
    let candidate = pathPart.startsWith("/")
      ? pathPart.slice(1)
      : posix.normalize(posix.join(pageDir === "." ? "" : pageDir, pathPart));
    if (candidate === "" || candidate.endsWith("/")) candidate += "index.html";

    if (!relativeSet.has(candidate)) {
      fail(`${file.slice(outDir.length + 1)} links to missing ${candidate}`);
    }
  }
}
ok(`${linkCount} internal links across ${htmlFiles.length} pages all resolve`);

// Sanity checks that catch template regressions rather than content mistakes.
const home = readFileSync(join(outDir, "index.html"), "utf8");
if (!home.includes('class="skip-link"')) fail("home page lost its skip link");
if (!home.includes("prefers-color-scheme")) fail("home page lost the no-flash theme script");
for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  const name = file.slice(outDir.length + 1);
  if (!/<html lang="en"/.test(html)) fail(`${name} has no lang attribute`);
  if (!/<meta name="viewport"/.test(html)) fail(`${name} has no viewport meta`);
  if (/<title><\/title>/.test(html)) fail(`${name} has an empty title`);
  if (/<img (?![^>]*\balt=)/.test(html)) fail(`${name} has an img without alt`);
}
ok("every page has lang, viewport, a title, and alt text on every image");

// ------------------------------------------------- 2. inspect it with VibeLens --

if (!existsSync(join(repoRoot, "dist", "browser.js"))) {
  console.error("dist/ not built; run npm run build first");
  process.exit(1);
}
const { captureUIState } = await import(join(repoRoot, "dist", "browser.js"));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};

const server = createServer((req, res) => {
  const requested = decodeURIComponent((req.url ?? "/").split("?")[0]);
  let filePath = join(outDir, requested);
  try {
    if (statSync(filePath).isDirectory()) filePath = join(filePath, "index.html");
  } catch {
    // fall through to the 404 below
  }
  if (!filePath.startsWith(outDir) || !existsSync(filePath)) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
    return;
  }
  res.writeHead(200, { "content-type": MIME[extname(filePath)] ?? "application/octet-stream" });
  createReadStream(filePath).pipe(res);
});

server.listen(0, "127.0.0.1");
await once(server, "listening");
const { port } = server.address();
const origin = `http://127.0.0.1:${port}`;

mkdirSync(shotDir, { recursive: true });

const targets = [
  { path: "/", viewport: "desktop", name: "home-desktop", fullPage: true },
  { path: "/", viewport: "mobile", name: "home-mobile", fullPage: false },
  { path: "/design/anti-slop.html", viewport: "desktop", name: "docs-desktop", fullPage: false },
  { path: "/architecture.html", viewport: "desktop", name: "architecture-desktop", fullPage: false },
  { path: "/install.html", viewport: "mobile", name: "install-mobile", fullPage: false },
];

try {
  for (const target of targets) {
    const result = await captureUIState({
      url: `${origin}${target.path}`,
      viewport: target.viewport,
      fullPage: target.fullPage,
      delay: 500,
    });

    writeFileSync(join(shotDir, `site-${target.name}.jpg`), Buffer.from(result.imageBase64, "base64"));

    const errors = result.consoleLogs.filter((entry) => entry.level === "error");
    // Mermaid loads from a CDN, so a sandboxed or offline run legitimately
    // fails that one request; everything else is our bug.
    const realFailures = result.failedRequests.filter((r) => !r.url.includes("cdn.jsdelivr.net"));

    const label = `${target.name.padEnd(22)} ${String(result.meta.screenshotBytes).padStart(7)} B`;
    if (errors.length > 0 || result.pageErrors.length > 0 || realFailures.length > 0) {
      fail(
        `${label} — ${errors.length} console errors, ${result.pageErrors.length} page errors, ` +
          `${realFailures.length} failed requests: ` +
          JSON.stringify([...errors.map((e) => e.text), ...result.pageErrors, ...realFailures.map((r) => `${r.failure} ${r.url}`)]).slice(0, 400),
      );
    } else {
      console.log(`ok — ${label} clean (title "${result.meta.pageTitle}")`);
    }
  }
} finally {
  await new Promise((r) => server.close(r));
}

if (failures > 0) {
  console.error(`\nSITE CHECK FAILED (${failures} problem${failures === 1 ? "" : "s"})`);
  process.exit(1);
}
console.log(`\nSITE OK — captures in scripts/assets/out/site-*.jpg`);
