#!/usr/bin/env node
/**
 * Release smoke test.
 *
 * Spawns the *built* server (`dist/index.js`) as a real child process and talks
 * to it over stdio exactly as an IDE would: initialize → tools/list →
 * tools/call. This catches packaging problems the unit tests cannot, such as a
 * broken shebang, a bad import path in dist/, or a stray stdout write.
 *
 * Exits non-zero on any failure.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { once } from "node:events";
import { createServer } from "node:http";

const HTML = `<!doctype html><html><head><title>VibeLens Smoke</title></head>
<body class="bg-slate-50"><div id="card" class="rounded-xl p-6 shadow-lg">
<button id="cta" class="bg-blue-600 px-4 py-2 text-white">Get started</button></div>
<script>console.error("SMOKE_CONSOLE_ERROR");</script></body></html>`;

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
    throw new Error(message);
  }
  console.log(`ok — ${message}`);
}

const fixture = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(HTML);
});
fixture.listen(0, "127.0.0.1");
await once(fixture, "listening");
const { port } = fixture.address();
const url = `http://127.0.0.1:${port}/`;

const client = new Client({ name: "vibelens-smoke", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/index.js"],
  stderr: "pipe",
});

try {
  await client.connect(transport);
  assert(true, "connected to dist/index.js over stdio");

  const { tools } = await client.listTools();
  assert(tools.length === 1, "exposes exactly one tool");
  assert(tools[0].name === "inspect_localhost_ui", "tool is inspect_localhost_ui");
  assert(
    JSON.stringify(tools[0].inputSchema.required) === '["url"]',
    "only `url` is required",
  );

  const ok = await client.callTool({
    name: "inspect_localhost_ui",
    arguments: { url, viewport: "mobile", delay: 200 },
  });
  assert(!ok.isError, "capture succeeded");
  assert(ok.content.length === 2, "returned two content blocks");
  assert(ok.content[0].type === "image", "first block is the image");
  assert(ok.content[1].type === "text", "second block is the text payload");

  const jpeg = Buffer.from(ok.content[0].data, "base64");
  assert(
    jpeg[0] === 0xff && jpeg[1] === 0xd8 && jpeg[2] === 0xff,
    "image data is a real JPEG",
  );

  const payload = JSON.parse(ok.content[1].text);
  assert(payload.summary.pageTitle === "VibeLens Smoke", "page title captured");
  assert(payload.summary.consoleErrors >= 1, "console error captured");
  assert(payload.simplifiedDOM.includes('id="cta"'), "DOM keeps element ids");
  assert(payload.simplifiedDOM.includes("bg-blue-600"), "DOM keeps utility classes");
  assert(!payload.simplifiedDOM.includes("<script"), "DOM strips scripts");

  const blocked = await client.callTool({
    name: "inspect_localhost_ui",
    arguments: { url: "http://169.254.169.254/latest/meta-data/" },
  });
  assert(blocked.isError === true, "metadata endpoint is refused");
  assert(
    blocked.content[0].text.includes("INVALID_URL"),
    "refusal names the INVALID_URL code",
  );

  const stillAlive = await client.callTool({
    name: "inspect_localhost_ui",
    arguments: { url, delay: 0 },
  });
  assert(!stillAlive.isError, "server still healthy after a refused call");

  console.log("\nSMOKE OK");
} finally {
  await client.close().catch(() => {});
  await new Promise((resolve) => fixture.close(resolve));
}
