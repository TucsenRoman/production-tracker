#!/usr/bin/env python3
"""Mechanical checks for the Floor Task List design DNA.

Scans source text (JSX/TSX/CSS) for violations that can be caught
without a running page. Exits non-zero if any check fails.

Usage: python3 check.py <file-or-dir> [<file-or-dir> ...]
"""
import re
import sys
from pathlib import Path

CHECKS = []


def check(name):
    def deco(fn):
        CHECKS.append((name, fn))
        return fn
    return deco


@check("no card border/shadow wrapping a list row or category section")
def no_card_wrap(text):
    # A row/section shouldn't carry rounded+border+shadow together (that's a card).
    bad = re.findall(r'className="[^"]*\brounded-(?:md|lg|xl)\b[^"]*\bborder\b[^"]*\bshadow\b[^"]*"', text)
    return [] if not bad else [f"card-like className: {m[:80]}" for m in bad]


@check("only one primary/accent color token used for controls")
def one_accent(text):
    accents = set(re.findall(r'bg-(primary|accent|blue-\d+|red-\d+|green-\d+|amber-\d+)\b', text))
    # amber/red are allowed for priority pills specifically; flag anything beyond primary + one pill tint
    extra = accents - {"primary"}
    return [] if len(extra) <= 1 else [f"multiple accent-ish colors found: {sorted(accents)}"]


@check("no permanent (non-hover-gated) edit/delete icon button in a row")
def hover_gated_actions(text):
    # crude: a Trash2/Pencil usage should be near an opacity-0/group-hover class in the same className blob
    icon_lines = [l for l in text.splitlines() if re.search(r'<(Trash2|Pencil)\b', l)]
    bad = []
    for l in icon_lines:
        window = l
        if "opacity-0" not in window and "group-hover" not in window:
            bad.append(l.strip()[:100])
    return bad


@check("at most 4 distinct text-size utility classes in one file")
def type_size_cap(text):
    sizes = set(re.findall(r'\btext-(xs|sm|base|lg|xl|2xl|3xl|\[\d+px\])\b', text))
    return [] if len(sizes) <= 4 else [f"{len(sizes)} distinct sizes: {sorted(sizes)}"]


@check("category section heading uses uppercase, nothing else does")
def uppercase_scope(text):
    non_heading_uppercase = re.findall(r'className="[^"]*\buppercase\b[^"]*"\s*[^>]*>\s*\{?[A-Za-z][a-z]', text)
    # heuristic only — flag if uppercase appears far more than once per plausible heading
    count = text.count("uppercase")
    return [] if count <= 3 else [f"'uppercase' used {count} times — verify each is a category heading"]


def gather_text(paths):
    exts = {".jsx", ".tsx", ".js", ".ts", ".css"}
    out = []
    for p in paths:
        p = Path(p)
        if p.is_dir():
            for f in p.rglob("*"):
                if f.suffix in exts and "node_modules" not in f.parts:
                    out.append(f.read_text(errors="ignore"))
        elif p.is_file():
            out.append(p.read_text(errors="ignore"))
    return "\n".join(out)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    text = gather_text(sys.argv[1:])
    failed = False
    for name, fn in CHECKS:
        problems = fn(text)
        status = "PASS" if not problems else "FAIL"
        print(f"[{status}] {name}")
        for p in problems[:5]:
            print(f"    - {p}")
        if problems:
            failed = True
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
