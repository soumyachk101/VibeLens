/**
 * End-to-end tests for the Playwright capture engine.
 *
 * These launch a real headless Chromium against a real local HTTP server, so
 * they verify the whole pipeline: navigation, console sniffing, network failure
 * detection, DOM sanitization and screenshot encoding.
 *
 * Requires `npx playwright install chromium`.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { captureUIState } from "../src/browser.js";
import { CaptureError, VIEWPORT_PRESETS } from "../src/types.js";
import { findClosedPort, MARKER_CLASS, startFixtureServer, type FixtureServer } from "./fixture-server.js";

describe("captureUIState", () => {
  let fixture: FixtureServer;

  beforeAll(async () => {
    fixture = await startFixtureServer();
  });

  afterAll(async () => {
    await fixture.close();
  });

  describe("happy path", () => {
    it("returns a screenshot, diagnostics and a sanitized DOM", async () => {
      const result = await captureUIState({ url: fixture.url, delay: 200 });

      // --- Screenshot ---------------------------------------------------
      expect(result.mimeType).toBe("image/jpeg");
      expect(result.imageBase64.length).toBeGreaterThan(1000);
      const bytes = Buffer.from(result.imageBase64, "base64");
      // JPEG magic number: FF D8 FF
      expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xff, 0xd8, 0xff]);
      expect(result.meta.screenshotBytes).toBe(bytes.byteLength);

      // --- Console sniffing --------------------------------------------
      const errors = result.consoleLogs.filter((entry) => entry.level === "error");
      const warnings = result.consoleLogs.filter((entry) => entry.level === "warning");
      expect(errors.some((entry) => entry.text.includes("VIBELENS_TEST_CONSOLE_ERROR"))).toBe(true);
      expect(warnings.some((entry) => entry.text.includes("VIBELENS_TEST_CONSOLE_WARN"))).toBe(true);
      // console.log is noise and must be dropped.
      expect(result.consoleLogs.some((entry) => entry.text.includes("VIBELENS_TEST_CONSOLE_LOG"))).toBe(false);

      // --- Uncaught exceptions -----------------------------------------
      expect(result.pageErrors.some((text) => text.includes("VIBELENS_TEST_UNCAUGHT"))).toBe(true);

      // --- Failed network requests (missing asset) ----------------------
      // A 404 is a *successful* request with an error status, so it must be
      // detected via the response listener, not `requestfailed`.
      const brokenImage = result.failedRequests.find((request) =>
        request.url.includes("does-not-exist.png"),
      );
      expect(brokenImage, JSON.stringify(result.failedRequests)).toBeDefined();
      expect(brokenImage?.failure).toBe("HTTP 404");
      expect(brokenImage?.status).toBe(404);

      // --- Meta ---------------------------------------------------------
      expect(result.meta.pageTitle).toBe("VibeLens Fixture");
      expect(result.meta.viewport).toBe("desktop");
      expect(result.meta.viewportSize).toEqual({
        width: VIEWPORT_PRESETS.desktop.width,
        height: VIEWPORT_PRESETS.desktop.height,
      });
      expect(result.meta.delayMs).toBe(200);
      expect(result.meta.durationMs).toBeGreaterThan(0);
      expect(result.meta.domChars).toBe(result.simplifiedDOM.length);
    });

    it("keeps layout signal and strips token noise from the DOM", async () => {
      const { simplifiedDOM: dom } = await captureUIState({ url: fixture.url, delay: 100 });

      // Kept: structure, ids, Tailwind classes, test hooks, ARIA.
      expect(dom).toContain('id="main-content"');
      expect(dom).toContain('id="buy-now"');
      expect(dom).toContain(MARKER_CLASS);
      expect(dom).toContain('data-testid="buy-now"');
      expect(dom).toContain('aria-label="Buy now"');
      expect(dom).toContain("<h1");
      expect(dom).toContain("Pricing");

      // Stripped: scripts, styles, noscript, comments.
      expect(dom).not.toContain("<script");
      expect(dom).not.toContain("<style");
      expect(dom).not.toContain("secret-style-rule");
      expect(dom).not.toContain("<noscript");
      expect(dom).not.toContain("a comment that should be stripped");
      expect(dom).not.toContain("VIBELENS_TEST_CONSOLE_ERROR");

      // Collapsed: the <svg> box survives, its 3.5KB path does not.
      expect(dom).toContain('id="chart"');
      expect(dom).not.toContain("L10 10 L10 10");

      // Base64 data URI replaced with a marker instead of 4000 chars.
      expect(dom).toContain("data:image/png[stripped]");
      expect(dom).not.toContain("AAAAAAAAAAAAAAAAAAAA");

      // Long text truncated rather than reproduced in full.
      expect(dom).toContain("…[truncated]");

      // Net effect: the sanitized tree is a small fraction of the raw page.
      expect(dom.length).toBeLessThan(3000);
    });

    it("honours the mobile viewport preset", async () => {
      const result = await captureUIState({ url: fixture.url, viewport: "mobile", delay: 50 });
      expect(result.meta.viewport).toBe("mobile");
      expect(result.meta.viewportSize).toEqual({ width: 390, height: 844 });
    });

    it("clamps an out-of-range delay instead of hanging", async () => {
      const result = await captureUIState({ url: fixture.url, delay: -5000 });
      expect(result.meta.delayMs).toBe(0);
    });

    it("supports full-page capture", async () => {
      const viewportShot = await captureUIState({ url: fixture.url, delay: 0, fullPage: false });
      const fullShot = await captureUIState({ url: fixture.url, delay: 0, fullPage: true });
      expect(fullShot.meta.fullPage).toBe(true);
      expect(viewportShot.meta.fullPage).toBe(false);
      expect(fullShot.imageBase64.length).toBeGreaterThan(0);
    });
  });

  describe("failure modes", () => {
    it("rejects non-local URLs before launching a browser", async () => {
      await expect(captureUIState({ url: "https://example.com" })).rejects.toMatchObject({
        code: "INVALID_URL",
      });
    });

    it("rejects the cloud metadata endpoint", async () => {
      await expect(
        captureUIState({ url: "http://169.254.169.254/latest/meta-data/" }),
      ).rejects.toMatchObject({ code: "INVALID_URL" });
    });

    it("explains Chromium's blocked-port list instead of a raw net:: error", async () => {
      // Port 6000 (X11) is on Chromium's permanently blocked list.
      let thrown: unknown;
      try {
        await captureUIState({ url: "http://127.0.0.1:6000/", delay: 0 });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(CaptureError);
      const error = thrown as CaptureError;
      expect(error.code).toBe("UNSAFE_PORT");
      expect(error.hint).toContain("3000");
    });

    it("reports a friendly error when the dev server is not running", async () => {
      const port = await findClosedPort();
      let thrown: unknown;
      try {
        await captureUIState({ url: `http://127.0.0.1:${port}/`, delay: 0 });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(CaptureError);
      const error = thrown as CaptureError;
      expect(error.code).toBe("CONNECTION_REFUSED");
      expect(error.hint.toLowerCase()).toContain("dev server");
    });
  });
});
