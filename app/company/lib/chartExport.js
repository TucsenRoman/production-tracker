/**
 * Taking the chart off the screen.
 *
 * Three formats, one source. Everything here is built from the SAME `points`
 * the chart renders from — nothing scrapes the DOM. That matters more than it
 * sounds: a DOM-scraped export inherits whatever the browser happened to
 * render, so it carries the page's fonts, its dark mode, its scroll position
 * and its hairline rounding, and it silently breaks the day someone changes a
 * class name. Rebuilding from the data means the file is a deliberate artifact
 * rather than a photograph of one, and it means the CSV, the SVG and the PNG
 * can never disagree with each other.
 *
 * The three answer different questions:
 *   CSV — "let me do my own maths." The numbers, nothing else.
 *   SVG — "put this in a document." Vector, so it survives being resized.
 *   PNG — "paste this in an email." Raster, because half the places people
 *         paste a chart cannot render an SVG.
 *
 * The PNG is rasterised FROM the SVG rather than drawn separately, so there is
 * one drawing routine to keep correct instead of two that drift.
 */

const NS = "http://www.w3.org/2000/svg";

/**
 * Least squares over the plotted buckets.
 *
 * Fitted on index, not on date: the buckets are already evenly spaced on the
 * axis, and gaps are skipped rather than treated as zero — a week nothing
 * closed is missing data, and letting it pull the line toward zero would
 * invent a slump out of a holiday.
 *
 * Returns null under three points, because a "trend" through two is just the
 * line between them and says nothing the two bars did not already say.
 */
export function trendLine(points) {
  const seen = points.map((p, i) => [i, p.v]).filter(([, v]) => v != null);
  if (seen.length < 3) return null;
  const n = seen.length;
  const sx = seen.reduce((a, [i]) => a + i, 0);
  const sy = seen.reduce((a, [, v]) => a + v, 0);
  const sxx = seen.reduce((a, [i]) => a + i * i, 0);
  const sxy = seen.reduce((a, [i, v]) => a + i * v, 0);
  const denom = n * sxx - sx * sx;
  if (!denom) return null;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  const last = points.length - 1;
  return {
    slope,
    /* The value the fit predicts at the first and last BUCKET — including
     * buckets with no data, so the line spans the chart rather than stopping
     * short at whichever bar happened to be last. */
    start: intercept,
    end: intercept + slope * last,
    /* Change across the whole window, which is the number a person actually
     * reads off a trend line. */
    delta: slope * last,
  };
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const csvCell = (s) => (/[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));

/** One row per bucket, with the batch count beside the value: a reader who
 *  wants their own average needs to know which points are worth more. */
export function chartCsv(points, { valueLabel, unit }) {
  const head = ["Period start", "Period end", valueLabel + (unit ? ` (${unit})` : ""), "Batches"];
  const rows = points.map((p) => [p.from, p.to, p.v ?? "", p.batches ?? 0]);
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/**
 * A standalone SVG of the chart — self-contained, no CSS variables, no fonts
 * beyond a system stack, so it renders the same in a document as it does here.
 * Colours are literals rather than tokens for the same reason: the file leaves
 * the app, and a token means nothing once it does.
 */
export function chartSvg(points, { unit, line, title, subtitle, trend }) {
  const W = 880;
  const H = 360;
  const padL = 46;
  const padR = 18;
  const padT = title ? 54 : 18;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const values = points.map((p) => p.v).filter((v) => v != null);
  if (!values.length) return null;
  const lo = Math.min(line, ...values) - 2;
  const hi = Math.max(line, ...values) + 2;
  const y = (v) => padT + plotH - ((v - lo) / (hi - lo)) * plotH;
  const slot = plotW / points.length;
  const barW = Math.max(1, Math.min(34, slot * 0.68));

  const bars = points
    .map((p, i) => {
      if (p.v == null) return "";
      const x = padL + slot * i + (slot - barW) / 2;
      const top = y(p.v);
      return `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${barW.toFixed(1)}" height="${(padT + plotH - top).toFixed(1)}" rx="2" fill="${p.over ? "#9a6a12" : "#4a7b52"}" fill-opacity="0.7"/>`;
    })
    .join("");

  /* Every fourth bucket, so the axis stays readable at any window length. */
  const step = Math.max(1, Math.ceil(points.length / 8));
  const ticks = points
    .map((p, i) =>
      i % step
        ? ""
        : `<text x="${(padL + slot * i + slot / 2).toFixed(1)}" y="${H - 12}" font-size="11" fill="#a19e99" text-anchor="middle">${esc(p.from)}</text>`
    )
    .join("");

  const trendPath =
    trend && trend.slope != null
      ? `<line x1="${padL + slot / 2}" y1="${y(trend.start).toFixed(1)}" x2="${(padL + slot * (points.length - 1) + slot / 2).toFixed(1)}" y2="${y(trend.end).toFixed(1)}" stroke="#2383e2" stroke-width="2" stroke-linecap="round"/>`
      : "";

  return `<svg xmlns="${NS}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="ui-sans-serif, -apple-system, Segoe UI, Roboto, sans-serif">
<rect width="${W}" height="${H}" fill="#ffffff"/>
${title ? `<text x="${padL}" y="26" font-size="15" font-weight="600" fill="#2c2c2b">${esc(title)}</text>` : ""}
${subtitle ? `<text x="${padL}" y="44" font-size="12" fill="#7d7a75">${esc(subtitle)}</text>` : ""}
<line x1="${padL}" y1="${y(line).toFixed(1)}" x2="${W - padR}" y2="${y(line).toFixed(1)}" stroke="#d4d3cf" stroke-width="1" stroke-dasharray="4 3"/>
<text x="${W - padR}" y="${(y(line) - 5).toFixed(1)}" font-size="10" fill="#a19e99" text-anchor="end">${esc(line)}${esc(unit || "")}</text>
${bars}
${trendPath}
${ticks}
</svg>`;
}

/** Browser-only. Rasterises an SVG string at 2x through a canvas — no
 *  dependency, and the source is the same string the SVG download hands out. */
export function svgToPngBlob(svg, scale = 2) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not rasterise the chart"))), "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not rasterise the chart"));
    };
    img.src = url;
  });
}

/** Browser-only. */
export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  /* Revoked on the next tick, not immediately: Safari reads the href after
   * the click returns. */
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
