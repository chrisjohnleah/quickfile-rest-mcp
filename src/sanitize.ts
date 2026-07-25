const SENSITIVE_KEY =
  /(?:access[_-]?token|api[_-]?key|authorization|client[_-]?secret|password|refresh[_-]?token|secret)/i;
const INVISIBLE_CONTROLS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
const MAX_DEPTH = 30;

export function sanitizeApiData(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) {
    return "[TRUNCATED: maximum nesting depth exceeded]";
  }
  if (typeof value === "string") {
    return value.replace(INVISIBLE_CONTROLS, "");
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeApiData(item, depth + 1));
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEY.test(key)
          ? "[REDACTED]"
          : sanitizeApiData(item, depth + 1),
      ]),
    );
  }
  return value;
}

export function redactSecrets(message: string, token?: string): string {
  let redacted = message;
  if (token !== undefined && token.length > 0) {
    redacted = redacted.replaceAll(token, "[REDACTED]");
  }
  return redacted.replace(
    /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
    "Bearer [REDACTED]",
  );
}
