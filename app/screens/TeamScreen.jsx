"use client";

import React, { useState } from "react";
import {
  HardHat,
  KeyRound,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";

import {
  Button,
  Field,
  IconButton,
  Input,
  Modal,
  PinInput,
  RowActions,
  SectionHeading,
  Segmented,
  StickyFadeHeader,
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

/* One icon per role. The roster is read on a wall-mounted terminal rather
 * than a desk monitor, so a section wants something identifiable at a
 * glance, not just a word. */
const ROLE_ICON = { crew: HardHat, manager: UserCog, owner: ShieldCheck };

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

  /* One section per role rather than one flat roster. Role is what you
   * actually scan this screen for, and hoisting it into a heading lets
   * every row below drop its own role chip — the section already said it.
   * A role nobody holds gets no heading; a role held by one person still
   * gets one, because a list that quietly stops sectioning itself once a
   * group is small reads as broken rather than tidy. `ordered` is already
   * grouped by rank, so a single pass is enough. */
  const groups = [];
  for (const person of ordered) {
    const last = groups[groups.length - 1];
    if (last && last.role === person.role) last.people.push(person);
    else groups.push({ role: person.role, people: [person] });
  }

  return (
    <div>
      {/* The same sticky toolbar the Tasks screen uses: one row that stays
       *  put while the roster scrolls under it, fading its own bottom edge
       *  so a half-scrolled row doesn't cut off on a hard line. Your own
       *  PIN lives here as a screen-level action rather than in a separate
       *  card above the list — it was one button in a whole boxed card,
       *  which is the opposite of this app's "rule a thing you read, box a
       *  thing you click" grain. */}
      <StickyFadeHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-ink-3">
            {staff.length} {staff.length === 1 ? "person" : "people"}
          </p>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="secondary"
              icon={KeyRound}
              onClick={() => setPinTarget(me)}
            >
              Your PIN
            </Button>
            {canAdd && (
              <Button
                variant="primary"
                icon={UserPlus}
                onClick={() => setAddingNew(true)}
              >
                Add
              </Button>
            )}
          </div>
        </div>
      </StickyFadeHeader>

      <div className="space-y-5">
        {groups.map(({ role, people }) => {
          const Icon = ROLE_ICON[role] || Users;
          return (
            <div key={role}>
              <SectionHeading
                icon={Icon}
                label={ROLE_LABEL[role]}
                count={people.length}
              />

              {/* Nested under its heading rather than flush with it — with
               *  no box or divider around the list, the indent is what
               *  reads as "these belong to that heading". */}
              <ul className="pl-6">
                {people.map((person) => {
                  const self = person.id === user.id;
                  const editable = canManageStaff(user, person) && !self;
                  return (
                    <li
                      key={person.id}
                      className="group flex items-center gap-3 py-3 px-1 rounded-md transition-colors hover:bg-faint"
                    >
                      <span
                        className={cx(
                          "flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold shrink-0",
                          self ? "bg-ink text-white" : "bg-inset text-ink-2"
                        )}
                      >
                        {person.initials}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink truncate">
                          {person.name}
                          {self && (
                            <span className="ml-1.5 text-xs text-ink-4">(you)</span>
                          )}
                        </p>
                        <p className="text-xs text-ink-3 truncate">
                          {/* Station, always — never the role blurb. The
                           * section heading above already says the role, so
                           * falling back to it made this line mean two
                           * different things depending on the row. */}
                          {person.station || "No station assigned"}
                        </p>
                      </div>

                      {editable && (
                        /* `always`: this is the floor terminal — a gloved
                         * hand on a wall tablet gets no hover, so a row's
                         * actions are part of the row, not a reveal. */
                        <RowActions always>
                          <IconButton
                            label={`Set ${person.name}'s PIN`}
                            icon={KeyRound}
                            onClick={() => setPinTarget(person)}
                          />
                          <IconButton
                            label={`Edit ${person.name}`}
                            icon={Pencil}
                            onClick={() => setEditing(person)}
                          />
                          <IconButton
                            label={`Remove ${person.name}`}
                            icon={Trash2}
                            onClick={() => {
                              const err = removeStaff(user, person.id);
                              onNotify(
                                err || `${person.name} removed`,
                                err ? "error" : "success"
                              );
                            }}
                          />
                        </RowActions>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

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
