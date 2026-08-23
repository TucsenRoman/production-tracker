"use client";

import React, { useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Plus,
  Trash2,
  UserCheck,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  PinInput,
  Segmented,
  cx,
} from "../components/ui";
import { daysUntil, dueLabel, dueTone, findStaffByPin, formatDay, newId } from "../lib/domain";

function ReadyDialog({ order, onCancel, onConfirm }) {
  const [location, setLocation] = useState("");
  const [pin, setPin] = useState("");
  const staff = findStaffByPin(pin);
  const rejected = pin.length === 4 && !staff;
  const valid = staff && location.trim();

  return (
    <Modal
      open
      onClose={onCancel}
      title={`${order.customer} — ready for pickup`}
      icon={CheckCircle2}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="success"
            icon={CheckCircle2}
            disabled={!valid}
            onClick={() => onConfirm(order.id, location.trim(), staff)}
          >
            Mark ready
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Where is it waiting?" hint="Whoever hands it over needs to find it fast.">
          <Input
            autoFocus
            value={location}
            placeholder="e.g. Walk-in cooler, shelf 2"
            onChange={(e) => setLocation(e.target.value)}
          />
        </Field>
        <Field label="Your PIN" error={rejected ? "That PIN isn't recognised." : null}>
          <PinInput
            value={pin}
            invalid={rejected}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && valid && onConfirm(order.id, location.trim(), staff)}
          />
          {staff && (
            <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-ok">
              <UserCheck size={13} /> {staff.name}
            </p>
          )}
        </Field>
      </div>
    </Modal>
  );
}

function NewOrderDialog({ onCancel, onAdd }) {
  const [form, setForm] = useState({ customer: "", dueDate: "", item: "" });
  const valid = form.customer.trim() && form.item.trim();
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      open
      onClose={onCancel}
      title="New custom order"
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
                id: newId("C"),
                customer: form.customer.trim(),
                dueDate: form.dueDate || null,
                contents: form.item
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
                notes: "",
                status: "open",
                location: null,
              })
            }
          >
            Create order
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Customer">
          <Input
            autoFocus
            value={form.customer}
            placeholder="Business or name"
            onChange={(e) => set("customer", e.target.value)}
          />
        </Field>
        <Field label="Due date">
          <Input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
        </Field>
        <Field label="Contents" hint="One line per item.">
          <textarea
            rows={3}
            value={form.item}
            placeholder={"50 lb Bacon\n10 lb Ground Beef"}
            onChange={(e) => set("item", e.target.value)}
            className={cx(
              "w-full px-2.5 py-2 bg-surface border border-line-strong rounded-md text-sm",
              "text-ink placeholder:text-ink-4 focus:border-primary transition-colors resize-y"
            )}
          />
        </Field>
      </div>
    </Modal>
  );
}

export default function OrdersScreen({ orders, canManage, onAdd, onRemove, onMarkReady, onReopen }) {
  const [filter, setFilter] = useState("open");
  const [marking, setMarking] = useState(null);
  const [creating, setCreating] = useState(false);

  const counts = {
    open: orders.filter((o) => o.status === "open").length,
    ready: orders.filter((o) => o.status === "ready").length,
  };

  const visible = orders
    .filter((o) => (filter === "all" ? true : o.status === filter))
    .sort((a, b) => (daysUntil(a.dueDate) ?? 999) - (daysUntil(b.dueDate) ?? 999));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "open", label: `Open (${counts.open})` },
            { value: "ready", label: `Ready (${counts.ready})` },
            { value: "all", label: "All" },
          ]}
        />
        {canManage && (
          <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
            New order
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title={filter === "ready" ? "Nothing waiting for pickup" : "No open orders"}
            description={
              filter === "ready"
                ? "Orders show up here once someone marks them ready."
                : "Custom processing orders will appear here."
            }
            action={
              canManage ? (
                <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
                  New order
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((order) => {
            const ready = order.status === "ready";
            return (
              <Card key={order.id} className={cx("p-4 sm:p-5", ready && "border-ok-line")}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-ink truncate">{order.customer}</h3>
                      <span className="text-[11px] font-mono text-ink-4">{order.id}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      {ready ? (
                        <Badge tone="ok" icon={CheckCircle2}>
                          Ready for pickup
                        </Badge>
                      ) : (
                        <Badge tone={dueTone(order.dueDate)} icon={CalendarClock}>
                          {dueLabel(order.dueDate)}
                        </Badge>
                      )}
                      {ready && order.location && (
                        <span className="inline-flex items-center gap-1 text-xs text-ink-2">
                          <MapPin size={11} className="text-ok" /> {order.location}
                        </span>
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <IconButton
                      label={`Delete order ${order.id}`}
                      icon={Trash2}
                      size={15}
                      onClick={() => onRemove(order.id)}
                      className="hover:text-danger"
                    />
                  )}
                </div>

                <ul className="space-y-1 mb-3">
                  {order.contents.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-ink-4 shrink-0" />
                      {c}
                    </li>
                  ))}
                </ul>

                {order.notes && (
                  <p className="mb-3 px-3 py-2 rounded-md bg-canvas text-xs text-ink-2 leading-relaxed">
                    {order.notes}
                  </p>
                )}

                <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
                  {ready ? (
                    <>
                      <span className="inline-flex items-center gap-1 text-xs text-ink-3">
                        <UserCheck size={12} /> {order.readyBy}
                        {order.dueDate && ` · due ${formatDay(order.dueDate)}`}
                      </span>
                      {canManage && (
                        <Button size="sm" variant="ghost" onClick={() => onReopen(order.id)}>
                          Reopen
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button variant="secondary" icon={CheckCircle2} onClick={() => setMarking(order)}>
                      Mark ready for pickup
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {marking && (
        <ReadyDialog
          order={marking}
          onCancel={() => setMarking(null)}
          onConfirm={(id, location, staff) => {
            onMarkReady(id, location, staff);
            setMarking(null);
          }}
        />
      )}

      {creating && (
        <NewOrderDialog
          onCancel={() => setCreating(false)}
          onAdd={(order) => {
            onAdd(order);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}
