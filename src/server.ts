/**
 * VibeLens — MCP server definition.
 *
 * Exposes a single tool, `inspect_localhost_ui`. The tool gives an AI coding
 * assistant three things at once:
 *
 *   1. a screenshot        → so it can *see* the layout,
 *   2. console + network   → so it catches errors a screenshot cannot show,
 *   3. a sanitized DOM     → so it edits a class that actually exists,
 *                            instead of hallucinating one.
 *
 * This module has no side effects on import; `index.ts` is the executable
 * entrypoint that wires it to stdio.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { captureUIState } from "./browser.js";
import { CaptureError, LIMITS, type CaptureResult, type ViewportName } from "./types.js";

export const SERVER_NAME = "vibelens";
export const SERVER_VERSION = "1.0.0";
export const TOOL_NAME = "inspect_localhost_ui";

/**
 * Diagnostics helper.
 *
 * stdout is the MCP transport — writing anything but protocol frames there
 * corrupts the session, so every log line goes to stderr.
 */
export function log(message: string): void {
  process.stderr.write(`[vibelens] ${message}\n`);
}

const TOOL_DESCRIPTION = [
  "Gives you eyes on a locally running web app. Opens the URL in a headless",
  "Chromium browser and returns (1) a screenshot of the rendered page, (2) any",
  "console errors/warnings and failed network requests, and (3) a token-optimized",
  "DOM snapshot that preserves ids and CSS/Tailwind classes.",
  "",
  "Use it to verify or debug UI work instead of guessing: layout and alignment",
  "bugs, overflow, spacing, responsive breakpoints, hydration errors and missing",
  "assets. Read the classes in the DOM snapshot before proposing a fix so you",
  "edit real selectors. Only local addresses (localhost / private network) are",
  "permitted.",
].join(" ");

/**
 * Tool input. Kept deliberately small: one required string plus three bounded,
 * defaulted options is the shape LLMs get right on the first attempt.
 */
export const inputSchema = {
  url: z
    .string()
    .describe(
      "Local URL to inspect, e.g. http://localhost:3000 or http://localhost:5173/dashboard. Must be localhost, 127.0.0.1, or a private-network address.",
    ),
  viewport: z
    .enum(["desktop", "tablet", "mobile"])
    .default("desktop")
    .describe(
      "Viewport to emulate: desktop (1920x1080), tablet (820x1180) or mobile (390x844). Use mobile to debug responsive layouts.",
    ),
  delay: z
    .number()
    .int()
    .min(0)
    .max(LIMITS.MAX_DELAY_MS)
    .default(1000)
    .describe(
      "Milliseconds to wait after page load before capturing, to allow hydration, animations or data fetching to finish.",
    ),
  fullPage: z
    .boolean()
    .default(false)
    .describe(
      "Capture the entire scrollable page instead of just the viewport. Useful for long landing pages; produces a taller image.",
    ),
};

/** Builds the text half of the response: everything the image cannot convey. */
export function buildTextPayload(result: CaptureResult): string {
  const payload = {
    summary: {
      url: result.meta.finalUrl,
      pageTitle: result.meta.pageTitle,
      viewport: `${result.meta.viewport} (${result.meta.viewportSize.width}x${result.meta.viewportSize.height})`,
      fullPage: result.meta.fullPage,
      waitedMs: result.meta.delayMs,
      captureMs: result.meta.durationMs,
      consoleErrors: result.consoleLogs.filter((entry) => entry.level === "error").length,
      consoleWarnings: result.consoleLogs.filter((entry) => entry.level === "warning").length,
      uncaughtPageErrors: result.pageErrors.length,
      failedRequests: result.failedRequests.length,
      domTruncated: result.meta.domTruncated,
    },
    consoleLogs: result.consoleLogs,
    uncaughtPageErrors: result.pageErrors,
    failedRequests: result.failedRequests,
    // Kept last: it is by far the largest field, so diagnostics survive any
    // client-side truncation.
    simplifiedDOM: result.simplifiedDOM,
  };

  return JSON.stringify(payload, null, 2);
}

/** Formats a failure as a response the model can act on, not a stack trace. */
export function buildErrorPayload(error: unknown): string {
  if (error instanceof CaptureError) {
    return [
      `VibeLens could not inspect the page (${error.code}).`,
      "",
      `Problem: ${error.message}`,
      `Next step: ${error.hint}`,
    ].join("\n");
  }

  const message = error instanceof Error ? error.message : String(error);
  return [
    "VibeLens hit an unexpected error (UNKNOWN).",
    "",
    `Problem: ${message}`,
    "Next step: Retry the call. If it keeps failing, report this message to the user.",
  ].join("\n");
}

/** Creates a configured, not-yet-connected MCP server. */
export function createServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "VibeLens lets you see a locally running web app. Call inspect_localhost_ui with the dev-server URL before and after making UI changes, and base fixes on the classes in the returned DOM snapshot rather than assumptions.",
    },
  );

  server.registerTool(
    TOOL_NAME,
    {
      title: "Inspect localhost UI",
      description: TOOL_DESCRIPTION,
      inputSchema,
      annotations: {
        // Read-only: it observes the page, it never mutates the user's project.
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      const { url, viewport, delay, fullPage } = args as {
        url: string;
        viewport: ViewportName;
        delay: number;
        fullPage: boolean;
      };

      log(`${TOOL_NAME} url=${url} viewport=${viewport} delay=${delay} fullPage=${fullPage}`);

      try {
        const result = await captureUIState({ url, viewport, delay, fullPage });

        log(
          `captured ${result.meta.screenshotBytes}B jpeg, ${result.meta.domChars} dom chars, ` +
            `${result.consoleLogs.length} console entries in ${result.meta.durationMs}ms`,
        );

        return {
          content: [
            // Image first: the model's vision pass anchors on it.
            {
              type: "image" as const,
              data: result.imageBase64,
              mimeType: result.mimeType,
            },
            {
              type: "text" as const,
              text: buildTextPayload(result),
            },
          ],
        };
      } catch (error) {
        // A failed capture must never take the server down: report and continue.
        log(`capture failed: ${error instanceof Error ? error.message : String(error)}`);
        return {
          isError: true,
          content: [{ type: "text" as const, text: buildErrorPayload(error) }],
        };
      }
    },
  );

  return server;
}
