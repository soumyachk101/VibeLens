#!/usr/bin/env node
/**
 * VibeLens — executable entrypoint.
 *
 * Connects the MCP server to stdio. Kept intentionally thin so that
 * `server.ts` stays importable (and testable) without side effects.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createServer, log, SERVER_NAME, SERVER_VERSION } from "./server.js";

async function main(): Promise<void> {
  // Keep the process alive through unexpected faults. An MCP server that exits
  // mid-session forces the user to restart their whole IDE integration, so we
  // log and carry on rather than letting Node terminate.
  process.on("uncaughtException", (error) => {
    log(`uncaught exception: ${error.stack ?? error.message}`);
  });
  process.on("unhandledRejection", (reason) => {
    log(`unhandled rejection: ${String(reason)}`);
  });

  const server = createServer();
  await server.connect(new StdioServerTransport());
  log(`${SERVER_NAME} v${SERVER_VERSION} ready on stdio`);
}

main().catch((error: unknown) => {
  log(`fatal: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
  process.exit(1);
});
