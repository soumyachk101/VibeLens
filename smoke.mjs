/**
 * Temporary verification: spawn dist/index.js as a real child process and talk
 * to it over stdio exactly as an IDE would.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createServer } from "node:http";
import { once } from "node:events";

const html = `<!doctype html><html><head><title>Stdio Smoke</title></head>
<body class="bg-slate-50"><div id="card" class="rounded-xl p-6 shadow-lg">
<button id="cta" class="bg-blue-600 px-4 py-2 text-white">Get started</button></div>
<script>console.error("SMOKE_ERROR");</script></body></html>`;

const fixture = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/html" });
  res.end(html);
});
fixture.listen(0, "127.0.0.1");
await once(fixture, "listening");
const port = fixture.address().port;

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  stderr: "pipe",
});
const client = new Client({ name: "smoke", version: "1.0.0" });
await client.connect(transport);
console.log("connected. server:", JSON.stringify(client.getServerVersion()));
console.log("instructions:", (client.getInstructions() ?? "").slice(0, 60), "...");

const { tools } = await client.listTools();
console.log("tools/list:", tools.map((t) => t.name).join(", "));
console.log("required:", JSON.stringify(tools[0].inputSchema.required));

const ok = await client.callTool({
  name: "inspect_localhost_ui",
  arguments: { url: `http://127.0.0.1:${port}/`, viewport: "mobile", delay: 200 },
});
const [image, text] = ok.content;
console.log("tools/call blocks:", ok.content.map((c) => c.type).join(" + "));
console.log("image mime:", image.mimeType, "base64 len:", image.data.length);
const payload = JSON.parse(text.text);
console.log("summary:", JSON.stringify(payload.summary));
console.log("dom head:", payload.simplifiedDOM.slice(0, 140));

const bad = await client.callTool({
  name: "inspect_localhost_ui",
  arguments: { url: "http://169.254.169.254/latest/meta-data/" },
});
console.log("blocked isError:", bad.isError);
console.log("blocked text:", bad.content[0].text.split("\n")[0]);

const down = await client.callTool({
  name: "inspect_localhost_ui",
  arguments: { url: "http://127.0.0.1:1/", delay: 0 },
});
console.log("down isError:", down.isError, "|", down.content[0].text.replace(/\n+/g, " ").slice(0, 150));

await client.close();
await new Promise((r) => fixture.close(r));
console.log("STDIO SMOKE OK");
