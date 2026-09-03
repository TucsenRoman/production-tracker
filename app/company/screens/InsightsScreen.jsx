"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  History,
  MessageCircle,
  Send,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { Button, Card, Input, StatCard, StatGrid, cx } from "../../components/ui";
import { yieldPct } from "../../lib/domain";
import { answerInsightQuestion } from "../lib/insights";

/* -------------------------------------------------------------- Insights -- */

const INSIGHT_TONE_ICON = { warn: AlertTriangle, danger: AlertTriangle, ok: CheckCircle2, neutral: Sparkles };
const INSIGHT_TONE_CLASS = { warn: "text-warn", danger: "text-danger", ok: "text-ok", neutral: "text-ink" };

/**
 * Each card can answer a follow-up about itself — scoped to that card's own
 * numbers, never the whole business — via a deterministic responder (see
 * ../lib/insights). No live model behind it yet, so an unrecognized question
 * gets an honest "don't have an answer for that" rather than a guess.
 */
function InsightCard({ card }) {
  const Icon = INSIGHT_TONE_ICON[card.tone];
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState([]);

  const ask = () => {
    const q = question.trim();
    if (!q) return;
    setThread((t) => [...t, { q, a: answerInsightQuestion(card, q) }]);
    setQuestion("");
  };

  return (
    <div className="px-4 py-3 border-b border-line last:border-b-0">
      <div className="flex items-start gap-3">
        <span className={cx("shrink-0 mt-0.5", INSIGHT_TONE_CLASS[card.tone])}>
          <Icon size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{card.title}</p>
          <p className="mt-0.5 text-xs text-ink-3 leading-relaxed">{card.detail}</p>

          {thread.length > 0 && (
            <div className="mt-2.5 space-y-2">
              {thread.map((t, i) => (
                <div key={i} className="text-xs">
                  <p className="font-medium text-ink-2">&ldquo;{t.q}&rdquo;</p>
                  <p className="mt-0.5 text-ink-3 leading-relaxed">{t.a}</p>
                </div>
              ))}
            </div>
          )}

          {asking ? (
            <div className="mt-2.5 flex items-center gap-1.5">
              <Input
                autoFocus
                value={question}
                placeholder="Ask about this…" onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ask()}
                className="flex-1"
              />
              <Button size="sm" icon={Send} onClick={ask}>
                Ask
              </Button>
            </div>
          ) : (
            <button
              type="button" onClick={() => setAsking(true)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-ink-2 hover:text-ink hover:underline transition-colors"
            >
              <MessageCircle size={12} /> Ask about this
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The console's landing screen — formerly a general Overview (onboarding
 * checklist, needs-attention list, locations at a glance), now dedicated to
 * insights, mirroring what used to be the shop floor's own Insights tab.
 *
 * Scoped by role rather than one fixed view: `insights` and `history` are
 * already pre-filtered by the caller (CompanyConsole) down to whatever
 * locations the signed-in user can see — every location for an admin, just
 * their own for a floor manager — so this component itself stays ignorant
 * of roles and just renders whatever scope it's handed. `scopeLabel`
 * describes that scope in the header (a location's name, or "company-wide").
 */
export default function InsightsScreen({ scopeLabel, insights, history }) {
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

  return (
    <div className="space-y-5">
      {scopeLabel && <p className="text-sm text-ink-3">{scopeLabel}</p>}

      <StatGrid>
        <StatCard icon={History} label="Batches closed" value={stats.batches} />
        <StatCard
          icon={CheckCircle2}
          label="Average yield" value={stats.avg}
          unit={stats.avg !== "—" ? "%" : undefined}
          tone="primary"
        />
        <StatCard
          icon={AlertTriangle}
          label="Flagged" value={stats.flagged}
          tone={stats.flagged ? "warn" : "ok"}
          hint="low yield or slow"
        />
        <StatCard
          icon={TrendingUp}
          label="Best yield" value={stats.best ? `${stats.best.y}%` : "—"}
          tone="ok" hint={stats.best?.product}
        />
      </StatGrid>

      <Card>
        <div className="px-4 py-3 border-b border-line">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Sparkles size={14} className="text-icon-2" /> Insights
          </h3>
          <p className="mt-0.5 text-xs text-ink-3">
            Rolled up from closed batches — same numbers the floor sees, compared across whatever locations you
            have access to.
          </p>
        </div>
        {insights.cards.length === 0 ? (
          <p className="px-4 py-6 text-xs text-ink-4">
            Insights show up once locations start closing batches on the floor.
          </p>
        ) : (
          <div>
            {insights.cards.map((card) => (
              <InsightCard key={card.id} card={card} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
