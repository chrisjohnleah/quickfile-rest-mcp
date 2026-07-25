import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("uses safe QuickFile defaults without requiring a token at startup", () => {
    const config = loadConfig({});
    expect(config.baseUrl.href).toBe("https://api-beta.quickfile.co.uk/");
    expect(config.timeoutMs).toBe(30_000);
    expect(config.maxResponseBytes).toBe(2_000_000);
    expect(config.token).toBeUndefined();
  });

  it("accepts a plausible bearer token and bounded settings", () => {
    const config = loadConfig({
      QUICKFILE_API_TOKEN: "  test-personal-bearer-token  ",
      QUICKFILE_MAX_RESPONSE_BYTES: "500000",
      QUICKFILE_TIMEOUT_MS: "15000",
    });
    expect(config.token).toBe("test-personal-bearer-token");
    expect(config.maxResponseBytes).toBe(500_000);
    expect(config.timeoutMs).toBe(15_000);
  });

  it("rejects arbitrary API origins to prevent token exfiltration", () => {
    expect(() =>
      loadConfig({
        QUICKFILE_API_TOKEN: "test-personal-bearer-token",
        QUICKFILE_BASE_URL: "https://attacker.example",
      }),
    ).toThrow(/must use https:\/\/api-beta\.quickfile\.co\.uk/);
  });

  it("allows localhost only with the explicit test override", () => {
    const config = loadConfig({
      QUICKFILE_ALLOW_INSECURE_BASE_URL: "1",
      QUICKFILE_BASE_URL: "http://127.0.0.1:8123",
    });
    expect(config.baseUrl.href).toBe("http://127.0.0.1:8123/");
  });
});
