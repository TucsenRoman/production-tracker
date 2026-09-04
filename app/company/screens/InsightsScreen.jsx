"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, MessageCircle, Send, Sparkles } from "lucide-react";

import { Button, Input, cx } from "../../components/ui";
import { formatDay, shiftDate, todayKey, yieldPct } from "../../lib/domain";
import { answerInsightQuestion, isFlaggedBatch } from "../lib/insights";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const GRID_DAYS = 35; // five Sun–Sat weeks, always a full 5x7 block regardless of how the data falls

const TONE_ICON = { warn: AlertTriangle, danger: AlertTriangle, ok: CheckCircle2, neutral: Sparkles };
const TONE_TEXT = { warn: "text-warn", danger: "text-danger", ok: "text-ok", neutral: "text-ink-2" };

/* Same per-entity identity palette as the old multi-line trend chart used —
 * "deliberately its own hue family per swatch" (see globals.css), the right
 * choice for "which location," never a status. */
const SERIES_DOT = ["bg-identity-1", "bg-identity-2", "bg-identity-3", "bg-identity-4"];

/**
 * One-tap questions per insight type, phrased as real questions but each
 * containing the exact keyword `answerInsightQuestion` (../lib/insights)
 * matches for that card's `context.type` — so every chip is a *guaranteed*
 * real answer, not a guess at phrasing the deterministic responder might
 * not recognize. Freeform typing is still there for anything else, just no
 * longer the only way in. No "trend" chip: the responder's trend branch
 * always returns the same "not enough data yet" line today, so a button
 * that always disappoints isn't worth offering.
 */
const QUICK_QUESTIONS = {
  location: [
    { label: "Why?", text: "Why is this happening?" },
    { label: "How does it compare?", text: "How does it compare to other locations?" },
  ],
  station: [
    { label: "Why?", text: "Why is this happening?" },
    { label: "How does it compare?", text: "How does it compare across locations?" },
  ],
  overall: [{ label: "Why?", text: "Why is this happening?" }],
};

/**
 * A day's fill is the one sequential encoding on the whole screen: how good
 * was that day, in one hue (`--color-ok`) from barely-there to solid,
 * via `color-mix` against the real token rather than a hand-duplicated hex —
 * if the token ever moves, this moves with it. Flagged status and location
 * identity are deliberately separate visual channels (a corner icon, corner
 * dots) so magnitude, status and identity are never fighting for the same
 * pixel.
 */
function yieldStyle(y) {
  if (y == null) return undefined;
  const t = Math.max(0, Math.min(1, (y - 55) / 40));
  const pct = Math.round(8 + t * 57);
  return { backgroundColor: `color-mix(in srgb, var(--color-ok) ${pct}%, var(--color-surface))` };
}

/**
 * The detail panel's content when an insight (rather than a day) is
 * selected — same deterministic per-card "Ask about this" Q&A the old
 * card list had (see ../lib/insights), just with one insight in view at a
 * time instead of several boxes stacked on the page at once.
 */
function InsightDetail({ card }) {
  const Icon = TONE_ICON[card.tone];
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState([]);
  const [customOpen, setCustomOpen] = useState(false);

  // De-duped against the last question asked, not the whole thread -- a
  // second tap of the same chip re-reads as "show me that again," not as
  // a demand for a fresh duplicate line.
  const ask = (raw) => {
    const q = (raw ?? question).trim();
    if (!q) return;
    setThread((t) => (t.length && t[t.length - 1].q === q ? t : [...t, { q, a: answerInsightQuestion(card, q) }]));
    setQuestion("");
  };

  const quick = QUICK_QUESTIONS[card.context?.type] || [];

  return (
    <div>
      <div className="flex items-start gap-2.5">
        <span className={cx("shrink-0 mt-0.5", TONE_TEXT[card.tone])}>
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{card.title}</p>
          <p className="mt-1 text-xs text-ink-3 leading-relaxed">{card.detail}</p>
        </div>
      </div>

      {/* Chips first, always visible -- no click just to find out this is
       *  interactive. Each one is a guaranteed real answer (see
       *  QUICK_QUESTIONS above); freeform is opt-in via the last pill,
       *  since it's the one path that can dead-end in a generic fallback. */}
      <div className="pl-[26px] mt-3">
        <div className="flex items-center flex-wrap gap-1.5">
          {quick.map((qq) => (
            <button
              key={qq.label}
              type="button"
              onClick={() => ask(qq.text)}
              aria-label={qq.text}
              className="inline-flex items-center h-6 px-2.5 rounded-full border border-line bg-surface text-xs font-medium text-ink-2 hover:border-ink-3 hover:text-ink transition-colors"
            >
              {qq.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCustomOpen((v) => !v)}
            aria-expanded={customOpen}
            aria-label="Ask your own question about this insight"
            className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full border border-line bg-surface text-xs font-medium text-ink-2 hover:border-ink-3 hover:text-ink transition-colors"
          >
            <MessageCircle size={11} /> Ask something else
          </button>
        </div>

        {customOpen && (
          <div className="mt-2 flex items-center gap-1.5">
            <Input
              autoFocus
              value={question}
              placeholder="Ask about this…"
              aria-label="Ask a question about this insight"
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
              className="flex-1"
            />
            <Button size="sm" icon={Send} onClick={() => ask()} aria-label="Send question">
              Ask
            </Button>
          </div>
        )}

        {thread.length > 0 && (
          <div className="mt-3 space-y-2" role="log" aria-live="polite" aria-label="Answers">
            {thread.map((t, i) => (
              <div key={i} className="text-xs rounded-md bg-sunken px-2.5 py-2">
                <p className="font-medium text-ink-2">&ldquo;{t.q}&rdquo;</p>
                <p className="mt-0.5 text-ink-3 leading-relaxed">{t.a}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The console's landing screen — formerly a general Overview (onboarding
 * checklist, needs-attention list, locations at a glance), then a stack of
 * stat tiles + a trend chart + a card list. This version is one thing: a
 * five-week calendar of closed batches, sized to actually use the page,
 * with a single detail panel beside it instead of a page of separate
 * sections. Click a day to see what closed on it; nothing selected shows
 * the highest-priority rolled-up insight instead (same content the old
 * card list had — `insights.cards`, already sorted by tone — just one at a
 * time, paged with the small dots rather than stacked as boxes).
 *
 * Scoped by role rather than one fixed view: `insights` and `history` are
 * already pre-filtered by the caller (CompanyConsole) down to whatever
 * locations the signed-in user can see, and each `history` item now
 * carries `locationId`/`locationName` (tagged by CompanyConsole) so a day
 * with batches from more than one location can show which via small
 * identity-coloured dots instead of needing a separate per-location view.
 */
export default function InsightsScreen({ scopeLabel, insights, history }) {
  const [selectedDay, setSelectedDay] = useState(null);
  const [insightIndex, setInsightIndex] = useState(0);

  const stats = useMemo(() => {
    const best = history.reduce((acc, h) => {
      const y = yieldPct(h.boxWeight, h.finalWeight);
      return y != null && (!acc || y > acc.y) ? { y, product: h.product } : acc;
    }, null);
    return {
      batches: insights.company.batches,
      avg: insights.company.avgYield != null ? insights.company.avgYield : "—",
      flagged: insights.company.flagged,
      best,
    };
  }, [history, insights]);

  const multi = insights.byLocation.length > 1;

  const days = useMemo(() => {
    const today = todayKey();
    const dow = new Date(`${today}T00:00:00`).getDay();
    const endKey = shiftDate(today, 6 - dow); // this week's Saturday, so every row is a full Sun–Sat week
    const startKey = shiftDate(endKey, -(GRID_DAYS - 1));

    const byDate = new Map();
    for (const h of history) {
      const y = yieldPct(h.boxWeight, h.finalWeight);
      if (y == null || !h.closedOn) continue;
      const point = { ...h, y, flagged: isFlaggedBatch(h) };
      const list = byDate.get(h.closedOn);
      if (list) list.push(point);
      else byDate.set(h.closedOn, [point]);
    }

    // Stable location -> colour assignment, in first-appearance order, so a
    // location keeps the same dot colour on every day it shows up.
    const seenLocations = [];
    for (const list of byDate.values()) {
      for (const b of list) {
        if (b.locationId && !seenLocations.includes(b.locationId)) seenLocations.push(b.locationId);
      }
    }

    return Array.from({ length: GRID_DAYS }, (_, i) => {
      const key = shiftDate(startKey, i);
      const batches = byDate.get(key) || [];
      const avgY = batches.length
        ? Math.round((batches.reduce((a, b) => a + b.y, 0) / batches.length) * 10) / 10
        : null;
      const locationIds = [...new Set(batches.map((b) => b.locationId).filter(Boolean))];
      return {
        key,
        batches,
        avgY,
        flagged: batches.some((b) => b.flagged),
        // Only worth marking whose location a batch belongs to when there's
        // more than one in view -- on a single-location scope every dot
        // would just repeat the same colour on every day, telling the
        // viewer nothing they don't already know from the header.
        dots: multi ? locationIds.map((id) => SERIES_DOT[seenLocations.indexOf(id) % SERIES_DOT.length]) : [],
        isToday: key === today,
        isFuture: key > today,
      };
    });
  }, [history, multi]);

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const selectedCell = selectedDay ? days.find((d) => d.key === selectedDay) : null;
  const activeCard = insights.cards[insightIndex] || insights.cards[0] || null;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-bold text-ink">Insights</h1>
          {scopeLabel && <p className="mt-0.5 text-sm text-ink-3">{scopeLabel}</p>}
        </div>
        <p className="text-sm text-ink-3 tnum">
          <span className="font-semibold text-ink">{stats.batches}</span> batches ·{" "}
          <span className="font-semibold text-ink">
            {stats.avg}
            {stats.avg !== "—" ? "%" : ""}
          </span>{" "}
          avg yield · <span className={cx("font-semibold", stats.flagged ? "text-warn" : "text-ink")}>{stats.flagged}</span>{" "}
          flagged · best <span className="font-semibold text-ok">{stats.best ? `${stats.best.y}%` : "—"}</span>
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ------------------------------------------------------ Calendar */}
        <div className="flex-1 min-w-0 w-full">
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {WEEKDAY_LABELS.map((d, i) => (
              <div key={i} className="text-center text-xs text-ink-4">
                {d}
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1.5">
                {week.map((day) => {
                  const hasData = day.batches.length > 0;
                  const dayNum = new Date(`${day.key}T00:00:00`).getDate();
                  const selected = selectedDay === day.key;
                  return (
                    <button
                      key={day.key}
                      type="button"
                      disabled={!hasData}
                      onClick={() => setSelectedDay(selected ? null : day.key)}
                      style={yieldStyle(day.avgY)}
                      className={cx(
                        "relative aspect-square rounded-md border text-left p-1.5 transition-colors",
                        hasData ? "border-line-strong cursor-pointer hover:border-ink-3" : "border-line-soft",
                        !hasData && !day.isFuture && "bg-sunken",
                        day.isFuture && "opacity-40",
                        selected && "ring-2 ring-ink-3 ring-offset-1"
                      )}
                    >
                      <span className={cx("text-[11px] tnum", hasData ? "text-ink-2" : "text-ink-4")}>{dayNum}</span>
                      {day.isToday && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-ink-3" />}
                      {hasData && (
                        <span className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold text-ink tnum">{day.avgY}%</span>
                          {day.flagged && <AlertTriangle size={11} className="text-warn shrink-0" />}
                        </span>
                      )}
                      {day.dots.length > 0 && (
                        <span className="absolute top-1.5 left-1.5 flex gap-0.5">
                          {day.dots.map((c, i) => (
                            <span key={i} className={cx("w-1.5 h-1.5 rounded-full", c)} />
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs text-ink-3">
            <span className="flex items-center gap-1.5">
              <span className="flex items-center gap-0.5">
                {[15, 35, 55, 75].map((pct) => (
                  <span
                    key={pct}
                    className="w-3 h-3 rounded-sm border border-line"
                    style={{ backgroundColor: `color-mix(in srgb, var(--color-ok) ${pct}%, var(--color-surface))` }}
                  />
                ))}
              </span>
              Lower &rarr; higher yield
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle size={11} className="text-warn" /> Flagged
            </span>
            {multi &&
              insights.byLocation.map((l, i) => (
                <span key={l.locationId} className="flex items-center gap-1.5">
                  <span className={cx("w-2 h-2 rounded-full", SERIES_DOT[i % SERIES_DOT.length])} /> {l.name}
                </span>
              ))}
          </div>
        </div>

        {/* -------------------------------------------------- Detail panel */}
        <div className="w-full lg:w-80 shrink-0 rounded-md border border-line bg-surface p-4 lg:sticky lg:top-6">
          {selectedCell ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-ink">{formatDay(selectedCell.key)}</p>
                <button type="button" onClick={() => setSelectedDay(null)} className="text-xs text-ink-3 hover:text-ink">
                  Clear
                </button>
              </div>
              {selectedCell.batches.length === 0 ? (
                <p className="text-xs text-ink-4">No batches closed this day.</p>
              ) : (
                <ul className="space-y-3">
                  {selectedCell.batches.map((b) => (
                    <li key={b.id}>
                      <p className="text-sm text-ink font-medium">{b.product}</p>
                      <p className="mt-0.5 text-xs text-ink-3">
                        {b.locationName ? `${b.locationName} · ` : ""}
                        <span className={b.flagged ? "text-warn font-medium" : "text-ink-2 font-medium"}>{b.y}% yield</span>
                        {b.flagged ? " · flagged" : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : activeCard ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Insight</p>
                {insights.cards.length > 1 && (
                  <div className="flex items-center gap-1">
                    {insights.cards.map((c, i) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setInsightIndex(i)}
                        aria-label={`Insight ${i + 1} of ${insights.cards.length}`}
                        className={cx("w-1.5 h-1.5 rounded-full transition-colors", i === insightIndex ? "bg-ink-2" : "bg-line-strong")}
                      />
                    ))}
                  </div>
                )}
              </div>
              <InsightDetail key={activeCard.id} card={activeCard} />
            </div>
          ) : (
            <p className="text-xs text-ink-4">Insights show up once locations start closing batches on the floor.</p>
          )}
        </div>
      </div>
    </div>
  );
}
