"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Beef,
  ChevronDown,
  Copy,
  Download,
  Drumstick,
  Eye,
  Ham,
  Package,
  PackageX,
  Sandwich,
  Snowflake,
} from "lucide-react";

import {
  Badge,
  EmptyState,
  SearchInput,
  SectionHeading,
  StatCard,
  StatGrid,
  StickyFadeHeader,
  Tooltip,
  cx,
  useToast,
} from "../../components/ui";
import {
  PRODUCT_TYPES,
  behindStock,
  normalizeItem,
  stockIn,
  stockStatus,
} from "../../lib/domain";

const FLOOR_TONE = { out: "text-danger", low: "text-warn", ok: "text-ok" };

/* One icon per product family; unknown families fall back to a box. */
const FAMILY_ICON = {
  Bacon: Beef,
  Brats: Beef,
  Sausage: Beef,
  Sticks: Beef,
  Jerky: Beef,
  Ham: Ham,
  Deli: Sandwich,
  Roasts: Beef,
  Steaks: Beef,
  Chops: Beef,
  Ribs: Beef,
  Ground: Beef,
  Poultry: Drumstick,
  Other: Package,
};

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
 * Action menu, not the shared `Dropdown` (which picks a persistent value).
 * Exports `items` as given, so a search filter narrows the export too.
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
 * Read-only, company-wide stock overview. Deliberately not the floor's
 * InventoryScreen: physical actions (move, put out, edit catalog) only make
 * sense standing in the shop, so this has no mutation handlers at all.
 * `inventory` is one flat company-wide list today.
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

  /* Sectioned by product family in the catalogue's own order, not
   * alphabetically — the case is scanned family by family. Empty families
   * get no heading; a family of one still does. */
  const groups = useMemo(() => {
    const byFamily = new Map();
    for (const item of visible) {
      const family = item.type || "Other";
      const list = byFamily.get(family);
      if (list) list.push(item);
      else byFamily.set(family, [item]);
    }
    const known = PRODUCT_TYPES.filter((t) => byFamily.has(t));
    const extra = [...byFamily.keys()].filter((t) => !PRODUCT_TYPES.includes(t)).sort();
    return [...known, ...extra].map((family) => ({ family, items: byFamily.get(family) }));
  }, [visible]);

  return (
    <div>
      {/* Above the sticky toolbar on purpose: the scope line sticks, not the tiles. */}
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

      {/* Same sticky toolbar as Tasks and Team; read-only, so no primary action. */}
      <StickyFadeHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            {scopeLabel && <p className="text-sm text-ink-3">{scopeLabel}</p>}
            <p className="text-sm text-ink-3">
              {visible.length} product{visible.length === 1 ? "" : "s"}
            </p>
            <Tooltip label="Can't edit numbers here — view & export only.">
              <Badge tone="neutral" icon={Eye}>
                Read-only
              </Badge>
            </Tooltip>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search products…"
              className="w-48 max-w-[45vw]"
            />
            <ExportMenu items={visible} />
          </div>
        </div>
      </StickyFadeHeader>

      <div className="space-y-5">
        {visible.length === 0 ? (
          <EmptyState
            icon={Package}
            title={query ? "No matching products" : "No products yet"}
            description={query ? "Try a different search." : "Products will show up here once the floor starts stocking them."}
          />
        ) : (
          groups.map(({ family, items: familyItems }) => {
            const Icon = FAMILY_ICON[family] || Package;
            return (
              <div key={family}>
                <SectionHeading icon={Icon} label={family} count={familyItems.length} />

                {/* With no box around the list, the indent is what ties rows to the heading. */}
                <ul className="pl-6">
                  {familyItems.map((item) => {
                    const status = stockStatus(item);
                    const floor = stockIn(item, "floor");
                    const back = behindStock(item);
                    const made = stockIn(item, "made");

                    return (
                      <li
                        key={item.product}
                        className="group flex items-center gap-3 py-3 px-1 rounded-md transition-colors hover:bg-faint"
                      >
                        {/* Family is already in the section heading. */}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink truncate">{item.product}</p>
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
