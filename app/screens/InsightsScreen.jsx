"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  History,
  TrendingDown,
  TrendingUp,
  UserCheck,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ProgressBar,
  SearchInput,
  Segmented,
  StatCard,
  StatGrid,
  cx,
} from "../components/ui";
import {
  LOW_YIELD_PCT,
  STAGE_TARGET_MINUTES,
  STATIONS,
  formatDay,
  isOverTarget,
  yieldPct,
  yieldTone,
} from "../lib/domain";

/** Yield and station-time for one batch against every other run of that product. */
function BatchComparison({ record, peers }) {
  const mine = yieldPct(record.boxWeight, record.finalWeight);
  const withYield = peers.filter((p) => yieldPct(p.boxWeight, p.finalWeight) != null);

  const avg = withYield.length
    ? withYield.reduce((sum, p) => sum + yieldPct(p.boxWeight, p.finalWeight), 0) / withYield.length
    : null;
  const delta = avg != null && mine != null ? mine - avg : null;

  const rows = [...withYield, record]
    .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
    .sort((a, b) => String(a.closedOn || "").localeCompare(String(b.closedOn || "")));

  const stations = record.minutes ? STATIONS.filter((s) => record.minutes[s] != null) : [];

  return (
    <div className="mt-4 pt-4 border-t border-line space-y-5">
      <section>
        <h4 className="text-xs font-medium text-ink-3 mb-3">
          Yield across {record.product}
        </h4>

        {withYield.length === 0 ? (
          <p className="text-xs text-ink-4">First run of this product — nothing to compare yet.</p>
        ) : (
          <>
            <div className="space-y-2 mb-3">
              {rows.map((p) => {
                const py = yieldPct(p.boxWeight, p.finalWeight);
                const current = p.id === record.id;
                return (
                  <div key={p.id} className="flex items-center gap-3 text-xs">
                    <span
                      className={cx(
                        "w-16 shrink-0 font-mono",
                        current ? "text-ink font-medium" : "text-ink-4"
                      )}
                    >
                      {p.id}
                    </span>
                    <ProgressBar value={py} size="sm" tone={current ? "primary" : "muted"} />
                    <span
                      className={cx(
                        "w-11 text-right tnum",
                        current ? "text-ink font-semibold" : "text-ink-3"
                      )}
                    >
                      {py}%
                    </span>
                  </div>
                );
              })}
            </div>

            {delta != null && (
              <p
                className={cx(
                  "inline-flex items-center gap-1.5 text-xs font-medium",
                  delta >= 0 ? "text-ok" : "text-danger"
                )}
              >
                {delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {delta >= 0 ? "+" : ""}
                {delta.toFixed(1)} pts vs the {avg.toFixed(1)}% average
              </p>
            )}
          </>
        )}
      </section>

      {stations.length > 0 && (
        <section>
          <h4 className="text-xs font-medium text-ink-3 mb-3">
            Time in station
          </h4>
          <div className="space-y-2">
            {stations.map((s) => {
              const peerTimes = peers
                .filter((p) => p.minutes && p.minutes[s] != null)
                .map((p) => p.minutes[s]);
              const avgTime = peerTimes.length
                ? peerTimes.reduce((a, b) => a + b, 0) / peerTimes.length
                : null;
              const diff = avgTime != null ? record.minutes[s] - avgTime : null;
              return (
                <div key={s} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-ink-2">{s}</span>
                  <span className="tnum text-ink-3">
                    <span className="font-medium text-ink">{record.minutes[s]}m</span>
                    {avgTime != null && (
                      <span className={cx("ml-2", diff > 0 ? "text-danger" : "text-ok")}>
                        {diff >= 0 ? "+" : ""}
                        {diff.toFixed(0)}m vs avg
                      </span>
                    )}
                    {avgTime == null && <span className="ml-2 text-ink-4">no comparison yet</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export default function InsightsScreen({ history }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("all");
  const [expanded, setExpanded] = useState(null);

  const stats = useMemo(() => {
    const withYield = history
      .map((h) => yieldPct(h.boxWeight, h.finalWeight))
      .filter((v) => v != null);
    const flagged = history.filter((h) => {
      const y = yieldPct(h.boxWeight, h.finalWeight);
      const slow = STATIONS.some((s) => h.minutes && isOverTarget(s, h.minutes[s]));
      return (y != null && y < LOW_YIELD_PCT) || slow;
    });
    const best = history.reduce((acc, h) => {
      const y = yieldPct(h.boxWeight, h.finalWeight);
      return y != null && (!acc || y > acc.y) ? { y, product: h.product } : acc;
    }, null);
    return {
      batches: history.length,
      avg: withYield.length ? (withYield.reduce((a, b) => a + b, 0) / withYield.length).toFixed(1) : "—",
      flagged: flagged.length,
      best,
    };
  }, [history]);

  const visible = history.filter((h) => {
    if (scope === "flagged") {
      const y = yieldPct(h.boxWeight, h.finalWeight);
      const slow = STATIONS.some((s) => h.minutes && isOverTarget(s, h.minutes[s]));
      if (!((y != null && y < LOW_YIELD_PCT) || slow)) return false;
    }
    return h.product.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div className="space-y-5">
      <StatGrid>
        <StatCard icon={History} label="Batches closed" value={stats.batches} />
        <StatCard icon={CheckCircle2} label="Average yield" value={stats.avg} unit="%" tone="primary" />
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

      <div className="flex items-center gap-2 flex-wrap">
        <SearchInput value={query} onChange={setQuery} placeholder="Search products…" className="flex-1 min-w-52" />
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: "all", label: "All" },
            { value: "flagged", label: "Flagged" },
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={History}
            title="No batches match" description="Closed batches appear here automatically with the numbers crews entered on the board." action={
              query || scope !== "all" ? (
                <Button
                  onClick={() => {
                    setQuery("");
                    setScope("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {visible.map((h) => {
            const y = yieldPct(h.boxWeight, h.finalWeight);
            const stations = h.minutes ? STATIONS.filter((s) => h.minutes[s] != null) : [];
            const slow = stations.filter((s) => isOverTarget(s, h.minutes[s]));
            const lowYield = y != null && y < LOW_YIELD_PCT;
            const open = expanded === h.id;

            return (
              <Card key={h.id} className={cx("overflow-hidden", open && "border-primary")}>
                <button
                  onClick={() => setExpanded(open ? null : h.id)}
                  aria-expanded={open}
                  className="w-full text-left p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-ink truncate">{h.product}</span>
                        <span className="text-xs font-mono text-ink-4">{h.id}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2.5 flex-wrap text-xs text-ink-3">
                        {h.closedOn && <span>{formatDay(h.closedOn)}</span>}
                        {h.closedBy && (
                          <span className="inline-flex items-center gap-1">
                            <UserCheck size={11} /> {h.closedBy}
                          </span>
                        )}
                        <span className="tnum">
                          {h.boxWeight} → {h.finalWeight} lb
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {lowYield || slow.length ? (
                        <Badge tone={lowYield ? "danger" : "warn"} icon={AlertTriangle}>
                          {lowYield && slow.length ? "Yield & time" : lowYield ? "Low yield" : "Slow"}
                        </Badge>
                      ) : (
                        <Badge tone="ok">On target</Badge>
                      )}
                      {open ? (
                        <ChevronUp size={16} className="text-ink-3" />
                      ) : (
                        <ChevronDown size={16} className="text-ink-3" />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="w-12 shrink-0 text-xs text-ink-3">Yield</span>
                    <ProgressBar value={y ?? 0} tone={yieldTone(y)} />
                    <span className="w-12 text-right text-sm font-semibold text-ink tnum">
                      {y != null ? `${y}%` : "—"}
                    </span>
                  </div>

                  {stations.length > 0 && (
                    <div className="mt-3 flex items-center gap-4 flex-wrap">
                      {stations.map((s) => {
                        const over = isOverTarget(s, h.minutes[s]);
                        return (
                          <span
                            key={s}
                            className={cx(
                              "inline-flex items-center gap-1.5 text-xs tnum",
                              over ? "text-danger" : "text-ink-2"
                            )}
                          >
                            {over ? <AlertTriangle size={12} /> : <Clock size={12} className="text-ink-3" />}
                            {s} <span className="font-medium">{h.minutes[s]}m</span>
                            <span className="text-ink-4">/ {STAGE_TARGET_MINUTES[s]}m</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </button>

                {open && (
                  <div className="px-4 pb-5 -mt-1">
                    <BatchComparison
                      record={h}
                      peers={history.filter((p) => p.product === h.product && p.id !== h.id)}
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
