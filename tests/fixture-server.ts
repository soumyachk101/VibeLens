/**
 * Test fixture: a tiny HTTP server that serves a deliberately messy page.
 *
 * The page intentionally contains every kind of noise VibeLens must handle:
 * inline scripts and styles, a console error and warning, an uncaught
 * exception, a broken image request, a base64 data URI, a huge SVG path, and a
 * long paragraph of text.
 */

import { createServer, type Server } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";

/** A recognizable Tailwind-ish class we assert survives sanitization. */
export const MARKER_CLASS = "flex-1 bg-red-500 px-4 py-2";

const LONG_BASE64 = "A".repeat(4000);
const LONG_SVG_PATH = `M0 0 ${"L10 10 ".repeat(500)}Z`;
const LONG_PARAGRAPH = "lorem ipsum dolor sit amet ".repeat(60);

export const FIXTURE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>VibeLens Fixture</title>
  <style>.secret-style-rule { color: rebeccapurple; }</style>
</head>
<body class="min-h-screen bg-white">
  <main id="main-content" class="mx-auto max-w-4xl">
    <h1 class="text-3xl font-bold">Pricing</h1>
    <button id="buy-now" class="${MARKER_CLASS}" data-testid="buy-now" aria-label="Buy now">Buy now</button>
    <p class="text-sm text-gray-500">${LONG_PARAGRAPH}</p>
    <img id="broken-image" class="h-10 w-10" src="/does-not-exist.png" alt="missing asset" />
    <img id="inline-image" class="h-10 w-10" src="data:image/png;base64,${LONG_BASE64}" alt="inline" />
    <svg id="chart" class="h-20 w-20" viewBox="0 0 100 100"><path d="${LONG_SVG_PATH}" /></svg>
    <!-- a comment that should be stripped -->
    <noscript>enable javascript</noscript>
  </main>
  <script>
    console.error("VIBELENS_TEST_CONSOLE_ERROR");
    console.warn("VIBELENS_TEST_CONSOLE_WARN");
    console.log("VIBELENS_TEST_CONSOLE_LOG");
    setTimeout(function () { throw new Error("VIBELENS_TEST_UNCAUGHT"); }, 10);
  </script>
</body>
</html>`;

export interface FixtureServer {
  url: string;
  port: number;
  close: () => Promise<void>;
}

/** Starts the fixture server on an ephemeral port. */
export async function startFixtureServer(html = FIXTURE_HTML): Promise<FixtureServer> {
  const server: Server = createServer((req, res) => {
    if (req.url === "/does-not-exist.png") {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const { port } = server.address() as AddressInfo;

  return {
    port,
    // 127.0.0.1 rather than "localhost": on macOS "localhost" can resolve to
    // ::1 first, which this server (bound to IPv4) would refuse.
    url: `http://127.0.0.1:${port}/`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

/** Finds a TCP port that is guaranteed to be closed, for refusal tests. */
export async function findClosedPort(): Promise<number> {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}
