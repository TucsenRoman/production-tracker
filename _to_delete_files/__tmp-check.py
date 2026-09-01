#!/usr/bin/env python3
"""Notion DNA — automatable tests. Exits non-zero if any test fails.

Usage:  python3 tools/check.py <file.css|file.html> [more files...]

Static text analysis. Tests that need a rendered frame (T1 accent coverage,
T7 hover fill, T8 the weird move, T11 row ratio, T13 measure) are reported as
MANUAL and do not affect the exit code — check those against a screenshot.
"""
import re
import sys
import pathlib

ALLOWED_RADII = {"0", "0px", "1px", "2px", "3px", "3.5px", "4px", "6px", "8px",
                 "16px", "50%", "100%", "999px", "9999px", "inherit", "initial"}
OVERLAY_HINT = re.compile(r"(overlay|popover|menu|modal|dialog|dropdown|tooltip|toast|sheet|float)", re.I)
HEX = re.compile(r"#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b")

fails, warns, manual = [], [], []


def rgb(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def is_neutralish(r, g, b):
    return max(r, g, b) - min(r, g, b) <= 24


def check(text, name):
    # ---- T4: every neutral is warm-biased (R >= G >= B) ----
    cool = set()
    for m in HEX.finditer(text):
        h = m.group(0)
        r, g, b = rgb(h)
        if is_neutralish(r, g, b) and not (r >= g >= b):
            cool.add(h.lower())
    if cool:
        fails.append(f"T4 {name}: cool/blue-biased neutrals (need R>=G>=B): {sorted(cool)}")

    # ---- T14: no pure black, no pure-neutral grey ----
    bad = set()
    for m in HEX.finditer(text):
        h = m.group(0).lower()
        r, g, b = rgb(h)
        if (r, g, b) == (0, 0, 0):
            bad.add(h)
        elif r == g == b and h not in ("#fff", "#ffffff"):
            bad.add(h)
    if bad:
        fails.append(f"T14 {name}: pure black / pure-neutral greys: {sorted(bad)}")

    # ---- T6: radii from the allowed set only ----
    rad = set()
    for m in re.finditer(r"border-radius\s*:\s*([^;}\n]+)", text, re.I):
        for tok in m.group(1).split():
            tok = tok.strip().rstrip(";")
            if tok and tok not in ALLOWED_RADII and not tok.startswith("var("):
                rad.add(tok)
    if rad:
        fails.append(f"T6 {name}: radii outside 4/6/16/pill: {sorted(rad)}")

    # ---- T10: no webfont ----
    if re.search(r"@font-face|fonts\.googleapis|fonts\.gstatic|\.woff2?\b", text, re.I):
        fails.append(f"T10 {name}: a webfont is loaded — the OS font is the design")

    # ---- T2 / T3: type scale ----
    sizes = set()
    for m in re.finditer(r"font-size\s*:\s*([\d.]+)px", text, re.I):
        sizes.add(float(m.group(1)))
    sizes = {s for s in sizes if s >= 10}
    if sizes:
        if len(sizes) > 5:
            fails.append(f"T2 {name}: {len(sizes)} distinct font sizes ({sorted(sizes)}); max 5 in a stylesheet, 4 per frame")
        ratio = max(sizes) / min(sizes)
        if not (2.0 <= ratio <= 2.8):
            fails.append(f"T3 {name}: largest:smallest is {ratio:.2f}:1, outside 2.0-2.8:1 ({sorted(sizes)})")

    # ---- T5: no resting shadow ----
    for m in re.finditer(r"([^{}]+)\{([^}]*box-shadow\s*:\s*(?!none)[^;}]+)", text):
        sel, body = m.group(1).strip().splitlines()[-1], m.group(2)
        if OVERLAY_HINT.search(sel):
            continue
        # a pure 1px ring is the allowed hairline, not elevation
        shadow = re.search(r"box-shadow\s*:\s*([^;}]+)", body).group(1)
        if re.fullmatch(r"\s*0\s+0\s+0\s+1px\s+[^;]+", shadow):
            continue
        fails.append(f"T5 {name}: resting box-shadow on `{sel[:60]}` — shadows belong to overlays only")

    # ---- T9: nothing centred ----
    if re.search(r"text-align\s*:\s*center", text, re.I):
        fails.append(f"T9 {name}: text-align:center — this system is left-aligned without exception")

    # ---- T15: no border under a chrome strip ----
    for m in re.finditer(r"\.(crumb|breadcrumb|topbar|header|appbar)[\w-]*\s*\{([^}]*)\}", text, re.I):
        if re.search(r"border-bottom\s*:\s*(?!none|0)", m.group(2), re.I):
            fails.append(f"T15 {name}: chrome strip `.{m.group(1)}` has a bottom border — separate with whitespace")

    # ---- T12: rail width ----
    for m in re.finditer(r"\.(rail|sidebar|nav)[\w-]*\s*\{([^}]*)\}", text, re.I):
        w = re.search(r"\bwidth\s*:\s*([\d.]+)%", m.group(2))
        if w and not (17.0 <= float(w.group(1)) <= 20.0):
            fails.append(f"T12 {name}: rail width {w.group(1)}% outside 17-20%")
        if re.search(r"border-right\s*:\s*(?!none|0)", m.group(2), re.I):
            fails.append(f"T12 {name}: the rail has a right border — the colour change is the edge")

    # ---- bans that read straight off the text ----
    if re.search(r"linear-gradient|radial-gradient|conic-gradient", text, re.I):
        fails.append(f"BAN {name}: gradient found")
    if re.search(r"backdrop-filter|filter\s*:\s*blur", text, re.I):
        fails.append(f"BAN {name}: glass/blur found")
    if re.search(r"text-transform\s*:\s*uppercase", text, re.I):
        fails.append(f"BAN {name}: ALL-CAPS found")
    if re.search(r"letter-spacing\s*:\s*(?!normal|0)", text, re.I):
        warns.append(f"BAN {name}: letter-spacing set — tracking is normal everywhere")


def main():
    paths = [pathlib.Path(p) for p in sys.argv[1:]]
    if not paths:
        print(__doc__)
        return 2
    for p in paths:
        if not p.exists():
            fails.append(f"missing file: {p}")
            continue
        check(p.read_text(encoding="utf-8", errors="ignore"), p.name)

    manual.extend([
        "T1  accent coverage under 1% of the canvas",
        "T7  rows rest transparent and hover to rgba(33,27,23,.05)",
        "T8  exactly one user-chosen colour token per navigable item, none elsewhere",
        "T11 row height / text size between 2.0 and 2.7",
        "T13 body measure under 95 characters",
        "T16 chrome pads to 12px while the document pads to 8.2%",
    ])

    for f in fails:
        print("FAIL", f)
    for w in warns:
        print("WARN", w)
    print("\nMANUAL (check against a screenshot):")
    for m in manual:
        print("  ?", m)
    print(f"\n{len(fails)} failed, {len(warns)} warnings, {len(manual)} manual")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
