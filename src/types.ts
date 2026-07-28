/**
 * VibeLens — shared types, viewport presets and payload limits.
 *
 * Everything that both the Playwright engine (`browser.ts`) and the MCP
 * server (`index.ts`) need to agree on lives here.
 */

/** Viewport presets exposed to the AI through the tool schema. */
export type ViewportName = "desktop" | "mobile" | "tablet";

export interface ViewportPreset {
  width: number;
  height: number;
  /** Device pixel ratio. Mobile presets use 2 to mimic real handsets. */
  deviceScaleFactor: number;
  /** Enables Chromium's mobile emulation (meta viewport handling + touch). */
  isMobile: boolean;
}

/**
 * Fixed presets. Kept small on purpose: a bounded enum is far easier for an
 * LLM to use correctly than free-form width/height numbers.
 */
export const VIEWPORT_PRESETS: Record<ViewportName, ViewportPreset> = {
  desktop: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false },
  tablet: { width: 820, height: 1180, deviceScaleFactor: 2, isMobile: true },
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true },
};

/** Payload budgets. These exist to protect the AI's context window. */
export const LIMITS = {
  /** Hard cap on the sanitized DOM string handed back to the model. */
  MAX_DOM_CHARS: 20_000,
  /** Per-text-node cap — long paragraphs add tokens but little layout signal. */
  MAX_TEXT_LENGTH: 160,
  /** Per-attribute cap — kills base64 blobs and giant inline data. */
  MAX_ATTR_LENGTH: 300,
  /** Max console entries returned (newest entries are dropped last). */
  MAX_CONSOLE_ENTRIES: 40,
  /** Max characters per console entry. */
  MAX_CONSOLE_LENGTH: 600,
  /** Max failed network requests reported. */
  MAX_FAILED_REQUESTS: 20,
  /** Upper bound the AI may request for `delay`, in ms. */
  MAX_DELAY_MS: 15_000,
  /** Navigation timeout, in ms. */
  NAVIGATION_TIMEOUT_MS: 30_000,
  /** Browser launch timeout, in ms. */
  LAUNCH_TIMEOUT_MS: 45_000,
} as const;

/** Screenshot encoding. JPEG at ~75 keeps payloads small while staying legible. */
export const SCREENSHOT = {
  type: "jpeg",
  quality: 75,
  mimeType: "image/jpeg",
} as const;

/** Options accepted by {@link captureUIState}. */
export interface CaptureOptions {
  /** Local URL to inspect, e.g. `http://localhost:3000/dashboard`. */
  url: string;
  /** Viewport preset. Defaults to `desktop`. */
  viewport?: ViewportName;
  /** Milliseconds to wait after load, for hydration/animations. Defaults to 1000. */
  delay?: number;
  /** Capture the whole scrollable page instead of just the viewport. */
  fullPage?: boolean;
}

/** A single captured console message. */
export interface ConsoleEntry {
  level: "error" | "warning";
  text: string;
  /** Source location, when Chromium provides one. */
  location?: string;
}

/** A request that failed at the network level, or returned an HTTP error. */
export interface FailedRequest {
  url: string;
  method: string;
  /** Either a Chromium error text (e.g. `net::ERR_ABORTED`) or `HTTP 404`. */
  failure: string;
  /** Present for HTTP-level failures. */
  status?: number;
}

/** Options for the in-page DOM sanitizer. */
export interface DomSanitizeOptions {
  maxTextLength: number;
  maxAttrLength: number;
}

/** Everything a capture produced. */
export interface CaptureResult {
  /** Base64-encoded JPEG screenshot (no data-URI prefix). */
  imageBase64: string;
  mimeType: string;
  /** `console.error` / `console.warn` output observed during the capture. */
  consoleLogs: ConsoleEntry[];
  /** Uncaught page exceptions (React render crashes, etc.). */
  pageErrors: string[];
  /** Requests that failed — commonly missing images or refused API calls. */
  failedRequests: FailedRequest[];
  /** Token-optimized `<body>` markup: structure, ids and classes only. */
  simplifiedDOM: string;
  meta: CaptureMeta;
}

export interface CaptureMeta {
  /** URL after redirects. */
  finalUrl: string;
  pageTitle: string;
  viewport: ViewportName;
  viewportSize: { width: number; height: number };
  fullPage: boolean;
  delayMs: number;
  /** Wall-clock duration of the whole capture, in ms. */
  durationMs: number;
  screenshotBytes: number;
  /** True when the DOM snapshot hit {@link LIMITS.MAX_DOM_CHARS}. */
  domTruncated: boolean;
  domChars: number;
}

/** Machine-readable failure reasons, so the server can craft good guidance. */
export type CaptureErrorCode =
  | "INVALID_URL"
  | "CONNECTION_REFUSED"
  | "DNS_FAILURE"
  | "UNSAFE_PORT"
  | "TIMEOUT"
  | "BROWSER_NOT_INSTALLED"
  | "BROWSER_LAUNCH_FAILED"
  | "UNKNOWN";

/** Error type carrying an actionable, model-friendly message. */
export class CaptureError extends Error {
  readonly code: CaptureErrorCode;
  /** Advice that is safe (and useful) to hand straight to the AI. */
  readonly hint: string;

  constructor(code: CaptureErrorCode, message: string, hint: string) {
    super(message);
    this.name = "CaptureError";
    this.code = code;
    this.hint = hint;
  }
}
