import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { renderBarChart } from "../src/chart.js";
import { sanitizeApiData } from "../src/sanitize.js";

describe("response safety and local charts", () => {
  it("redacts secret-shaped fields and removes invisible controls", () => {
    expect(
      sanitizeApiData({
        access_token: "do-not-return",
        description: "Invoice\u202E text",
        nested: { password: "secret" },
      }),
    ).toEqual({
      access_token: "[REDACTED]",
      description: "Invoice text",
      nested: { password: "[REDACTED]" },
    });
  });

  it("renders escaped, local SVG chart output", () => {
    const chart = renderBarChart(
      "P&L <script>",
      [
        { label: "Turnover & sales", value: 12_500 },
        { label: "Expenses", value: -4_000 },
      ],
      "GBP",
    );
    expect(chart.svg).toContain("P&amp;L &lt;script&gt;");
    expect(chart.svg).not.toContain("<script>");
    expect(Buffer.from(chart.base64, "base64").toString()).toBe(chart.svg);
  });
});
