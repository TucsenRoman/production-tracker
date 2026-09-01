/**
 * Micro-consistency audit — the failures check.py cannot see.
 *
 * check.py reads source text: it catches a banned gradient or a cool grey.
 * It cannot catch a 36px search field standing beside a 28px button, because
 * neither is wrong on its own — only together, and only once rendered.
 *
 * This drives the running app, groups every control by the visual row it sits
 * on, and reports rows that mix heights, radii or font sizes. It also prints
 * every distinct control height on each page: that histogram is the real
 * signal. Two entries is a system. Six is a page that grew one control at a
 * time.
 *
 *   node tools/audit-consistency.js http://localhost:3000
 *
 * Adapt SCREENS and the sign-in block to the app under test.
 */
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:3000";
const SCREENS = ["Production board", "Schedule", "Inventory", "Insights", "Team & PINs"];
const SIGN_IN = { selector: "#pin", value: "4059" };

const AUDIT = () => {
  const cs = getComputedStyle;
  const ctl = [...document.querySelectorAll("button,input,select,textarea,[role=button],[role=tab]")]
    .filter((e) => {
      const r = e.getBoundingClientRect();
      // nextjs-portal is the dev overlay — not part of the design.
      return r.width > 8 && r.height > 8 && cs(e).visibility !== "hidden" && !e.closest("nextjs-portal");
    })
    .map((e) => {
      const r = e.getBoundingClientRect(), s = cs(e);
      return {
        y: Math.round(r.top + r.height / 2),
        h: Math.round(r.height * 10) / 10,
        rad: s.borderRadius.split(" ")[0],
        fs: s.fontSize,
        label: (e.getAttribute("aria-label") || e.getAttribute("placeholder") ||
                e.textContent.trim() || e.type || e.tagName).slice(0, 22),
      };
    });

  // Controls within 6px of the same vertical centre are on the same visual row.
  const rows = [];
  ctl.forEach((c) => {
    const g = rows.find((r) => Math.abs(r.y - c.y) <= 6);
    g ? g.items.push(c) : rows.push({ y: c.y, items: [c] });
  });

  const out = { heights: [], radii: [], fonts: [], allHeights: {}, allRadii: {} };
  rows.forEach((r) => {
    if (r.items.length < 2) return;
    const show = (k) => r.items.map((i) => `${i.label}=${i[k]}`).join("  ");
    const hs = [...new Set(r.items.map((i) => i.h))];
    // 1.5px of slack: a border difference is not an inconsistency.
    if (hs.length > 1 && Math.max(...hs) - Math.min(...hs) > 1.5) out.heights.push({ y: r.y, v: show("h") });
    const rr = [...new Set(r.items.map((i) => i.rad))].filter((v) => v !== "0px" && !/9999|50%|e\+/.test(v));
    if (rr.length > 1) out.radii.push({ y: r.y, v: show("rad") });
    if ([...new Set(r.items.map((i) => i.fs))].length > 1) out.fonts.push({ y: r.y, v: show("fs") });
  });
  ctl.forEach((c) => {
    out.allHeights[c.h] = (out.allHeights[c.h] || 0) + 1;
    out.allRadii[c.rad] = (out.allRadii[c.rad] || 0) + 1;
  });
  return out;
};

const report = (name, a) => {
  console.log(`\n=== ${name}`);
  console.log("  control heights:", JSON.stringify(a.allHeights));
  console.log("  control radii:  ", JSON.stringify(a.allRadii));
  a.heights.forEach((h) => console.log(`  MIXED HEIGHT y=${h.y}  ${h.v}`));
  a.radii.forEach((h) => console.log(`  MIXED RADIUS y=${h.y}  ${h.v}`));
  a.fonts.forEach((h) => console.log(`  MIXED FONT   y=${h.y}  ${h.v}`));
  return a.heights.length + a.radii.length + a.fonts.length;
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE, { waitUntil: "networkidle" });
  if (await p.$(SIGN_IN.selector)) {
    await p.fill(SIGN_IN.selector, SIGN_IN.value);
    await p.keyboard.press("Enter");
    await p.waitForTimeout(1300);
  }
  let issues = 0;
  for (const n of SCREENS) {
    await p.click(`nav button:has-text("${n}")`).catch(() => {});
    await p.waitForTimeout(700);
    issues += report(n, await p.evaluate(AUDIT));
  }
  await b.close();
  console.log(`\n${issues} mixed rows`);
  process.exit(issues ? 1 : 0);
})();
