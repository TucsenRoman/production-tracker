"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Copy, PanelRightClose, Send, Sparkles, X } from "lucide-react";

import { Button, Input, ScrollArea, cx, useToast } from "../../components/ui";
import { answerInsightQuestion, planPageCommand } from "../lib/insights";

/**
 * The console's assistant: one thread, two ways in.
 *
 * It used to be a `Popover` hung off a pill in the Insights toolbar, which
 * was wrong for a reason that only showed up once it could DRIVE the page —
 * a floating panel covers the thing it is changing. You would say "show
 * flagged only" and the chart you were meant to watch was behind the panel.
 * It lives in a third column now and the page underneath never moves.
 *
 * Being app-level rather than screen-level buys three things the Popover
 * could not have:
 *   - the thread survives closing the panel AND navigating between screens,
 *     because it is held here, not in the panel;
 *   - the highlight trigger and the rail button open the SAME conversation,
 *     differing only in what they scope the next question to;
 *   - a screen publishes its own context and its own command vocabulary, so
 *     the assistant is not an Insights feature wearing a shell.
 *
 * What it is NOT is a chat with a memory. Every question is a single turn
 * against a bounded rollup — the thread is never fed back in. That one rule
 * is what keeps cost flat and makes compaction, token accounting and server
 * state unnecessary. Keep it.
 */
const AssistantContext = createContext(null);

export const useAssistant = () => useContext(AssistantContext);

/**
 * A screen publishes what the assistant may read and do while that screen is
 * on. `source` MUST be memoized by the caller — it is the effect's only
 * dependency, and a fresh object each render would loop.
 *
 * Shape: `{ card, scopeLine, products, stations, onCommand }`. `card` is the
 * same `{ id, title, context }` shape the Q&A has always taken, so a screen
 * that already builds one has nothing new to write.
 */
export function useAssistantSource(source) {
  const ctx = useContext(AssistantContext);
  const publish = ctx?.publish;
  useEffect(() => {
    if (!publish) return undefined;
    publish(source);
    return () => publish(null, source);
  }, [publish, source]);
}

/**
 * One-tap questions per `context.type`, for the contexts a highlight can
 * raise. The period's own chips are generated from what is actually unusual
 * in the window — see `suggestionsFor` — because a fixed menu on the screen
 * people actually use is a menu of questions nobody has.
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
  product: [
    { label: "Why?", text: "Why is this happening?" },
    { label: "Trend?", text: "What is the trend?" },
    { label: "A year ago?", text: "Where was this a year ago?" },
    { label: "How does it compare?", text: "How does it compare to the average?" },
  ],
};

/**
 * Questions and instructions in one rail, deliberately mixed: the first
 * command chip somebody taps is how they find out the panel can move the
 * page at all.
 */
function suggestionsFor(card) {
  const ctx = card?.context;
  if (!ctx) return [];
  if (ctx.type !== "period") return QUICK_QUESTIONS[ctx.type] || [];

  const { stats, byProduct = [], byStation = [], yearAgo } = ctx;
  const out = [{ label: "What should I look at?", text: "What should I look at?" }];
  if (byProduct.length > 1) out.push({ label: "Which product is weakest?", text: "Which product is weakest?" });
  if (stats?.flagged) out.push({ label: "Show flagged only", text: "Show the flagged products" });
  const over = byStation.filter((s) => s.overCount > 0).sort((a, b) => b.overPct - a.overPct)[0];
  if (over) out.push({ label: `Chart ${over.station} times`, text: `Show ${over.station} times` });
  if (yearAgo?.batches) out.push({ label: "Versus a year ago?", text: "How does this compare with a year ago?" });
  return out.slice(0, 4);
}

/**
 * The empty state's examples are all INSTRUCTIONS, never questions. Nobody
 * has trouble guessing they can ask a thing called Ask a question; what no
 * one guesses is that it will move the page. The chips below the thread
 * already carry the questions worth asking.
 */
function examplesFor(card) {
  const ctx = card?.context;
  if (ctx?.type !== "period") return [];
  const station = ctx.byStation?.[0]?.station;
  return [
    ctx.stats?.flagged ? "Show the flagged products" : "Show the weakest product",
    "Show me the last 3 months",
    station ? `Chart ${station} times` : null,
  ].filter(Boolean);
}

export function AssistantProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState([]);
  /* What a highlight narrowed the next question to: `{ label, card }`. It is
   * a layer ON TOP of the page's own context, not a replacement for it, and
   * it is removable — you highlight a number, ask about it, then drop the
   * chip and carry on asking about the screen. */
  const [subject, setSubject] = useState(null);
  const [source, setSource] = useState(null);

  /* `publish(null, prev)` is the unmount half: a screen clears only its OWN
   * registration, so a fast navigation cannot have the outgoing screen wipe
   * the incoming one's. */
  const publish = useCallback((next, prev) => {
    setSource((cur) => (next === null ? (cur === prev ? null : cur) : next));
  }, []);

  const openWith = useCallback((next) => {
    setSubject(next ?? null);
    setOpen(true);
  }, []);

  const ask = useCallback(
    (raw) => {
      const q = (raw || "").trim();
      if (!q || !source) return;
      const card = subject?.card ?? source.card;
      if (!card) return;
      const scope = [subject?.label, source.scopeLine].filter(Boolean).join(" · ");

      /* Only the period context can be DRIVEN. The other cards carry no
       * product or station rollups, so a planner run against one would be
       * guessing from empty arrays — and a wrong filter is a silently wrong
       * figure on every number on screen. */
      const plan =
        card.context?.type === "period"
          ? planPageCommand(card.context, q, { products: source.products, stations: source.stations })
          : null;
      if (plan) source.onCommand?.(plan);

      setThread((t) => [
        ...t,
        { q, a: plan ? plan.say : answerInsightQuestion(card, q), did: !!plan && plan.kind !== "none", scope },
      ]);
    },
    [source, subject]
  );

  const value = useMemo(
    () => ({ open, setOpen, openWith, thread, clear: () => setThread([]), ask, source, publish, subject, setSubject }),
    [open, openWith, thread, ask, source, publish, subject]
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

/* ------------------------------------------------------------- Panel -- */

export function AssistantPanel() {
  const { setOpen, thread, ask, source, subject, setSubject } = useAssistant();
  const [question, setQuestion] = useState("");
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const toast = useToast();

  const card = subject?.card ?? source?.card ?? null;
  const suggestions = useMemo(() => suggestionsFor(card), [card]);
  const examples = useMemo(() => examplesFor(card), [card]);
  const scopeLine = source?.scopeLine ?? "";

  const send = (raw) => {
    const q = (raw ?? question).trim();
    if (!q) return;
    ask(q);
    setQuestion("");
  };

  /* Keep the newest answer in view without moving the input. */
  useEffect(() => {
    if (thread.length) endRef.current?.scrollIntoView({ block: "end" });
  }, [thread]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /**
   * Markdown. An answer is only true of the window and filter it was asked
   * under — "Applewood Bacon is the weakest at 74.1%" is false a scrub later
   * — so an export without its scope would be a quotable falsehood. The
   * scope prints wherever it CHANGED, starting with the first entry: on
   * screen the header carries the current one, but a pasted transcript has
   * no header to lean on.
   */
  const copyAll = async () => {
    let last = null;
    const body = thread
      .map((t) => {
        const head = t.scope === last ? "" : `_${t.scope}_\n\n`;
        last = t.scope;
        return `${head}**${t.q}**\n\n${t.a}`;
      })
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(`### Ask · ProTrack\n\n${body}\n`);
      toast("Chat copied", { detail: thread.length === 1 ? "1 answer" : `${thread.length} answers` });
    } catch {
      toast("Couldn't copy", { tone: "error", detail: "Your browser blocked clipboard access." });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header — the panel's spine. Its scope line is the CURRENT one; each
        * turn below carries the scope it was asked under, which is what lets
        * a thread outlive the window that started it. */}
      <div className="shrink-0 flex items-start justify-between gap-2 px-4 py-3 border-b border-line">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">Ask</p>
          <p className="mt-0.5 text-xs text-ink-4 truncate">{scopeLine || "Nothing to ask about on this screen yet"}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {thread.length > 0 && (
            <button
              type="button"
              onClick={copyAll}
              aria-label="Copy chat"
              title="Copy chat"
              className="w-7 h-7 flex items-center justify-center rounded-md text-ink-3 hover:text-ink hover:bg-hover transition-colors"
            >
              <Copy size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close the assistant"
            className="w-7 h-7 flex items-center justify-center rounded-md text-ink-3 hover:text-ink hover:bg-hover transition-colors"
          >
            <PanelRightClose size={14} />
          </button>
        </div>
      </div>

      {/* The highlight's subject, when there is one. A chip rather than a
        * mode: it scopes the next question and you drop it to go back to
        * asking about the screen. */}
      {subject && (
        <div className="shrink-0 px-4 py-2 border-b border-line-soft">
          <span className="inline-flex items-center gap-1.5 max-w-full pl-2 pr-1 py-1 rounded-full bg-sunken text-xs text-ink">
            <span className="truncate">{subject.label}</span>
            <button
              type="button"
              onClick={() => setSubject(null)}
              aria-label="Ask about the whole screen instead"
              className="shrink-0 text-ink-4 hover:text-ink"
            >
              <X size={12} />
            </button>
          </span>
        </div>
      )}

      {thread.length > 0 ? (
        <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar" role="log" aria-live="polite" aria-label="Answers">
          {/* `min-h-full` + `justify-end` sits a short thread on the composer
            * instead of stranding it at the top of a tall empty column, and
            * still scrolls normally once it outgrows the panel. */}
          <div className="min-h-full flex flex-col justify-end px-4 py-3.5 space-y-4">
          {/* A turn, not a titled block: the question sits right in a quiet
            * bubble, the answer sits left as plain prose. Side and shape carry
            * the speaker, so there are no rules between entries — ruling
            * between turns made a conversation look like a list of records. */}
          {thread.map((t, i) => (
            <div key={i} className="space-y-2">
              {/* The scope prints where it CHANGED, which makes the page's own
                * movement legible: you see the question that moved it, and
                * read what follows as being about somewhere else. Not on the
                * first turn — the header is already saying it. */}
              {i > 0 && t.scope !== thread[i - 1].scope && (
                <p className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-ink-4">
                  <span className="h-px w-3 shrink-0 bg-line" aria-hidden="true" />
                  <span className="truncate">{t.scope}</span>
                  <span className="h-px flex-1 bg-line" aria-hidden="true" />
                </p>
              )}
              <div className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-sunken px-3 py-1.5 text-sm text-ink">{t.q}</p>
              </div>
              <p className={cx("text-sm leading-relaxed", t.did ? "text-ink" : "text-ink-2")}>
                {/* A command reads back with the mark the toolbar controls use,
                  * so "I changed the page" is visible at a glance and not just
                  * implied by the wording. */}
                {t.did && <Sparkles size={12} className="inline-block mr-1.5 -mt-0.5 text-ink-3" aria-hidden="true" />}
                {t.a}
              </p>
            </div>
          ))}
          <div ref={endRef} />
          </div>
        </div>
      ) : (
        /* The empty state is the panel's whole first impression, and it has
         * one job: say that this thing can DO something, not just answer. */
        <div className="flex-1 min-h-0 flex flex-col justify-end px-4 pb-1">
          <p className="text-sm text-ink-2 leading-relaxed">
            Ask about what&rsquo;s on screen &mdash; or tell it what to show.
          </p>
          {examples.length > 0 && (
            <ul className="mt-3 space-y-1">
              {examples.map((e) => (
                <li key={e}>
                  <button
                    type="button"
                    onClick={() => send(e)}
                    className="text-left text-xs text-ink-3 hover:text-ink transition-colors"
                  >
                    <Sparkles size={11} className="inline-block mr-1.5 -mt-0.5 text-ink-4" aria-hidden="true" />
                    &ldquo;{e}&rdquo;
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink-4 leading-relaxed">
            Every answer is scoped to the window and filter above, and says so. Highlight anything on the page to ask
            about just that.
          </p>
        </div>
      )}

      <div className="shrink-0 p-4">
        {/* One row that scrolls rather than two that wrap: suggestions are a
          * rail you skim along, and a wrapping block changed the panel's
          * height every time the window changed how many there were. */}
        {suggestions.length > 0 && (
          <ScrollArea axis="x" arm fade className="mb-2.5">
            <div className="flex items-center gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => send(s.text)}
                  className="inline-flex items-center h-7 px-2.5 rounded-full border border-line bg-surface text-xs font-medium text-ink-2 hover:border-ink-3 hover:text-ink transition-colors shrink-0"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
        <div className="flex items-center gap-1.5">
          <Input
            ref={inputRef}
            value={question}
            placeholder="Ask, or say what to show…"
            aria-label="Ask about this screen, or tell it what to show"
            disabled={!card}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            className="flex-1"
          />
          <Button size="sm" icon={Send} onClick={() => send()} disabled={!card} aria-label="Send question">
            Ask
          </Button>
        </div>
      </div>
    </div>
  );
}
