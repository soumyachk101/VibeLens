#!/usr/bin/env node
/**
 * Generates the raw frames for the README animation by running VibeLens against
 * a local demo page.
 *
 * Everything this writes is a real `inspect_localhost_ui` result: the images are
 * the tool's own JPEG output and the JSON beside them is the tool's own text
 * payload. Nothing here is a mockup.
 *
 * Usage: npm run build && node scripts/assets/capture-demo.mjs
 * Output: scripts/assets/out/{before,after}.jpg and {before,after}.json
 */

import { once } from "node:events";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { captureUIState } from "../../dist/browser.js";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "out");
mkdirSync(outDir, { recursive: true });

const html = readFileSync(join(here, "demo-page.html"), "utf8");

// Serves the demo page and deliberately 404s the asset it references, so the
// capture's `failedRequests` array is populated for real.
const server = createServer((req, res) => {
  if ((req.url ?? "").startsWith("/badge-secure.png")) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
});

server.listen(0, "127.0.0.1");
await once(server, "listening");
const { port } = server.address();

const shots = [
  { name: "before", path: "/" },
  { name: "after", path: "/?fixed=1" },
];

try {
  for (const shot of shots) {
    const result = await captureUIState({
      url: `http://127.0.0.1:${port}${shot.path}`,
      viewport: "desktop",
      delay: 400,
    });

    writeFileSync(join(outDir, `${shot.name}.jpg`), Buffer.from(result.imageBase64, "base64"));
    writeFileSync(
      join(outDir, `${shot.name}.json`),
      JSON.stringify(
        {
          summary: result.meta,
          consoleErrors: result.consoleLogs.filter((l) => l.level === "error"),
          failedRequests: result.failedRequests,
          simplifiedDOM: result.simplifiedDOM,
        },
        null,
        2,
      ),
    );

    console.log(
      `${shot.name}: ${result.meta.screenshotBytes} B jpeg, ` +
        `${result.consoleLogs.length} console entries, ` +
        `${result.failedRequests.length} failed requests, ` +
        `${result.meta.domChars} dom chars`,
    );
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log(`frames written to ${outDir}`);
