#!/usr/bin/env python3
"""Entity-card DNA — the automatable subset of tests[]. Exits non-zero on failure."""
import re, sys

BANS = [
    (r'text-(2xl|3xl|4xl|5xl)', 'sig 1 — a card title over 16px'),
    (r'rounded-full[^"]*(bg-sunken|bg-surface|border)', 'test 2 — a pill or chip container'),
    (r'<SectionHeading', 'test 6 — a ruled uppercase heading inside a card'),
    (r'divide-[xy]', 'test 12 — a divided panel; counts are a sentence, not tiles'),
    (r'bg-(brand|primary|ok|danger|warn)-soft', 'test 3 — a tinted band inside the card'),
    (r'variant="primary"[^>]*\bblock\b|\bblock\b[^>]*variant="primary"', 'test 5 — a filled accent button on a repeating card'),
    (r'shadow-(sm|md|lg|xl)', 'ban — a resting shadow'),
    (r'rounded-(2xl|3xl|\[)', 'sig 3 — a radius off the 4/6/12/16 ladder'),
    (r'<Badge\b', 'test 2 — status is a word, never a filled badge'),
    (r'uppercase', 'test 6 — uppercase type inside a card'),
]

START = 'ENTITY-CARD DNA'
END = re.compile(r'^\s{0,14}\}\)\}\s*$')


CARD_ROOT = re.compile(r'className="group relative[^"]*"')


def card_root_faults(block, offset):
    """Sig 3 is about ONE element — the card's outermost div — so it needs its
    own check rather than a file-wide pattern: a `border` class is legal on a
    row inside the card and illegal on the card itself."""
    faults = []
    m = CARD_ROOT.search(block)
    if not m:
        return faults
    line = offset + block[:m.start()].count('\n') + 1
    cls = m.group(0)
    if re.search(r'\bborder(?:-[a-z]|\b)', cls):
        faults.append((line, 'sig 3 — the card is a box: it carries a border'))
    if 'rounded-card' not in cls:
        faults.append((line, 'sig 3 — the card is not on the card radius (rounded-card)'))
    return faults


def region(src):
    """Only the card itself. A file may hold a detail page too, and this spec
    governs the CARD — so the scan starts at the marker comment the card
    carries and stops at the end of the map that renders it. Comments are
    stripped: a ban named in prose is not a ban committed in markup."""
    lines = src.split('\n')
    try:
        i = next(n for n, l in enumerate(lines) if START in l)
    except StopIteration:
        return None
    j = next((n for n, l in enumerate(lines) if n > i and END.match(l)), len(lines))
    block = '\n'.join(lines[i:j])
    block = re.sub(r'/\*.*?\*/', '', block, flags=re.S)
    block = re.sub(r'//[^\n]*', '', block)
    return i, block


def main(paths):
    bad = 0
    for p in paths:
        try:
            src = open(p, encoding='utf-8').read()
        except OSError as e:
            print(f'skip {p}: {e}'); continue
        found = region(src)
        if found is None:
            print(f'skip {p}: no "{START}" marker — nothing here claims this dna')
            continue
        offset, src = found
        for line, why in card_root_faults(src, offset):
            print(f'FAIL {p}:{line}  {why}')
            bad += 1
        for pat, why in BANS:
            for m in re.finditer(pat, src):
                line = offset + src[:m.start()].count('\n') + 1
                print(f'FAIL {p}:{line}  {why}  [{m.group(0)[:40]}]')
                bad += 1
    print('PASS — automatable tests only; 3, 4, 7, 9, 10, 11 need a rendered card'
          if not bad else f'{bad} failure(s)')
    return 1 if bad else 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
