"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightCircle,
  CheckCircle2,
  CloudOff,
  Package,
  Plus,
  RefreshCw,
  Snowflake,
  Store,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  SearchInput,
  SkeletonRows,
  StatCard,
  StatGrid,
  cx,
} from "../components/ui";
import { relativeTime } from "../lib/domain";

function SourceBadge({ status, syncedAt, onRefresh }) {
  if (status === "loading") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-3">
        <RefreshCw size={12} className="animate-spin" /> Syncing with Clover…
      </span>
    );
  }
  if (status === "error") {
    return (
      <div className="flex items-center gap-2">
        <Badge tone="warn" icon={CloudOff}>
          Clover unreachable
        </Badge>
        <Button size="sm" variant="ghost" icon={RefreshCw} onClick={onRefresh}>
          Retry
        </Button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Badge tone="ok" icon={CheckCircle2}>
        Live from Clover
      </Badge>
      {syncedAt && <span className="text-xs text-ink-4">{relativeTime(syncedAt)}</span>}
      <Button size="sm" variant="ghost" icon={RefreshCw} onClick={onRefresh}>
        Refresh
      </Button>
    </div>
  );
}

function TransferDialog({ item, onCancel, onConfirm }) {
  const [amount, setAmount] = useState(item.freezer);
  const invalid = amount <= 0 || amount > item.freezer;
  return (
    <Modal
      open
      onClose={onCancel}
      title={`Move ${item.product} to the floor`}
      icon={ArrowRightCircle}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="success"
            icon={ArrowRightCircle}
            disabled={invalid}
            onClick={() => onConfirm(item.product, amount)}
          >
            Move {amount || 0} {item.unit}
          </Button>
        </>
      }
    >
      <Field
        label={`Amount (${item.unit})`}
        hint={`${item.freezer} ${item.unit} available in the freezer. Clover's total doesn't change — only the location does.`}
        error={invalid ? `Enter between 1 and ${item.freezer}.` : null}
      >
        <Input
          type="number"
          size="lg"
          autoFocus
          value={amount}
          min={0}
          max={item.freezer}
          invalid={invalid}
          onChange={(e) => setAmount(Number(e.target.value) || 0)}
          className="tnum"
        />
      </Field>
    </Modal>
  );
}

function AddProductDialog({ existing, unit, onCancel, onAdd }) {
  const [name, setName] = useState("");
  const [threshold, setThreshold] = useState("");
  const duplicate = existing.some((p) => p.toLowerCase() === name.trim().toLowerCase());
  const valid = name.trim().length > 0 && !duplicate;

  return (
    <Modal
      open
      onClose={onCancel}
      title="Add a product"
      icon={Plus}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={Plus}
            disabled={!valid}
            onClick={() =>
              onAdd({
                product: name.trim(),
                freezer: 0,
                floor: 0,
                threshold: Number(threshold) || 10,
                unit,
              })
            }
          >
            Add product
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Product name"
          error={duplicate ? "That product already exists." : null}
          hint={duplicate ? null : "Appears on the schedule and the production board."}
        >
          <Input
            autoFocus
            value={name}
            invalid={duplicate}
            placeholder="e.g. Bratwurst - Cheddar Ranch"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label={`Low-stock threshold (${unit})`} hint="Flags the product once floor stock drops below this.">
          <Input
            type="number"
            value={threshold}
            placeholder="10"
            onChange={(e) => setThreshold(e.target.value)}
            className="tnum"
          />
        </Field>
      </div>
    </Modal>
  );
}

export default function InventoryScreen({
  inventory,
  status,
  syncedAt,
  canManage,
  onRefresh,
  onTransfer,
  onAddProduct,
}) {
  const [query, setQuery] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [transferring, setTransferring] = useState(null);
  const [adding, setAdding] = useState(false);

  const unit = inventory[0]?.unit || "lb";

  const stats = useMemo(() => {
    const low = inventory.filter((i) => i.floor < i.threshold);
    return {
      skus: inventory.length,
      low: low.length,
      floor: inventory.reduce((sum, i) => sum + i.floor, 0),
      freezer: inventory.reduce((sum, i) => sum + i.freezer, 0),
    };
  }, [inventory]);

  const visible = inventory.filter((i) => {
    if (onlyLow && i.floor >= i.threshold) return false;
    return i.product.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div className="space-y-5">
      <StatGrid>
        <StatCard icon={Package} label="Products" value={stats.skus} />
        <StatCard
          icon={AlertTriangle}
          label="Low on floor"
          value={stats.low}
          tone={stats.low ? "danger" : "ok"}
          hint={stats.low ? "need restocking" : "all above threshold"}
        />
        <StatCard icon={Store} label="On floor" value={stats.floor} unit={unit} hint="sellable in Clover" />
        <StatCard icon={Snowflake} label="In freezer" value={stats.freezer} unit={unit} hint="held back" />
      </StatGrid>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SourceBadge status={status} syncedAt={syncedAt} onRefresh={onRefresh} />
        {canManage && (
          <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
            Add product
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Search products…" className="flex-1" />
        <Button
          variant={onlyLow ? "primary" : "secondary"}
          icon={AlertTriangle}
          onClick={() => setOnlyLow((v) => !v)}
          className="shrink-0"
        >
          <span className="hidden sm:inline">Low only</span>
        </Button>
      </div>

      {status === "loading" ? (
        <SkeletonRows rows={4} />
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            title={query || onlyLow ? "No matching products" : "No products yet"}
            description={
              query || onlyLow
                ? "Try a different search, or clear the low-stock filter."
                : "Products sync in from Clover, or add one by hand."
            }
            action={
              query || onlyLow ? (
                <Button
                  onClick={() => {
                    setQuery("");
                    setOnlyLow(false);
                  }}
                >
                  Clear filters
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {visible.map((item) => {
              const low = item.floor < item.threshold;
              return (
                <li
                  key={item.product}
                  className="flex items-center justify-between gap-4 px-4 sm:px-5 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{item.product}</p>
                    <div className="mt-1 flex items-center flex-wrap gap-x-3 gap-y-1 text-xs tnum">
                      <span className={cx("inline-flex items-center gap-1", low ? "text-danger" : "text-ink-2")}>
                        <Store size={11} /> {item.floor} {item.unit} floor
                      </span>
                      <span className="inline-flex items-center gap-1 text-ink-3">
                        <Snowflake size={11} className="text-cold" /> {item.freezer} {item.unit} freezer
                      </span>
                      <span className="text-ink-4">min {item.threshold}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {low ? (
                      <Badge tone="danger" icon={AlertTriangle}>
                        Low
                      </Badge>
                    ) : (
                      <Badge tone="ok">In stock</Badge>
                    )}
                    {item.freezer > 0 && (
                      <Button
                        size="sm"
                        variant="secondary"
                        iconRight={ArrowRightCircle}
                        onClick={() => setTransferring(item)}
                      >
                        <span className="hidden sm:inline">To floor</span>
                        <span className="sm:hidden">Move</span>
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {transferring && (
        <TransferDialog
          item={transferring}
          onCancel={() => setTransferring(null)}
          onConfirm={(product, amount) => {
            onTransfer(product, amount);
            setTransferring(null);
          }}
        />
      )}

      {adding && (
        <AddProductDialog
          existing={inventory.map((i) => i.product)}
          unit={unit}
          onCancel={() => setAdding(false)}
          onAdd={(item) => {
            onAddProduct(item);
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}
