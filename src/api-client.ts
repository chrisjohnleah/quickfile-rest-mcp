import { Buffer } from "node:buffer";
import type { QuickFileConfig } from "./config.js";
import { inputName } from "./schema.js";
import { redactSecrets, sanitizeApiData } from "./sanitize.js";
import type {
  ApiResponse,
  OperationDefinition,
  SwaggerParameter,
  ToolArguments,
} from "./types.js";

const MAX_UPLOAD_BYTES = 10_000_000;
const ERROR_BODY_BYTES = 8_192;
const USER_AGENT = "quickfile-rest-mcp/0.1.0";

type UploadedFile = {
  contentBase64: string;
  contentType?: string;
  name: string;
};

export class QuickFileApiClient {
  readonly #config: QuickFileConfig;
  readonly #fetch: typeof fetch;

  constructor(config: QuickFileConfig, fetchImplementation: typeof fetch = fetch) {
    this.#config = config;
    this.#fetch = fetchImplementation;
  }

  public get configured(): boolean {
    return this.#config.token !== undefined;
  }

  public async execute(
    definition: OperationDefinition,
    arguments_: ToolArguments,
  ): Promise<ApiResponse> {
    const token = this.#config.token;
    if (token === undefined) {
      throw new QuickFileApiError(
        "QuickFile is not connected. Set QUICKFILE_API_TOKEN to a personal bearer token generated under Account Settings > Third Party Integration > API.",
        "NOT_CONFIGURED",
      );
    }

    enforceMutationConfirmation(definition, arguments_);
    const url = this.#buildUrl(definition, arguments_);
    const { body, headers } = this.#buildBody(definition, arguments_);

    let response: Response;
    try {
      response = await this.#fetch(url, {
        ...(body === undefined ? {} : { body }),
        headers: {
          accept: "application/json, application/pdf;q=0.9, */*;q=0.8",
          authorization: `Bearer ${token}`,
          "user-agent": USER_AGENT,
          ...headers,
        },
        method: definition.method.toUpperCase(),
        redirect: "error",
        signal: AbortSignal.timeout(this.#config.timeoutMs),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown network error";
      throw new QuickFileApiError(
        redactSecrets(`QuickFile request failed: ${message}`, token),
        "NETWORK_ERROR",
      );
    }

    const rawBody = await readLimitedBody(
      response,
      response.ok ? this.#config.maxResponseBytes : ERROR_BODY_BYTES,
    );
    const contentType =
      response.headers.get("content-type")?.split(";")[0]?.trim() ??
      "application/octet-stream";
    const rateLimit = parseHeaderInteger(
      response.headers.get("x-ratelimit-limit"),
    );
    const rateLimitRemaining = parseHeaderInteger(
      response.headers.get("x-ratelimit-remaining"),
    );
    const requestId =
      response.headers.get("x-request-id") ??
      response.headers.get("request-id") ??
      undefined;
    const metadata = {
      ...(rateLimit === undefined ? {} : { rateLimit }),
      ...(rateLimitRemaining === undefined ? {} : { rateLimitRemaining }),
      ...(requestId === undefined ? {} : { requestId }),
    };

    if (!response.ok) {
      const detail = parseErrorDetail(rawBody, contentType);
      throw new QuickFileApiError(
        redactSecrets(
          `QuickFile returned HTTP ${response.status}${detail === "" ? "" : `: ${detail}`}`,
          token,
        ),
        statusToCode(response.status),
        response.status,
        metadata.rateLimitRemaining,
      );
    }

    return {
      contentType,
      data: sanitizeApiData(parseSuccessBody(rawBody, contentType)),
      headers: metadata,
      status: response.status,
    };
  }

  #buildUrl(
    definition: OperationDefinition,
    arguments_: ToolArguments,
  ): URL {
    let path = definition.path;
    const query = new URLSearchParams();

    for (const parameter of definition.operation.parameters ?? []) {
      const value = arguments_[inputName(parameter)];
      if (value === undefined || value === null) {
        continue;
      }
      if (parameter.in === "path") {
        path = path.replace(
          `{${parameter.name}}`,
          encodeURIComponent(primitiveToString(value, parameter.name)),
        );
      } else if (parameter.in === "query") {
        appendQueryValue(query, parameter.name, value);
      }
    }

    if (/\{[^}]+\}/.test(path)) {
      throw new QuickFileApiError(
        `A required path parameter is missing for ${definition.operation.operationId}`,
        "INVALID_ARGUMENTS",
      );
    }

    const url = new URL(path, this.#config.baseUrl);
    url.search = query.toString();
    return url;
  }

  #buildBody(
    definition: OperationDefinition,
    arguments_: ToolArguments,
  ): { body?: BodyInit; headers: Record<string, string> } {
    const parameters = definition.operation.parameters ?? [];
    const formParameters = parameters.filter(
      ({ in: location }) => location === "formData",
    );
    if (formParameters.length > 0) {
      return {
        body: buildMultipartBody(formParameters, arguments_),
        headers: {},
      };
    }

    const bodyParameter = parameters.find(
      ({ in: location }) => location === "body",
    );
    if (bodyParameter === undefined) {
      return { headers: {} };
    }
    return {
      body: JSON.stringify(arguments_["body"]),
      headers: { "content-type": "application/json; charset=utf-8" },
    };
  }
}

export class QuickFileApiError extends Error {
  public readonly code: string;
  public readonly rateLimitRemaining: number | undefined;
  public readonly status: number | undefined;

  constructor(
    message: string,
    code: string,
    status?: number,
    rateLimitRemaining?: number,
  ) {
    super(message);
    this.name = "QuickFileApiError";
    this.code = code;
    this.status = status;
    this.rateLimitRemaining = rateLimitRemaining;
  }
}

function enforceMutationConfirmation(
  definition: OperationDefinition,
  arguments_: ToolArguments,
): void {
  if (definition.method === "get") {
    return;
  }
  if (arguments_["confirm"] !== true) {
    throw new QuickFileApiError(
      "This accounting write was not executed because confirm was not true",
      "CONFIRMATION_REQUIRED",
    );
  }
  if (
    definition.method === "delete" &&
    arguments_["confirmation"] !==
      `DELETE ${definition.operation.operationId}`
  ) {
    throw new QuickFileApiError(
      `This deletion was not executed. confirmation must exactly equal DELETE ${definition.operation.operationId}`,
      "CONFIRMATION_REQUIRED",
    );
  }
}

function appendQueryValue(
  query: URLSearchParams,
  name: string,
  value: unknown,
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      query.append(name, primitiveToString(item, name));
    }
    return;
  }
  if (typeof value === "object") {
    throw new QuickFileApiError(
      `Query parameter ${name} must be a primitive or array`,
      "INVALID_ARGUMENTS",
    );
  }
  query.set(name, primitiveToString(value, name));
}

function buildMultipartBody(
  parameters: readonly SwaggerParameter[],
  arguments_: ToolArguments,
): FormData {
  const form = new FormData();
  for (const parameter of parameters) {
    const value = arguments_[inputName(parameter)];
    if (value === undefined || value === null) {
      continue;
    }
    if (parameter.type === "file") {
      const file = value as UploadedFile;
      const bytes = Buffer.from(file.contentBase64, "base64");
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_UPLOAD_BYTES) {
        throw new QuickFileApiError(
          `Upload ${file.name} must decode to between 1 byte and ${MAX_UPLOAD_BYTES} bytes`,
          "INVALID_ARGUMENTS",
        );
      }
      const blob = new Blob([bytes], {
        type: file.contentType ?? "application/octet-stream",
      });
      form.append(parameter.name, blob, file.name);
    } else {
      form.append(
        parameter.name,
        primitiveToString(value, parameter.name),
      );
    }
  }
  return form;
}

function primitiveToString(value: unknown, name: string): string {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  throw new QuickFileApiError(
    `Parameter ${name} must be a string, number, or boolean`,
    "INVALID_ARGUMENTS",
  );
}

async function readLimitedBody(
  response: Response,
  maximumBytes: number,
): Promise<Uint8Array> {
  const declaredLength = parseHeaderInteger(response.headers.get("content-length"));
  if (declaredLength !== undefined && declaredLength > maximumBytes) {
    throw new QuickFileApiError(
      `QuickFile response exceeded the configured ${maximumBytes}-byte limit`,
      "RESPONSE_TOO_LARGE",
      response.status,
    );
  }
  if (response.body === null) {
    return new Uint8Array();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    length += value.byteLength;
    if (length > maximumBytes) {
      await reader.cancel();
      throw new QuickFileApiError(
        `QuickFile response exceeded the configured ${maximumBytes}-byte limit`,
        "RESPONSE_TOO_LARGE",
        response.status,
      );
    }
    chunks.push(value);
  }

  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function parseSuccessBody(body: Uint8Array, contentType: string): unknown {
  if (body.byteLength === 0) {
    return null;
  }
  if (isJsonContentType(contentType)) {
    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  }
  if (contentType.startsWith("text/")) {
    return new TextDecoder().decode(body);
  }
  return {
    base64: Buffer.from(body).toString("base64"),
    encoding: "base64",
    mimeType: contentType,
  };
}

function parseErrorDetail(body: Uint8Array, contentType: string): string {
  if (body.byteLength === 0) {
    return "";
  }
  const text = new TextDecoder().decode(body);
  if (!isJsonContentType(contentType)) {
    return text.replaceAll(/\s+/g, " ").trim().slice(0, 1_000);
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    return JSON.stringify(sanitizeApiData(parsed)).slice(0, 1_000);
  } catch {
    return "The API returned malformed JSON";
  }
}

function isJsonContentType(contentType: string): boolean {
  return (
    contentType === "application/json" ||
    contentType === "text/json" ||
    contentType.endsWith("+json")
  );
}

function parseHeaderInteger(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function statusToCode(status: number): string {
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHENTICATED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 422:
      return "VALIDATION_ERROR";
    case 429:
      return "RATE_LIMITED";
    default:
      return status >= 500 ? "QUICKFILE_UNAVAILABLE" : "HTTP_ERROR";
  }
}
