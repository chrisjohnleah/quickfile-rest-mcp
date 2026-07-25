export type QuickFileConfig = {
  baseUrl: URL;
  maxResponseBytes: number;
  timeoutMs: number;
  token?: string;
};

const DEFAULT_BASE_URL = "https://api-beta.quickfile.co.uk";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RESPONSE_BYTES = 2_000_000;
const MAX_TIMEOUT_MS = 120_000;
const MAX_RESPONSE_BYTES = 10_000_000;

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): QuickFileConfig {
  const baseUrl = new URL(environment["QUICKFILE_BASE_URL"] ?? DEFAULT_BASE_URL);
  validateBaseUrl(baseUrl, environment["QUICKFILE_ALLOW_INSECURE_BASE_URL"]);

  const timeoutMs = parseBoundedInteger(
    environment["QUICKFILE_TIMEOUT_MS"],
    DEFAULT_TIMEOUT_MS,
    1_000,
    MAX_TIMEOUT_MS,
    "QUICKFILE_TIMEOUT_MS",
  );
  const maxResponseBytes = parseBoundedInteger(
    environment["QUICKFILE_MAX_RESPONSE_BYTES"],
    DEFAULT_MAX_RESPONSE_BYTES,
    10_000,
    MAX_RESPONSE_BYTES,
    "QUICKFILE_MAX_RESPONSE_BYTES",
  );

  const rawToken =
    environment["QUICKFILE_API_TOKEN"] ?? environment["QUICKFILE_TOKEN"];
  const token = rawToken?.trim();
  if (token !== undefined && (token.length < 10 || token.length > 2_000)) {
    throw new Error(
      "QUICKFILE_API_TOKEN has an unexpected length; check the configured personal bearer token",
    );
  }

  return {
    baseUrl,
    maxResponseBytes,
    timeoutMs,
    ...(token === undefined ? {} : { token }),
  };
}

function validateBaseUrl(baseUrl: URL, insecureOverride?: string): void {
  if (baseUrl.username !== "" || baseUrl.password !== "") {
    throw new Error("QUICKFILE_BASE_URL must not include credentials");
  }
  if (baseUrl.search !== "" || baseUrl.hash !== "") {
    throw new Error("QUICKFILE_BASE_URL must not include a query or fragment");
  }

  const isOfficialHost =
    baseUrl.protocol === "https:" &&
    baseUrl.hostname === "api-beta.quickfile.co.uk";
  const isExplicitTestOverride =
    insecureOverride === "1" &&
    ["localhost", "127.0.0.1", "::1"].includes(baseUrl.hostname);

  if (!isOfficialHost && !isExplicitTestOverride) {
    throw new Error(
      "QUICKFILE_BASE_URL must use https://api-beta.quickfile.co.uk (localhost is available only for explicit test configuration)",
    );
  }
}

function parseBoundedInteger(
  rawValue: string | undefined,
  defaultValue: number,
  minimum: number,
  maximum: number,
  name: string,
): number {
  if (rawValue === undefined) {
    return defaultValue;
  }
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return parsed;
}
