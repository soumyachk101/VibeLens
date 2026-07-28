/**
 * VibeLens — the browser engine.
 *
 * Owns a short-lived, headless Chromium instance: navigate, observe, capture,
 * tear down. The instance is always disposed in a `finally` block; leaking a
 * Chromium process from a long-running MCP server would pile up hundreds of MB
 * of RSS per call (very visible on Apple Silicon laptops).
 */

import { chromium, type Browser, type ConsoleMessage, type Page } from "playwright";

import { sanitizeDomInPage, truncateDom } from "./dom.js";
import { validateLocalUrl } from "./security.js";
import {
  CaptureError,
  LIMITS,
  SCREENSHOT,
  VIEWPORT_PRESETS,
  type CaptureOptions,
  type CaptureResult,
  type ConsoleEntry,
  type FailedRequest,
  type ViewportName,
} from "./types.js";

/** Clamps the AI-supplied delay into a sane range. */
function normalizeDelay(delay: number | undefined): number {
  if (typeof delay !== "number" || Number.isNaN(delay)) return 1000;
  return Math.min(Math.max(Math.trunc(delay), 0), LIMITS.MAX_DELAY_MS);
}

/** Turns a raw Playwright/Chromium failure into an actionable CaptureError. */
function toCaptureError(error: unknown, url: string): CaptureError {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("ERR_CONNECTION_REFUSED") || message.includes("ECONNREFUSED")) {
    return new CaptureError(
      "CONNECTION_REFUSED",
      `Connection refused at ${url}.`,
      "The dev server does not appear to be running (or is on a different port). Ask the user to start it, then retry.",
    );
  }

  if (message.includes("ERR_NAME_NOT_RESOLVED")) {
    return new CaptureError(
      "DNS_FAILURE",
      `Host for ${url} could not be resolved.`,
      "Check the hostname. VibeLens only reaches localhost and private-network addresses.",
    );
  }

  if (message.includes("ERR_EMPTY_RESPONSE") || message.includes("ERR_CONNECTION_RESET")) {
    return new CaptureError(
      "CONNECTION_REFUSED",
      `The server at ${url} closed the connection without responding.`,
      "The dev server may still be compiling or may have crashed. Check its terminal output and retry.",
    );
  }

  if (message.includes("ERR_UNSAFE_PORT")) {
    return new CaptureError(
      "UNSAFE_PORT",
      `Chromium refuses to connect to ${url} because that port is on its blocked list.`,
      "Chromium blocks a fixed set of ports (1, 7, 69, 79, 6000, 6666, ...). Ask the user to run the dev server on a normal port such as 3000, 5173 or 8080.",
    );
  }

  if (message.includes("Timeout") || message.includes("timeout")) {
    return new CaptureError(
      "TIMEOUT",
      `Timed out loading ${url}.`,
      "The page never finished loading. It may be stuck on a slow request; try again or increase `delay`.",
    );
  }

  return new CaptureError("UNKNOWN", `Capture failed: ${message}`, "Retry once; if it persists, report the message above.");
}

/** Launches Chromium, mapping the "browser binary missing" case explicitly. */
async function launchBrowser(): Promise<Browser> {
  try {
    return await chromium.launch({
      headless: true,
      timeout: LIMITS.LAUNCH_TIMEOUT_MS,
      // /dev/shm is small in containers; without this Chromium can crash.
      args: ["--disable-dev-shm-usage", "--hide-scrollbars"],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("Executable doesn't exist") ||
      message.includes("please run the following command") ||
      message.includes("browserType.launch: Failed to launch")
    ) {
      throw new CaptureError(
        "BROWSER_NOT_INSTALLED",
        "Chromium is not installed for Playwright.",
        "Tell the user to run: npx playwright install chromium",
      );
    }
    throw new CaptureError("BROWSER_LAUNCH_FAILED", `Could not launch Chromium: ${message}`, "Verify Playwright is installed correctly.");
  }
}

/** Formats a console message, keeping its source location when available. */
function formatConsoleMessage(message: ConsoleMessage): ConsoleEntry {
  const location = message.location();
  const level = message.type() === "error" ? "error" : "warning";
  const entry: ConsoleEntry = {
    level,
    text: message.text().slice(0, LIMITS.MAX_CONSOLE_LENGTH),
  };
  if (location?.url) {
    entry.location = `${location.url}:${location.lineNumber}:${location.columnNumber}`;
  }
  return entry;
}

/**
 * Captures the visual + structural state of a local page.
 *
 * @throws {CaptureError} for every expected failure mode (bad URL, dev server
 *         down, missing browser, timeout) so the MCP layer can respond with
 *         guidance instead of crashing.
 */
export async function captureUIState(options: CaptureOptions): Promise<CaptureResult> {
  const startedAt = Date.now();

  // 1. Security gate — before we launch anything.
  const validation = validateLocalUrl(options.url);
  if (!validation.ok) {
    throw new CaptureError(
      "INVALID_URL",
      validation.reason,
      "VibeLens is restricted to local addresses to prevent SSRF. Pass a localhost URL such as http://localhost:3000.",
    );
  }

  const targetUrl = validation.url.toString();
  const viewportName: ViewportName = options.viewport ?? "desktop";
  const preset = VIEWPORT_PRESETS[viewportName] ?? VIEWPORT_PRESETS.desktop;
  const delayMs = normalizeDelay(options.delay);
  const fullPage = options.fullPage ?? false;

  const consoleLogs: ConsoleEntry[] = [];
  const pageErrors: string[] = [];
  const failedRequests: FailedRequest[] = [];

  let browser: Browser | undefined;

  try {
    browser = await launchBrowser();

    const context = await browser.newContext({
      viewport: { width: preset.width, height: preset.height },
      deviceScaleFactor: preset.deviceScaleFactor,
      isMobile: preset.isMobile,
      hasTouch: preset.isMobile,
      // Deterministic captures: disable animations that would otherwise make
      // screenshots differ between runs is left to the caller's `delay`, but we
      // do pin a stable locale/timezone.
      locale: "en-US",
      timezoneId: "UTC",
    });

    const page: Page = await context.newPage();

    // 2. Attach observers BEFORE navigating, or early errors are missed.
    page.on("console", (message) => {
      const type = message.type();
      if (type !== "error" && type !== "warning") return;
      if (consoleLogs.length >= LIMITS.MAX_CONSOLE_ENTRIES) return;
      consoleLogs.push(formatConsoleMessage(message));
    });

    page.on("pageerror", (error) => {
      if (pageErrors.length >= LIMITS.MAX_CONSOLE_ENTRIES) return;
      pageErrors.push(`${error.name}: ${error.message}`.slice(0, LIMITS.MAX_CONSOLE_LENGTH));
    });

    // Network problems the screenshot cannot show. Two distinct signals:
    //  - `requestfailed` covers DNS/socket-level failures and aborts,
    //  - a 4xx/5xx *response* is a successful request, so it needs its own
    //    listener. This is the classic "broken image / dead API" case.
    const recordFailure = (entry: FailedRequest): void => {
      if (failedRequests.length >= LIMITS.MAX_FAILED_REQUESTS) return;
      if (failedRequests.some((existing) => existing.url === entry.url && existing.failure === entry.failure)) {
        return;
      }
      failedRequests.push(entry);
    };

    page.on("requestfailed", (request) => {
      recordFailure({
        url: request.url().slice(0, 300),
        method: request.method(),
        failure: request.failure()?.errorText ?? "unknown",
      });
    });

    page.on("response", (response) => {
      const status = response.status();
      if (status < 400) return;
      recordFailure({
        url: response.url().slice(0, 300),
        method: response.request().method(),
        failure: `HTTP ${status}`,
        status,
      });
    });

    // 3. Navigate.
    try {
      await page.goto(targetUrl, {
        waitUntil: "load",
        timeout: LIMITS.NAVIGATION_TIMEOUT_MS,
      });
    } catch (error) {
      throw toCaptureError(error, targetUrl);
    }

    // Best-effort: let client-side data fetching settle. Never fatal — SPAs with
    // long-polling or websockets never reach networkidle.
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);

    // 4. Wait for hydration / animations as requested by the model.
    if (delayMs > 0) await page.waitForTimeout(delayMs);

    // 5. Extract structure and pixels.
    const rawDom = await page.evaluate(sanitizeDomInPage, {
      maxTextLength: LIMITS.MAX_TEXT_LENGTH,
      maxAttrLength: LIMITS.MAX_ATTR_LENGTH,
    });
    const { dom, truncated } = truncateDom(rawDom, LIMITS.MAX_DOM_CHARS);

    const screenshot = await page.screenshot({
      type: SCREENSHOT.type,
      quality: SCREENSHOT.quality,
      fullPage,
    });

    const pageTitle = await page.title().catch(() => "");
    const finalUrl = page.url();

    return {
      imageBase64: screenshot.toString("base64"),
      mimeType: SCREENSHOT.mimeType,
      consoleLogs,
      pageErrors,
      failedRequests,
      simplifiedDOM: dom,
      meta: {
        finalUrl,
        pageTitle,
        viewport: viewportName,
        viewportSize: { width: preset.width, height: preset.height },
        fullPage,
        delayMs,
        durationMs: Date.now() - startedAt,
        screenshotBytes: screenshot.byteLength,
        domTruncated: truncated,
        domChars: dom.length,
      },
    };
  } catch (error) {
    // Already-classified errors pass through untouched.
    if (error instanceof CaptureError) throw error;
    throw toCaptureError(error, targetUrl);
  } finally {
    // 6. Always tear the browser down — no zombie Chromium processes.
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}
