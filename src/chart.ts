import { Buffer } from "node:buffer";

export type ChartDatum = {
  label: string;
  value: number;
};

const WIDTH = 960;
const HEIGHT = 540;
const MARGIN = { bottom: 96, left: 96, right: 40, top: 84 };
const COLOURS = [
  "#2563eb",
  "#0f766e",
  "#7c3aed",
  "#ea580c",
  "#be123c",
  "#4f46e5",
];

export function renderBarChart(
  title: string,
  data: ChartDatum[],
  currency = "GBP",
): { base64: string; svg: string } {
  const safeData = data
    .filter(({ value }) => Number.isFinite(value))
    .slice(0, 20);
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const maximum = Math.max(...safeData.map(({ value }) => Math.abs(value)), 1);
  const barSlot = plotWidth / Math.max(safeData.length, 1);
  const barWidth = Math.max(Math.min(barSlot * 0.62, 76), 12);
  const baseline = MARGIN.top + plotHeight / 2;
  const scale = (plotHeight / 2 - 22) / maximum;
  const formatter = new Intl.NumberFormat("en-GB", {
    currency,
    maximumFractionDigits: 0,
    notation: maximum >= 1_000_000 ? "compact" : "standard",
    style: "currency",
  });

  const bars = safeData
    .map(({ label, value }, index) => {
      const height = Math.abs(value) * scale;
      const x = MARGIN.left + index * barSlot + (barSlot - barWidth) / 2;
      const y = value >= 0 ? baseline - height : baseline;
      const valueY = value >= 0 ? y - 10 : y + height + 20;
      const labelLines = wrapLabel(label, 15);
      const labels = labelLines
        .map(
          (line, lineIndex) =>
            `<tspan x="${x + barWidth / 2}" dy="${lineIndex === 0 ? 0 : 16}">${escapeXml(line)}</tspan>`,
        )
        .join("");
      return [
        `<rect x="${x}" y="${y}" width="${barWidth}" height="${Math.max(height, 1)}" rx="5" fill="${COLOURS[index % COLOURS.length] ?? "#2563eb"}"/>`,
        `<text x="${x + barWidth / 2}" y="${valueY}" text-anchor="middle" class="value">${escapeXml(formatter.format(value))}</text>`,
        `<text x="${x + barWidth / 2}" y="${HEIGHT - MARGIN.bottom + 28}" text-anchor="middle" class="label">${labels}</text>`,
      ].join("");
    })
    .join("");

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml(title)}">`,
    "<style>",
    "text{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;fill:#172033}",
    ".title{font-size:28px;font-weight:700}.subtitle{font-size:14px;fill:#64748b}",
    ".label{font-size:12px}.value{font-size:12px;font-weight:600}",
    "</style>",
    `<rect width="${WIDTH}" height="${HEIGHT}" rx="18" fill="#f8fafc"/>`,
    `<text x="${MARGIN.left}" y="42" class="title">${escapeXml(title)}</text>`,
    `<text x="${MARGIN.left}" y="66" class="subtitle">Generated locally from QuickFile data • amounts in ${escapeXml(currency)}</text>`,
    `<line x1="${MARGIN.left}" y1="${baseline}" x2="${WIDTH - MARGIN.right}" y2="${baseline}" stroke="#94a3b8" stroke-width="1"/>`,
    bars,
    "</svg>",
  ].join("");

  return { base64: Buffer.from(svg).toString("base64"), svg };
}

function wrapLabel(label: string, width: number): string[] {
  const words = label.trim().split(/\s+/);
  const lines: string[] = [];
  for (const word of words) {
    const current = lines.at(-1);
    if (current === undefined || current.length + word.length + 1 > width) {
      lines.push(word.slice(0, width));
    } else {
      lines[lines.length - 1] = `${current} ${word}`;
    }
  }
  return lines.slice(0, 2);
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
