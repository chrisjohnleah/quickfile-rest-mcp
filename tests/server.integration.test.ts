import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { QuickFileApiClient } from "../src/api-client.js";
import type { QuickFileConfig } from "../src/config.js";
import { createQuickFileServer } from "../src/server.js";

const openClients: Client[] = [];

afterEach(async () => {
  await Promise.all(openClients.splice(0).map(async (client) => client.close()));
});

async function connectedClient(options?: {
  fetchImplementation?: typeof fetch;
  token?: string;
}): Promise<Client> {
  const config: QuickFileConfig = {
    baseUrl: new URL("https://api-beta.quickfile.co.uk"),
    maxResponseBytes: 2_000_000,
    timeoutMs: 5_000,
    ...(options?.token === undefined ? {} : { token: options.token }),
  };
  const apiClient = new QuickFileApiClient(
    config,
    options?.fetchImplementation ?? fetch,
  );
  const server = createQuickFileServer(config, apiClient);
  const client = new Client({
    name: "quickfile-rest-mcp-tests",
    version: "1.0.0",
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  openClients.push(client);
  return client;
}

describe("MCP protocol integration", () => {
  it("advertises the complete operation set, utilities, and visual tools", async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(80);
    expect(tools.find(({ name }) => name === "quickfile_invoice_search"))
      .toMatchObject({
        annotations: {
          destructiveHint: false,
          readOnlyHint: true,
        },
      });
    expect(tools.find(({ name }) => name === "quickfile_client_delete"))
      .toMatchObject({
        annotations: {
          destructiveHint: true,
          readOnlyHint: false,
        },
      });
    expect(
      tools.some(({ name }) => name === "quickfile_visual_profit_and_loss"),
    ).toBe(true);
  });

  it("serves its API catalog and setup guidance as MCP resources", async () => {
    const client = await connectedClient();
    const { resources } = await client.listResources();
    expect(resources.map(({ uri }) => uri)).toEqual([
      "quickfile://api/catalog",
      "quickfile://help/setup",
    ]);
    const result = await client.readResource({
      uri: "quickfile://api/catalog",
    });
    const content = result.contents[0];
    expect(content).toBeDefined();
    expect(content).toMatchObject({
      mimeType: "application/json",
    });
    expect(content !== undefined && "text" in content && content.text).toContain(
      '"count": 75',
    );
  });

  it("returns useful setup status without a QuickFile account", async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      arguments: { live: false },
      name: "quickfile_connection_status",
    });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      configured: false,
      liveChecked: false,
    });
  });

  it("executes generated read tools and formats API metadata", async () => {
    const client = await connectedClient({
      fetchImplementation: (async () =>
        Response.json(
          { business_name: "Demo Ltd" },
          { headers: { "x-ratelimit-remaining": "4998" } },
        )) as typeof fetch,
      token: "test-personal-bearer-token",
    });
    const result = await client.callTool({
      arguments: {},
      name: "quickfile_account_me",
    });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      data: { business_name: "Demo Ltd" },
      operationId: "Account_Me",
      rateLimit: { rateLimitRemaining: 4998 },
    });
  });

  it("returns a protocol error instead of attempting an unconfigured API call", async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      arguments: {},
      name: "quickfile_account_me",
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      error: { code: "NOT_CONFIGURED" },
    });
  });

  it("renders visual accounting reports locally as SVG", async () => {
    const client = await connectedClient({
      fetchImplementation: (async () =>
        Response.json({
          totals: {
            less_cost_of_sales: 4500,
            less_expenses: 2100,
            net_profit: 3400,
            turnover: 10000,
          },
        })) as typeof fetch,
      token: "test-personal-bearer-token",
    });
    const result = await client.callTool({
      arguments: {
        currency: "GBP",
        date_from: "2026-07-01",
        date_to: "2026-07-31",
      },
      name: "quickfile_visual_profit_and_loss",
    });
    expect(result.isError).not.toBe(true);
    expect(result.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mimeType: "image/svg+xml",
          type: "image",
        }),
      ]),
    );
    expect(result.structuredContent).toMatchObject({
      chart: { currency: "GBP", title: "Profit and Loss", type: "bar" },
    });
  });

  it("filters the local API catalog without making network calls", async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      arguments: { group: "Invoice", method: "delete" },
      name: "quickfile_api_catalog",
    });
    expect(result.structuredContent).toMatchObject({
      count: 1,
      operations: [
        {
          operationId: "Invoice_Delete",
          tool: "quickfile_invoice_delete",
        },
      ],
    });
  });

  it("advertises the cautious month-end prompt", async () => {
    const client = await connectedClient();
    const { prompts } = await client.listPrompts();
    expect(prompts).toHaveLength(1);
    const prompt = await client.getPrompt({
      arguments: { date_to: "2026-07-31" },
      name: "quickfile_month_end_review",
    });
    expect(prompt.messages[0]?.content).toMatchObject({ type: "text" });
  });
});
