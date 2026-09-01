"use client";

import React, { useState } from "react";
import {
  KeyRound,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Modal,
  PinInput,
  Segmented,
  cx,
} from "../components/ui";
import {
  ROLE_BLURB,
  ROLE_LABEL,
  STATIONS,
  assignableRoles,
  canManageStaff,
  roleRank,
} from "../lib/domain";
import { useStaff } from "../lib/staff";

const ROLE_TONE = { crew: "neutral", manager: "info", owner: "ok" };

/* ------------------------------------------------------------- PIN dialog -- */

/**
 * Setting a PIN is deliberately a confirm-twice flow: on a shared terminal a
 * mistyped PIN locks the person out of their own shift with no way back in.
 */
function PinDialog({ person, isSelf, onCancel, onSave }) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);

  const mismatch = confirm.length === 4 && pin !== confirm;
  const ready = pin.length === 4 && confirm === pin;

  const save = () => {
    const err = onSave(pin);
    if (err) setError(err);
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title={isSelf ? "Change your PIN" : `Set ${person.name}'s PIN`}
      icon={KeyRound}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" icon={KeyRound} disabled={!ready} onClick={save}>
            Save PIN
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="New PIN" error={error}
          hint={error ? null : "Four digits. Avoid 1111, 1234 and the like."}
        >
          <PinInput
            autoFocus
            value={pin}
            invalid={Boolean(error)}
            onChange={(e) => {
              setError(null);
              setPin(e.target.value.replace(/\D/g, ""));
            }}
          />
        </Field>

        <Field label="Confirm PIN" error={mismatch ? "The two PINs don't match." : null}>
          <PinInput
            value={confirm}
            invalid={mismatch}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
          />
        </Field>

        {!isSelf && (
          <p className="text-xs text-ink-3 leading-relaxed">
            Tell {person.name.split(" ")[0]} the new PIN in person — it is never shown again.
          </p>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ Person form -- */

function PersonDialog({ actor, person, onCancel, onSave }) {
  const editing = Boolean(person);
  const roles = assignableRoles(actor);

  const [name, setName] = useState(person?.name || "");
  const [role, setRole] = useState(person?.role || roles[0] || "crew");
  const [station, setStation] = useState(person?.station || "");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(null);

  const ready = name.trim().length > 1 && (editing || pin.length === 4);

  const save = () => {
    const err = onSave({
      name: name.trim(),
      role,
      station: station || null,
      ...(editing ? {} : { pin }),
    });
    if (err) setError(err);
  };

  return (
    <Modal
      open
      onClose={onCancel}
      title={editing ? `Edit ${person.name}` : "Add someone"}
      icon={editing ? Pencil : UserPlus}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" icon={editing ? Pencil : Plus} disabled={!ready} onClick={save}>
            {editing ? "Save" : "Add to team"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <Input
            autoFocus
            value={name}
            placeholder="e.g. Dana Kowalski" onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field label="Role" hint={ROLE_BLURB[role]}>
          <Segmented
            size="sm" value={role}
            onChange={setRole}
            options={roles.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
          />
        </Field>

        {role === "crew" && (
          <Field label="Home station" hint="Where their shift starts. Optional.">
            <Segmented
              size="sm" value={station || "none"}
              onChange={(v) => setStation(v === "none" ? "" : v)}
              options={[
                { value: "none", label: "Any" },
                ...STATIONS.map((s) => ({ value: s, label: s })),
              ]}
            />
          </Field>
        )}

        {!editing && (
          <Field
            label="Starting PIN" error={error}
            hint={error ? null : "They can change it themselves once they're signed in."}
          >
            <PinInput
              value={pin}
              invalid={Boolean(error)}
              onChange={(e) => {
                setError(null);
                setPin(e.target.value.replace(/\D/g, ""));
              }}
            />
          </Field>
        )}

        {editing && error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------------- Screen -- */

export default function TeamScreen({ user, onNotify }) {
  const { staff, setPin, addStaff, updateStaff, removeStaff } = useStaff();
  const [pinTarget, setPinTarget] = useState(null);
  const [editing, setEditing] = useState(null);
  const [addingNew, setAddingNew] = useState(false);

  const me = staff.find((s) => s.id === user.id) || user;
  const canAdd = assignableRoles(user).length > 0;

  // Highest rank first, then alphabetical — the roster reads as a hierarchy.
  const ordered = [...staff].sort(
    (a, b) => roleRank(b.role) - roleRank(a.role) || a.name.localeCompare(b.name)
  );

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Your PIN" subtitle="Only you can see it change. Pick something you'll remember with gloves on." icon={KeyRound}
          actions={
            <Button size="sm" variant="secondary" icon={KeyRound} onClick={() => setPinTarget(me)}>
              Change
            </Button>
          }
        />
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-ink text-white text-xs font-semibold shrink-0">
            {me.initials}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink truncate">{me.name}</p>
            <p className="text-xs text-ink-3">{ROLE_LABEL[me.role]}</p>
          </div>
          <span className="ml-auto font-mono tracking-[0.35em] text-ink-4 text-sm">••••</span>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader
          title="Team" subtitle={`${staff.length} people. You can only change PINs for roles below your own.`}
          icon={Users}
          actions={
            canAdd ? (
              <Button size="sm" variant="primary" icon={UserPlus} onClick={() => setAddingNew(true)}>
                <span className="hidden sm:inline">Add</span>
              </Button>
            ) : null
          }
        />
        <ul className="divide-y divide-line">
          {ordered.map((person) => {
            const self = person.id === user.id;
            const editable = canManageStaff(user, person) && !self;
            return (
              <li
                key={person.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={cx(
                      "flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold shrink-0",
                      self ? "bg-ink text-white" : "bg-inset text-ink-2"
                    )}
                  >
                    {person.initials}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">
                      {person.name}
                      {self && <span className="ml-1.5 text-xs text-ink-4">(you)</span>}
                    </p>
                    <p className="text-xs text-ink-3 truncate">
                      {person.station || ROLE_BLURB[person.role]}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge tone={ROLE_TONE[person.role]} icon={person.role === "owner" ? ShieldCheck : undefined}>
                    {ROLE_LABEL[person.role]}
                  </Badge>
                  {editable && (
                    <>
                      <Button
                        size="sm" variant="secondary" icon={KeyRound}
                        onClick={() => setPinTarget(person)}
                      >
                        <span className="hidden sm:inline">PIN</span>
                      </Button>
                      <Button
                        size="sm" variant="ghost" icon={Pencil}
                        aria-label={`Edit ${person.name}`}
                        onClick={() => setEditing(person)}
                      />
                      <Button
                        size="sm" variant="ghost" icon={Trash2}
                        aria-label={`Remove ${person.name}`}
                        onClick={() => {
                          const err = removeStaff(user, person.id);
                          onNotify(err || `${person.name} removed`, err ? "error" : "success");
                        }}
                      />
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {pinTarget && (
        <PinDialog
          person={pinTarget}
          isSelf={pinTarget.id === user.id}
          onCancel={() => setPinTarget(null)}
          onSave={(pin) => {
            const err = setPin(user, pinTarget.id, pin);
            if (err) return err;
            setPinTarget(null);
            onNotify(
              pinTarget.id === user.id ? "Your PIN is updated" : `${pinTarget.name}'s PIN is updated`
            );
            return null;
          }}
        />
      )}

      {(addingNew || editing) && (
        <PersonDialog
          actor={user}
          person={editing}
          onCancel={() => {
            setAddingNew(false);
            setEditing(null);
          }}
          onSave={(patch) => {
            const err = editing
              ? updateStaff(user, editing.id, patch)
              : addStaff(user, patch);
            if (err) return err;
            onNotify(editing ? `${patch.name} updated` : `${patch.name} added to the team`);
            setAddingNew(false);
            setEditing(null);
            return null;
          }}
        />
      )}
    </div>
  );
}
