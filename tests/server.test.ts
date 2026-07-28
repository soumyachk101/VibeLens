/**
 * Protocol-level tests: drive the real MCP server through an in-memory
 * transport with a real MCP client, exactly as an IDE would.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildErrorPayload, createServer, TOOL_NAME } from "../src/server.js";
import { CaptureError } from "../src/types.js";
import { startFixtureServer, type FixtureServer } from "./fixture-server.js";

interface TextBlock {
  type: "text";
  text: string;
}
interface ImageBlock {
  type: "image";
  data: string;
  mimeType: string;
}
type Block = TextBlock | ImageBlock | { type: string };

describe("MCP server", () => {
  let client: Client;
  let fixture: FixtureServer;

  beforeAll(async () => {
    fixture = await startFixtureServer();

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createServer();
    client = new Client({ name: "vibelens-test-client", version: "1.0.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterAll(async () => {
    await client.close();
    await fixture.close();
  });

  it("advertises inspect_localhost_ui with a usable schema", async () => {
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(1);

    const tool = tools[0]!;
    expect(tool.name).toBe(TOOL_NAME);
    expect(tool.description).toBeTruthy();

    const properties = tool.inputSchema.properties as Record<string, unknown>;
    expect(Object.keys(properties).sort()).toEqual(["delay", "fullPage", "url", "viewport"]);
    // Only `url` should be mandatory; the rest have defaults.
    expect(tool.inputSchema.required).toEqual(["url"]);

    const viewport = properties.viewport as { enum?: string[] };
    expect(viewport.enum).toEqual(["desktop", "tablet", "mobile"]);
  });

  it("returns an image block followed by a text block", async () => {
    const result = await client.callTool({
      name: TOOL_NAME,
      arguments: { url: fixture.url, delay: 100 },
    });

    expect(result.isError).toBeFalsy();

    const content = result.content as Block[];
    expect(content).toHaveLength(2);

    const image = content[0] as ImageBlock;
    expect(image.type).toBe("image");
    expect(image.mimeType).toBe("image/jpeg");
    expect(Buffer.from(image.data, "base64").subarray(0, 3)).toEqual(
      Buffer.from([0xff, 0xd8, 0xff]),
    );

    const text = content[1] as TextBlock;
    expect(text.type).toBe("text");

    const payload = JSON.parse(text.text) as {
      summary: Record<string, unknown>;
      consoleLogs: Array<{ level: string; text: string }>;
      uncaughtPageErrors: string[];
      failedRequests: unknown[];
      simplifiedDOM: string;
    };

    expect(payload.summary.pageTitle).toBe("VibeLens Fixture");
    expect(payload.summary.consoleErrors).toBeGreaterThanOrEqual(1);
    expect(payload.consoleLogs.some((entry) => entry.text.includes("VIBELENS_TEST_CONSOLE_ERROR"))).toBe(true);
    expect(payload.uncaughtPageErrors.length).toBeGreaterThanOrEqual(1);
    expect(payload.simplifiedDOM).toContain('id="buy-now"');
  });

  it("applies schema defaults when only url is supplied", async () => {
    const result = await client.callTool({
      name: TOOL_NAME,
      arguments: { url: fixture.url },
    });

    const content = result.content as Block[];
    const payload = JSON.parse((content[1] as TextBlock).text) as {
      summary: { viewport: string; waitedMs: number; fullPage: boolean };
    };

    expect(payload.summary.viewport).toContain("desktop (1920x1080)");
    expect(payload.summary.waitedMs).toBe(1000);
    expect(payload.summary.fullPage).toBe(false);
  });

  it("reports a blocked URL as a tool error, without crashing the server", async () => {
    const result = await client.callTool({
      name: TOOL_NAME,
      arguments: { url: "https://example.com" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Block[])[0] as TextBlock;
    expect(text.text).toContain("INVALID_URL");
    expect(text.text).toContain("Next step:");

    // The server is still healthy afterwards.
    const followUp = await client.callTool({
      name: TOOL_NAME,
      arguments: { url: fixture.url, delay: 0 },
    });
    expect(followUp.isError).toBeFalsy();
  });

  it("rejects malformed arguments at the protocol layer", async () => {
    const result = await client.callTool({
      name: TOOL_NAME,
      arguments: { url: fixture.url, viewport: "hologram" },
    });
    expect(result.isError).toBe(true);
  });
});

describe("buildErrorPayload", () => {
  it("surfaces the code, problem and next step for CaptureError", () => {
    const text = buildErrorPayload(
      new CaptureError("CONNECTION_REFUSED", "Connection refused at http://localhost:3000/.", "Start the dev server."),
    );
    expect(text).toContain("CONNECTION_REFUSED");
    expect(text).toContain("Problem: Connection refused");
    expect(text).toContain("Next step: Start the dev server.");
  });

  it("handles non-Error values without throwing", () => {
    expect(buildErrorPayload("boom")).toContain("UNKNOWN");
    expect(buildErrorPayload(undefined)).toContain("UNKNOWN");
  });
});
