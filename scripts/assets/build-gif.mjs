#!/usr/bin/env node
/**
 * Builds assets/demo.gif from the frames produced by capture-demo.mjs.
 *
 * Each frame is an HTML card that embeds the real JPEG returned by
 * `inspect_localhost_ui` plus real lines from its text payload. The frame is
 * then rendered with Playwright and the sequence is assembled by ffmpeg.
 *
 * Usage:
 *   npm run build
 *   node scripts/assets/capture-demo.mjs
 *   node scripts/assets/build-gif.mjs
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "out");
const assetsDir = join(here, "..", "..", "assets");
mkdirSync(outDir, { recursive: true });
mkdirSync(assetsDir, { recursive: true });

const b64 = (name) => readFileSync(join(outDir, name)).toString("base64");
const before = b64("before.jpg");
const after = b64("after.jpg");
const beforePayload = JSON.parse(readFileSync(join(outDir, "before.json"), "utf8"));

const consoleLine =
  beforePayload.consoleErrors[0]?.text.slice(0, 96) ?? "(no console error captured)";
const failedLine = beforePayload.failedRequests[0]
  ? `${beforePayload.failedRequests[0].failure}  ${new URL(beforePayload.failedRequests[0].url).pathname}`
  : "(no failed request captured)";

const WIDTH = 1000;
const HEIGHT = 545;

/** Shared chrome: dark card, fake-but-honest browser bar, cropped screenshot. */
function frame({ shot, role, title, body, badge }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden;
    background: radial-gradient(120% 120% at 12% 0%, #16223c 0%, #0b1120 55%, #080d18 100%);
    font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
    color: #e2e8f0; padding: 26px 30px; display: flex; flex-direction: column; gap: 16px;
  }
  .top { display: flex; align-items: center; gap: 10px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; }
  .brand { font-size: 13px; font-weight: 700; letter-spacing: .14em; color: #7dd3fc; text-transform: uppercase; }
  .badge { margin-left: auto; font-size: 12px; font-weight: 600; padding: 4px 11px; border-radius: 999px;
           border: 1px solid rgba(125,211,252,.35); color: #7dd3fc; background: rgba(125,211,252,.08); }
  .badge.ok { border-color: rgba(52,211,153,.4); color: #34d399; background: rgba(52,211,153,.09); }
  .badge.bad { border-color: rgba(248,113,113,.4); color: #f87171; background: rgba(248,113,113,.09); }
  .line { display: flex; align-items: baseline; gap: 9px; font-size: 16px; }
  .role { font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
          color: #64748b; min-width: 34px; }
  .role.ai { color: #a78bfa; }
  .title { color: #f1f5f9; }
  .shot { position: relative; border-radius: 12px; overflow: hidden;
          border: 1px solid rgba(148,163,184,.18); box-shadow: 0 22px 50px -30px rgba(0,0,0,.9); }
  .bar { height: 30px; background: #1e293b; display: flex; align-items: center; gap: 6px; padding: 0 11px; }
  .bar .u { font: 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace; color: #94a3b8;
            background: #0f172a; padding: 5px 9px; border-radius: 5px; }
  /* The capture is 1920x1080. Scale it to 0.86 and offset so the three pricing
     cards sit centred in the frame. */
  .viewport { height: 300px; background-repeat: no-repeat; background-color: #f1f5f9;
              background-size: 1651px auto; background-position: -356px -315px; }
  .panel { font: 12.5px/1.7 ui-monospace, SFMono-Regular, Menlo, monospace;
           background: rgba(15,23,42,.72); border: 1px solid rgba(148,163,184,.16);
           border-radius: 10px; padding: 12px 14px; color: #94a3b8; }
  .panel b { color: #e2e8f0; font-weight: 600; }
  .k { color: #7dd3fc; }
  .err { color: #f87171; }
  .add { color: #34d399; }
  .del { color: #f87171; }
</style></head><body>
  <div class="top">
    <span class="dot" style="background:#22d3ee"></span>
    <span class="dot" style="background:#a78bfa"></span>
    <span class="brand">VibeLens</span>
    ${badge ? `<span class="badge ${badge.tone}">${badge.text}</span>` : ""}
  </div>
  <div class="line"><span class="role ${role === "AI" ? "ai" : ""}">${role}</span><span class="title">${title}</span></div>
  <div class="shot">
    <div class="bar"><span class="dot" style="background:#f87171"></span><span class="dot" style="background:#fbbf24"></span><span class="dot" style="background:#34d399"></span><span class="u">http://localhost:3000/health</span></div>
    <div class="viewport" style="background-image:url(data:image/jpeg;base64,${shot})"></div>
  </div>
  <div class="panel">${body}</div>
</body></html>`;
}

const frames = [
  {
    ms: 2600,
    html: frame({
      shot: before,
      role: "You",
      title: "“Check localhost:3000/health — the latency card's button looks wrong.”",
      badge: { tone: "", text: "1 tool call" },
      body: `<b>inspect_localhost_ui</b> { <span class="k">url</span>: "http://localhost:3000/health", <span class="k">viewport</span>: "desktop" }`,
    }),
  },
  {
    ms: 3400,
    html: frame({
      shot: before,
      role: "AI",
      title: "Screenshot: the primary button breaks out of its card on the right.",
      badge: { tone: "bad", text: "1 console error · 1 failed request" },
      body: `<span class="err">console.error</span> ${consoleLine}<br><span class="err">${failedLine}</span>`,
    }),
  },
  {
    ms: 3600,
    html: frame({
      shot: before,
      role: "AI",
      title: "The DOM says which element and which classes — no guessing.",
      badge: { tone: "", text: `simplifiedDOM · ${beforePayload.summary.domChars} chars` },
      body: `&lt;button <span class="k">id</span>="btn-latency" <span class="k">class</span>="btn" <span class="k">data-testid</span>="btn-latency"&gt;<br><span class="del">- width: 302px; margin-left: -20px;</span>  <span style="color:#64748b">/* wider than the 264px card */</span>`,
    }),
  },
  {
    ms: 3400,
    html: frame({
      shot: after,
      role: "AI",
      title: "Re-captured after the fix — verified, not assumed.",
      badge: { tone: "ok", text: "aligned · console clean" },
      body: `<span class="add">+ width: 100%; margin-left: 0;</span><br><b>consoleErrors</b>: 0   <b>uncaughtPageErrors</b>: 0   <b>captureMs</b>: ${beforePayload.summary.durationMs}`,
    }),
  },
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
  });

  const concat = [];
  for (const [i, f] of frames.entries()) {
    await page.setContent(f.html, { waitUntil: "load" });
    const file = join(outDir, `frame-${String(i).padStart(2, "0")}.png`);
    await page.screenshot({ path: file });
    concat.push(`file '${file}'`, `duration ${(f.ms / 1000).toFixed(2)}`);
    console.log(`rendered ${file}`);
  }
  // ffmpeg's concat demuxer ignores the duration of the final entry unless the
  // file is repeated, so repeat it.
  concat.push(`file '${join(outDir, `frame-${String(frames.length - 1).padStart(2, "0")}.png`)}'`);
  const listFile = join(outDir, "frames.txt");
  writeFileSync(listFile, `${concat.join("\n")}\n`);

  const gif = join(assetsDir, "demo.gif");
  execFileSync(
    "ffmpeg",
    [
      "-y", "-loglevel", "error",
      "-f", "concat", "-safe", "0", "-i", listFile,
      "-vf",
      "fps=12,scale=900:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle",
      "-loop", "0",
      gif,
    ],
    { stdio: "inherit" },
  );
  console.log(`wrote ${gif}`);
} finally {
  await browser.close();
}
