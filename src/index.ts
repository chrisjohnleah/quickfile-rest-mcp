#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createQuickFileServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const server = createQuickFileServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `quickfile-rest-mcp 0.1.0 ready (${config.token === undefined ? "token not configured" : "token configured"})`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`quickfile-rest-mcp failed to start: ${message}`);
  process.exitCode = 1;
});
