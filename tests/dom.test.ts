import { describe, expect, it } from "vitest";

import { truncateDom } from "../src/dom.js";
import { LIMITS } from "../src/types.js";

describe("truncateDom", () => {
  it("passes small documents through untouched", () => {
    const html = "<body><div class='p-4'>hi</div></body>";
    const result = truncateDom(html, LIMITS.MAX_DOM_CHARS);
    expect(result.truncated).toBe(false);
    expect(result.dom).toBe(html);
  });

  it("caps oversized documents and says so in-band", () => {
    const html = `<body>${"<div class='p-4'>x</div>".repeat(5000)}</body>`;
    const result = truncateDom(html, 1000);

    expect(result.truncated).toBe(true);
    // The marker must be visible to the model so it knows the tree is partial.
    expect(result.dom).toContain("DOM truncated at 1000 characters");
    expect(result.dom).toContain(`original ${html.length}`);
    // Payload stays close to the budget (marker excluded).
    expect(result.dom.length).toBeLessThan(1000 + 120);
  });

  it("treats an exactly-at-limit document as untruncated", () => {
    const html = "y".repeat(500);
    const result = truncateDom(html, 500);
    expect(result.truncated).toBe(false);
    expect(result.dom).toBe(html);
  });
});
