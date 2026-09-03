"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Copy,
  Download,
  Eye,
  Package,
  PackageX,
  Snowflake,
} from "lucide-react";

import { Badge, Card, EmptyState, SearchInput, StatCard, StatGrid, Tooltip, cx, useToast } from "../../components/ui";
import {
  behindStock,
  normalizeItem,
  stockIn,
  stockStatus,
} from "../../lib/domain";

const FLOOR_TONE = { out: "text-danger", low: "text-warn", ok: "text-ok" };

const CSV_HEADER = ["Product", "Family", "On floor (lb)", "Target min", "Target max", "Back (made+freezer)", "Status"];

function csvRow(fields) {
  return fields
    .map((f) => {
      const s = String(f ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(",");
}

function buildCsv(items) {
  const rows = items.map((item) => {
    const status = stockStatus(item);
    return csvRow([
      item.product,
      item.type,
      stockIn(item, "floor"),
      item.threshold,
      item.max,
      behindStock(item),
      status === "out" ? "Out" : status === "low" ? "Low" : "In stock",
    ]);
  });
  return [csvRow(CSV_HEADER), ...rows].join("\n");
}

/**
 * A one-shot "export what I'm looking at" menu — deliberately not the shared
 * `Dropdown` (that's built for picking a persistent value; this fires an
 * action and closes). Exports `items` exactly as given, so a search filter
 * narrows the export too — this hands back what's on screen, not a silent
 * full-catalog dump the search box implied you'd left behind.
 */
function ExportMenu({ items }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const download = () => {
    const csv = buildCsv(items);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setOpen(false);
    toast("Downloaded", { detail: `${items.length} product${items.length === 1 ? "" : "s"} as CSV.` });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildCsv(items));
      toast("Copied", { detail: "CSV data copied to your clipboard." });
    } catch {
      toast("Couldn't copy", { tone: "danger", detail: "Your browser blocked clipboard access." });
    }
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative inline-block shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cx(
          "inline-flex items-center gap-1.5 px-2.5 h-[var(--ctl-h)] rounded-full border",
          "text-xs font-medium transition-colors duration-100",
          open ? "border-line-strong bg-hover text-ink" : "border-line bg-surface text-ink-2 hover:bg-hover"
        )}
      >
        <Download size={12} className="shrink-0" />
        Export
        <ChevronDown
          size={12}
          className={cx("shrink-0 text-ink-4 transition-transform duration-100", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute z-30 right-0 top-full mt-1 w-max min-w-[10rem] rounded-md border border-line-strong bg-surface shadow-md py-1"
        >
          <button
            type="button"
            role="menuitem"
            onClick={download}
            className="w-full flex items-center gap-2 text-left px-3 h-[var(--row-h)] text-sm text-ink-2 hover:bg-faint hover:text-ink"
          >
            <Download size={13} className="shrink-0 text-ink-4" />
            Download CSV
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={copy}
            className="w-full flex items-center gap-2 text-left px-3 h-[var(--row-h)] text-sm text-ink-2 hover:bg-faint hover:text-ink"
          >
            <Copy size={13} className="shrink-0 text-ink-4" />
            Copy as CSV
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Console-side inventory — a read-only, company-wide stock overview.
 *
 * Deliberately not the floor terminal's own InventoryScreen: that screen's
 * whole reason to exist is physical action (move stock, put product out to
 * the case, edit the catalog) that only makes sense standing in the shop.
 * This one has no `onMove`/`onPutOut`/`onAddProduct` handlers at all — it
 * exists so a manager or admin can see what's low without walking the floor,
 * same spirit as the Insights page rolling up batch history. The `Read-only`
 * badge next to the scope line is a deliberate reminder of that, not just
 * decoration — this screen has no way to change any of the numbers it
 * shows, only to look at and export them. If a future version needs
 * per-location numbers, this is where that split belongs — `inventory` is
 * one flat company-wide list today, same as `schedule` on the Targets
 * screen.
 */
export default function InventoryScreen({ scopeLabel, inventory }) {
  const [query, setQuery] = useState("");

  const items = useMemo(() => inventory.map(normalizeItem), [inventory]);

  const stats = useMemo(() => {
    let low = 0;
    let out = 0;
    for (const item of items) {
      const status = stockStatus(item);
      if (status === "low") low += 1;
      if (status === "out") out += 1;
    }
    return { total: items.length, low, out };
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((item) => !q || item.product.toLowerCase().includes(q))
      .sort((a, b) => a.product.localeCompare(b.product));
  }, [items, query]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        {scopeLabel && <p className="text-sm text-ink-3">{scopeLabel}</p>}
        <Tooltip label="Can't edit numbers here — view & export only.">
          <Badge tone="neutral" icon={Eye}>
            Read-only
          </Badge>
        </Tooltip>
      </div>

      <StatGrid>
        <StatCard icon={Package} label="Products" value={stats.total} />
        <StatCard
          icon={AlertTriangle}
          label="Low stock"
          value={stats.low}
          tone={stats.low ? "warn" : "ok"}
        />
        <StatCard
          icon={PackageX}
          label="Out of stock"
          value={stats.out}
          tone={stats.out ? "danger" : "ok"}
        />
      </StatGrid>

      <Card>
        <div className="px-4 py-3 border-b border-line flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <SearchInput value={query} onChange={setQuery} placeholder="Search products…" />
          </div>
          <ExportMenu items={visible} />
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={Package}
            title={query ? "No matching products" : "No products yet"}
            description={query ? "Try a different search." : "Products will show up here once the floor starts stocking them."}
          />
        ) : (
          <ul>
            {visible.map((item) => {
              const status = stockStatus(item);
              const floor = stockIn(item, "floor");
              const back = behindStock(item);
              const made = stockIn(item, "made");

              return (
                <li
                  key={item.product}
                  className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{item.product}</p>
                    <p className="text-xs text-ink-3">{item.type}</p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="hidden sm:flex items-center gap-3 text-xs text-ink-3">
                      <span>
                        <span className={cx("font-medium", FLOOR_TONE[status])}>{floor}</span>{" "}
                        {item.unit} on floor
                      </span>
                      <span
                        className="text-ink-4"
                        title={`Flagged low under ${item.threshold} ${item.unit}; a full case is ${item.max} ${item.unit}`}
                      >
                        target {item.threshold}&ndash;{item.max}
                      </span>
                      <span
                        className={cx("inline-flex items-center gap-1", back > 0 ? "text-ink-3" : "text-ink-4")}
                        title="Held back: made plus freezer. Neither is sellable until it is out front."
                      >
                        <Snowflake size={11} className={back > 0 ? "text-cold" : undefined} />
                        {back} {item.unit} back
                        {made > 0 && <span className="text-ink-4">({made} not put away)</span>}
                      </span>
                    </div>

                    {status === "out" ? (
                      <Badge tone="danger" icon={PackageX}>
                        Out
                      </Badge>
                    ) : status === "low" ? (
                      <Badge tone="warn" icon={AlertTriangle}>
                        Low
                      </Badge>
                    ) : (
                      <Badge tone="ok">In stock</Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
