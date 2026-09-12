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

/* Per-entity identity palette (see globals.css): "which location", never a status. */
const SERIES_DOT = ["bg-identity-1", "bg-identity-2", "bg-identity-3", "bg-identity-4"];

/**
 * One-tap questions per `context.type`. Each `text` contains the exact
 * keyword `answerInsightQuestion` matches, so every chip yields a real
 * answer. No "trend" chip: that branch only ever says "not enough data yet".
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
  day: [
    { label: "Why?", text: "Why is this happening?" },
    { label: "How does it compare?", text: "How does it compare to the average?" },
  ],
};

/**
 * A day's fill is the screen's one sequential encoding: yield in a single hue,
 * mixed against the `--color-ok` token so it tracks theme changes. Flagged
 * status and location identity use separate channels (corner icon, corner
 * dots) so magnitude, status and identity never compete for the same pixel.
 */
function yieldStyle(y) {
  if (y == null) return undefined;
  const t = Math.max(0, Math.min(1, (y - 55) / 40));
  const pct = Math.round(8 + t * 57);
  return { backgroundColor: `color-mix(in srgb, var(--color-ok) ${pct}%, var(--color-surface))` };
}

/**
 * Detail panel for anything with a `context` bundle — an insight card or a
 * calendar day: narrative, question chips, opt-in freeform, running thread.
 * `children` renders between the narrative and the chips (a day's batch list).
 */
function InsightDetail({ card, children }) {
  const Icon = TONE_ICON[card.tone];
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState([]);
  const [customOpen, setCustomOpen] = useState(false);

  // De-duped against the last question only: re-tapping a chip means "show
  // me that again", not "add a duplicate line".
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

      <div className="pl-[26px] mt-3">
        {children && <div className="mb-3">{children}</div>}

        {/* Chips always visible; freeform is opt-in via the last pill since
         *  it's the one path that can dead-end in a generic fallback. */}
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
 * The console's landing screen: a five-week calendar of closed batches with
 * one detail panel beside it. A selected day becomes a synthesized
 * `context.type: "day"` card through the same InsightDetail machinery as the
 * rolled-up cards; nothing selected shows `insights.cards` one at a time.
 *
 * `insights` and `history` arrive pre-filtered by CompanyConsole to the
 * locations the user can see, and each history item carries
 * `locationId`/`locationName` so multi-location days can show identity dots.
 */
export default function InsightsScreen({ scopeLabel, insights, history, targets = {} }) {
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
      const point = { ...h, y, flagged: isFlaggedBatch(h, targets) };
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
      const flaggedCount = batches.filter((b) => b.flagged).length;
      const locationIds = [...new Set(batches.map((b) => b.locationId).filter(Boolean))];
      return {
        key,
        batches,
        avgY,
        flaggedCount,
        flagged: flaggedCount > 0,
        // Location dots only mean something with more than one location in view.
        dots: multi ? locationIds.map((id) => SERIES_DOT[seenLocations.indexOf(id) % SERIES_DOT.length]) : [],
        isToday: key === today,
        isFuture: key > today,
      };
    });
  }, [history, multi, targets]);

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const selectedCell = selectedDay ? days.find((d) => d.key === selectedDay) : null;

  // Same card shape as the rolled-up insights. Tone: flagged beats
  // everything, a clear beat of the company average is good news, else neutral.
  const companyAvg = insights.company.avgYield;
  const dayCard = useMemo(() => {
    if (!selectedCell || selectedCell.batches.length === 0) return null;
    const { key, batches, avgY, flaggedCount } = selectedCell;
    const tone =
      flaggedCount > 0 ? "warn" : avgY != null && companyAvg != null && avgY - companyAvg >= 3 ? "ok" : "neutral";
    return {
      id: `day-${key}`,
      tone,
      title: `${batches.length} batch${batches.length === 1 ? "" : "es"} closed`,
      detail: `${avgY}% average yield${flaggedCount ? `, ${flaggedCount} flagged` : ""}.`,
      context: { type: "day", key, batches, avgY, flaggedCount, companyAvg },
    };
  }, [selectedCell, companyAvg]);

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
              {dayCard ? (
                <InsightDetail key={dayCard.id} card={dayCard}>
                  <ul className="space-y-2">
                    {selectedCell.batches.map((b) => (
                      <li key={b.id} className="flex items-baseline justify-between gap-2">
                        <span className="text-xs text-ink-2 truncate">
                          {b.product}
                          {b.locationName && <span className="text-ink-4"> · {b.locationName}</span>}
                        </span>
                        <span className={cx("text-xs font-medium tnum shrink-0", b.flagged ? "text-warn" : "text-ink-3")}>
                          {b.y}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </InsightDetail>
              ) : (
                <p className="text-xs text-ink-4">No batches closed this day.</p>
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
