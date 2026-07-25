import { describe, expect, it, vi } from "vitest";
import {
  QuickFileApiClient,
  QuickFileApiError,
} from "../src/api-client.js";
import type { QuickFileConfig } from "../src/config.js";
import { findOperation } from "../src/openapi.js";

const TOKEN = "test-personal-bearer-token";

function config(overrides: Partial<QuickFileConfig> = {}): QuickFileConfig {
  return {
    baseUrl: new URL("https://api-beta.quickfile.co.uk"),
    maxResponseBytes: 2_000_000,
    timeoutMs: 5_000,
    token: TOKEN,
    ...overrides,
  };
}

describe("QuickFileApiClient", () => {
  it("builds an allowlisted GET request with encoded path/query and bearer auth", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(
        { company_name: "Example Ltd" },
        {
          headers: {
            "x-ratelimit-limit": "5000",
            "x-ratelimit-remaining": "4999",
          },
        },
      ),
    );
    const client = new QuickFileApiClient(
      config(),
      fetchMock as unknown as typeof fetch,
    );

    const result = await client.execute(findOperation("Client_Get"), {
      contacts: true,
      id: 42,
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.href).toBe(
      "https://api-beta.quickfile.co.uk/clients/42?contacts=true",
    );
    expect(init.method).toBe("GET");
    expect(init.headers).toMatchObject({
      authorization: `Bearer ${TOKEN}`,
    });
    expect(result.data).toEqual({ company_name: "Example Ltd" });
    expect(result.headers.rateLimitRemaining).toBe(4_999);
  });

  it("serializes JSON writes only after confirmation", async () => {
    const fetchMock = vi.fn(async () => Response.json({ id: 9 }));
    const client = new QuickFileApiClient(
      config(),
      fetchMock as unknown as typeof fetch,
    );
    const operation = findOperation("Invoice_Post");

    await expect(client.execute(operation, { body: {} })).rejects.toMatchObject({
      code: "CONFIRMATION_REQUIRED",
    });

    await client.execute(operation, {
      body: { client_id: 1 },
      confirm: true,
    });
    const [, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"client_id":1}');
    expect(init.headers).toMatchObject({
      "content-type": "application/json; charset=utf-8",
    });
  });

  it("requires an exact destructive acknowledgement for deletes", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    const client = new QuickFileApiClient(
      config(),
      fetchMock as unknown as typeof fetch,
    );
    const operation = findOperation("Client_Delete");

    await expect(
      client.execute(operation, {
        confirm: true,
        confirmation: "DELETE something else",
        id: 1,
      }),
    ).rejects.toMatchObject({ code: "CONFIRMATION_REQUIRED" });

    await client.execute(operation, {
      confirm: true,
      confirmation: "DELETE Client_Delete",
      id: 1,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("creates multipart uploads without exposing a filesystem path", async () => {
    const fetchMock = vi.fn(async () => Response.json({ document_id: 3 }));
    const client = new QuickFileApiClient(
      config(),
      fetchMock as unknown as typeof fetch,
    );
    await client.execute(findOperation("Document_UploadSales"), {
      confirm: true,
      file: {
        contentBase64: "aGVsbG8=",
        contentType: "text/plain",
        name: "receipt.txt",
      },
      invoice_id: 42,
    });
    const [, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get("invoice_id")).toBe("42");
    expect(form.get("file")).toBeInstanceOf(Blob);
  });

  it("redacts bearer tokens from API errors", async () => {
    const fetchMock = vi.fn(
      async () =>
        Response.json(
          { error: `Authorization: Bearer ${TOKEN}` },
          { status: 401 },
        ),
    );
    const client = new QuickFileApiClient(
      config(),
      fetchMock as unknown as typeof fetch,
    );

    let caught: unknown;
    try {
      await client.execute(findOperation("Account_Me"), {});
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(QuickFileApiError);
    expect((caught as Error).message).not.toContain(TOKEN);
    expect((caught as QuickFileApiError).code).toBe("UNAUTHENTICATED");
  });

  it("stops oversized responses before parsing", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: "large" }), {
          headers: { "content-length": "1000" },
        }),
    );
    const client = new QuickFileApiClient(
      config({ maxResponseBytes: 20 }),
      fetchMock as unknown as typeof fetch,
    );
    await expect(
      client.execute(findOperation("Account_Me"), {}),
    ).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
  });

  it("refuses API calls when no token is configured", async () => {
    const noTokenConfig = config();
    delete noTokenConfig.token;
    const client = new QuickFileApiClient(noTokenConfig);
    await expect(
      client.execute(findOperation("Account_Me"), {}),
    ).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
  });
});
