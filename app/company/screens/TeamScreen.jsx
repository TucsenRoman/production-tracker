"use client";

import React, { useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Dices,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";

import {
  Badge,
  Button,
  Dropdown,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  RowActions,
  SearchInput,
  SectionHeading,
  Segmented,
  Slot,
  StickyFadeHeader,
  Tooltip,
  cx,
} from "../../components/ui";
import { relativeTime } from "../../lib/domain";
import {
  ROLES,
  ROLE_LABEL,
  generatePin,
  isValidEmail,
  isValidPin,
  newCompanyId,
} from "../lib/companyDomain";

/* The two orders the toolbar's sort button flips between. Role sections are
 * fixed — rank is not a preference — so this only ever reorders names inside
 * a section. Same icons the floor Inventory screen's own sort cycles use. */
const NAME_SORTS = [
  { label: "A–Z", icon: ArrowDownAZ, compare: (a, b) => a.name.localeCompare(b.name) },
  { label: "Z–A", icon: ArrowUpAZ, compare: (a, b) => b.name.localeCompare(a.name) },
];

/* One icon per role, so a section is identifiable before you read it. */
const ROLE_ICON = { admin: ShieldCheck, manager: UserCog };

/* Highest rank first — the roster reads as a hierarchy, same as the floor
 * team screen. */
const ROLE_RANK = { admin: 2, manager: 1 };
const roleRank = (role) => ROLE_RANK[role] || 0;

const initials = (name) => name.split(" ").map((p) => p[0]).slice(0, 2).join("");

/**
 * A person, as a face if we have one and as their initials if we don't —
 * same component the Locations detail page uses, so a teammate looks like
 * the same teammate on both screens. The photo is demo seed data
 * (COMPANY_SEED.users); the initials path is what a real account gets.
 */
function Avatar({ user, size = 30, className }) {
  /* `avatarUrl` may point off-site (the demo's second location hotlinks its
   * two headshots), and an image that never arrives used to leave a blank
   * grey disc — strictly worse than the initials it replaced. One failed
   * load and this falls back to the path a real account gets anyway. */
  const [failed, setFailed] = useState(false);
  const dim = { width: size, height: size };
  if (user.avatarUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={user.avatarUrl} alt="" style={dim} onError={() => setFailed(true)}
        className={cx("rounded-full object-cover bg-hover shrink-0", className)} />
    );
  }
  return (
    <span style={dim}
      className={cx(
        "flex items-center justify-center rounded-full bg-hover text-ink-2 font-semibold shrink-0",
        size >= 30 ? "text-xs" : "text-[11px]",
        className
      )}
    >
      {initials(user.name)}
    </span>
  );
}

/* What granting each role actually hands over, in the words of the rail the
 * person will see. Derived from nav.js's EXCLUSIVE adminOnly/managerOnly
 * split: these are two different jobs, not two rungs, and the invite dialog
 * is the one moment where getting that wrong is expensive. */
const ROLE_BLURB = {
  admin: "Runs the company account — team, permissions, locations, stations, and Insights across every location. Does not see the day-to-day floor screens.",
  manager: "Runs the floor at their locations — Targets, Assignments, Inventory and Insights. No access to company settings.",
};

/* The locations a person is assigned to, in roster order. */
const assignmentsFor = (user, locations) => locations.filter((l) => user.locationIds.includes(l.id));

/* Every PIN already spoken for, so a newly issued one can't collide. A PIN
 * hangs off the person's own record — it is how the floor recognises them —
 * so the whole company roster is the namespace. */
const pinsInUse = (users, exceptId) =>
  users.filter((u) => u.pin && u.id !== exceptId).map((u) => u.pin);

function LocationChecklist({ locations, selected, onToggle }) {
  if (locations.length === 0) {
    return <p className="text-xs text-ink-4">No locations to assign yet — add one first.</p>;
  }
  return (
    <div className="space-y-1.5">
      {locations.map((loc) => {
        const on = selected.includes(loc.id);
        return (
          <label
            key={loc.id}
            className={cx(
              "flex items-center gap-2.5 px-3 py-2 rounded-md border cursor-pointer text-sm",
              on ? "border-line-strong bg-hover text-ink" : "border-line text-ink-2 hover:bg-hover"
            )}
          >
            <input type="checkbox" checked={on} onChange={() => onToggle(loc.id)} className="accent-current" />
            {loc.name}
          </label>
        );
      })}
    </div>
  );
}

function InviteDialog({ locations, onCancel, onInvite }) {
  /* One location means there is no choice to make — preselect it. Leaving
   * the only checkbox empty and the primary button greyed is a puzzle, not
   * a decision. */
  const [form, setForm] = useState({
    name: "", email: "", role: "manager",
    locationIds: locations.length === 1 ? [locations[0].id] : [],
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleLoc = (id) =>
    setForm((f) => ({
      ...f,
      locationIds: f.locationIds.includes(id) ? f.locationIds.filter((x) => x !== id) : [...f.locationIds, id],
    }));

  /* Say WHICH field is holding the button, rather than greying it out and
   * leaving the person to guess. First unmet requirement wins — a list of
   * three complaints on an empty form is nagging. */
  const blocker = !form.name.trim()
    ? "Add a name."
    : !isValidEmail(form.email)
      ? "Add a valid email address."
      : form.locationIds.length === 0
        ? "Pick at least one location."
        : null;
  const valid = !blocker;

  return (
    <Modal
      open
      onClose={onCancel}
      title="Invite a teammate" icon={UserPlus}
      footer={
        <>
          {blocker && <p className="mr-auto text-xs text-ink-4">{blocker}</p>}
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary" icon={Mail}
            disabled={!valid}
            onClick={() =>
              onInvite({
                id: newCompanyId("U"),
                name: form.name.trim(),
                email: form.email.trim().toLowerCase(),
                role: form.role,
                locationIds: form.locationIds,
                status: "invited",
                invitedAt: new Date().toISOString(),
              })
            }
          >
            Send invite
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <Input autoFocus value={form.name} placeholder="Full name" onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Email">
          <Input
            type="email" value={form.email}
            placeholder="teammate@company.com" onChange={(e) => set("email", e.target.value)}
          />
        </Field>
        <Field label="Role">
          <Segmented
            value={form.role}
            onChange={(v) => set("role", v)}
            options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
          />
          {/* The highest-consequence field on the form used to be a bare
           *  two-word toggle. What the two roles actually reach is defined a
           *  screen away, in the rail itself — say it here, at the moment
           *  it is being handed over. */}
          <p className="mt-2 text-xs text-ink-4 leading-relaxed">{ROLE_BLURB[form.role]}</p>
        </Field>
        <Field label="Locations">
          <LocationChecklist locations={locations} selected={form.locationIds} onToggle={toggleLoc} />
        </Field>
      </div>
    </Modal>
  );
}

function EditDialog({ user, locations, onCancel, onSave }) {
  const [role, setRole] = useState(user.role);
  const [locationIds, setLocationIds] = useState(user.locationIds);
  const toggleLoc = (id) =>
    setLocationIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Modal
      open
      onClose={onCancel}
      title={user.name}
      icon={Pencil}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onSave({ role, locationIds })}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Role">
          <Segmented
            value={role}
            onChange={setRole}
            options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
          />
          <p className="mt-2 text-xs text-ink-4 leading-relaxed">{ROLE_BLURB[role]}</p>
        </Field>
        <Field label="Locations">
          <LocationChecklist locations={locations} selected={locationIds} onToggle={toggleLoc} />
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ Person PIN -- */

/**
 * Issue, replace, or clear the PIN a person punches on the floor.
 *
 * Two states, not one form, and the difference is the whole point: a PIN that
 * exists is never rendered back. Both things you can do to a live PIN —
 * replace it, clear it — are done without reading it, so the only moment
 * anybody but its owner sees the digits is the moment they are minted.
 *
 * Deliberately not styled like the device-code dialog on Locations: this is
 * about a person, momentarily, not a station long-term — so it says
 * "authorize an action", never "sign in as".
 */
function PersonPinDialog({ user, taken, onCancel, onSave, onClear }) {
  const [issuing, setIssuing] = useState(!user.pin);
  /* Generated rather than blank, because a human choosing four digits under
   * mild pressure picks a year. Editable all the same — an admin reissuing a
   * PIN over the phone may want one that survives being said out loud. */
  const [pin, setPin] = useState(() => generatePin(taken));
  const first = user.name.split(" ")[0];

  const pinTaken = taken.includes(pin);
  const valid = isValidPin(pin) && !pinTaken;

  return (
    <Modal
      open
      onClose={onCancel}
      title={user.pin ? `PIN — ${user.name}` : `Issue a PIN — ${user.name}`}
      icon={ShieldCheck}
      footer={
        <>
          {/* Clearing sits on the far side of the footer, and needs nothing
           *  revealed to do its job — which is what makes "this PIN has been
           *  seen by the wrong person" a fixable state rather than a
           *  confession. */}
          {user.pin && (
            <Button variant="ghost" icon={Trash2} className="mr-auto hover:text-danger" onClick={onClear}>
              Clear PIN
            </Button>
          )}
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          {issuing ? (
            <Button variant="primary" icon={Plus} disabled={!valid} onClick={() => onSave(pin)}>
              {user.pin ? "Replace PIN" : "Issue PIN"}
            </Button>
          ) : (
            <Button variant="primary" icon={Dices} onClick={() => setIssuing(true)}>
              Issue a new one
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-ink-3 leading-relaxed">
          {first} punches this in on the floor to authorize a gated action. It is an approval, not a way in —
          nothing about the tablet changes, and there is nothing to sign out of.
        </p>

        {issuing ? (
          <>
            <Field label="Code" error={pinTaken ? "That code is already in use — try another." : null}>
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  inputMode="numeric" maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="font-mono tracking-[0.3em]"
                />
                <Button variant="secondary" icon={Dices} onClick={() => setPin(generatePin(taken))}>
                  Generate
                </Button>
              </div>
            </Field>
            {/* The honest cost of issuing from here rather than letting the
             *  person choose it at the tablet: you are looking at it. Say so,
             *  and say what to do about it, instead of implying a secret. */}
            <p className="text-xs text-ink-4 leading-relaxed">
              This is the only screen that will ever show it. Hand it to {first} yourself — if anyone else reads
              it over your shoulder, clear it and issue another.
            </p>
          </>
        ) : (
          <p className="text-xs text-ink-4 leading-relaxed">
            {first} has a PIN. It isn&rsquo;t shown here, to you or anyone else — issue a new one to replace it,
            or clear it so nothing can be approved in their name.
          </p>
        )}
      </div>
    </Modal>
  );
}

/**
 * Where a person works. Names only — the PIN used to be a state ON each of
 * these, and isn't one any more.
 */
function PersonAssignments({ user, locations }) {
  const assignments = assignmentsFor(user, locations);
  if (assignments.length === 0) {
    return <p className="text-xs text-ink-4">No locations assigned</p>;
  }
  return <p className="text-xs text-ink-3 truncate">{assignments.map((l) => l.name).join(", ")}</p>;
}

/**
 * Whether this person can authorize anything on the floor — one control, in
 * its own column, NOT folded into the assignments beside it.
 *
 * The units there read "Milaca ••••", which was right when a PIN was issued
 * per location. A person carries one PIN now, on their own record, so putting
 * it back in that row would print one fact once per place they work and imply
 * it varies by building — the exact thing the model just stopped doing. Its
 * own column also lets the state line up down the roster, which is what the
 * "No PIN" view above is for scanning.
 */
function PersonPin({ user, users, onSetPin }) {
  const [open, setOpen] = useState(false);

  /* An invited teammate has no accepted account for a PIN to hang off yet. */
  if (user.status !== "active") {
    return <span className="text-xs text-ink-4">once accepted</span>;
  }

  return (
    <>
      <Tooltip label={user.pin ? `Replace or clear ${user.name.split(" ")[0]}'s PIN` : `Issue a PIN for ${user.name}`}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 h-[var(--ctl-h)] px-2 -ml-2 rounded-md text-xs text-ink-2 hover:bg-hover hover:text-ink transition-colors"
        >
          {user.pin ? (
            <>
              <ShieldCheck size={11} className="text-icon-2 shrink-0" />
              {/* Masked, always. A code printed down a roster is legible to
               *  anyone passing the desk or watching the screenshare. */}
              <span aria-label="PIN set, hidden" className="font-mono font-semibold tracking-[0.2em] text-ink-3">
                ••••
              </span>
            </>
          ) : (
            <span className="text-ink-4">No PIN</span>
          )}
        </button>
      </Tooltip>

      {open && (
        <PersonPinDialog
          user={user}
          taken={pinsInUse(users, user.id)}
          onCancel={() => setOpen(false)}
          onClear={() => {
            onSetPin(user, null);
            setOpen(false);
          }}
          onSave={(pin) => {
            onSetPin(user, pin);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

/* When someone arrived, in the only two forms that are worth a column:
 * a pending invite is measured in days because the answer decides whether
 * to resend it; an accepted one is measured in months because nothing on
 * this screen turns on the exact day. */
function sinceLabel(user) {
  if (!user.invitedAt) return null;
  if (user.status !== "active") return `sent ${relativeTime(user.invitedAt)}`;
  const d = new Date(user.invitedAt);
  if (Number.isNaN(d.getTime())) return null;
  return `added ${d.toLocaleDateString(undefined, { month: "short", year: "numeric" })}`;
}

/* -------------------------------------------------------------- List view -- */

function TeamList({
  users, allUsers, locations, currentUser, compareNames,
  onEdit, onRemove, onResend, onSetPin,
}) {
  if (users.length === 0) {
    return (
      <div className="border-b border-line">
        <EmptyState icon={Users} title="No teammates match" description="Try a different search or filter." />
      </div>
    );
  }

  /* One section per role rather than one flat roster. Role is what you
   * actually scan this screen for, and hoisting it into a heading lets every
   * row below drop its own role chip — the section already said it. A role
   * nobody holds gets no heading; a role held by one person still gets one,
   * because a list that quietly stops sectioning itself once a group is
   * small reads as broken rather than tidy. Sort by rank first, then a
   * single pass is enough to group. */
  const ordered = [...users].sort(
    (a, b) => roleRank(b.role) - roleRank(a.role) || compareNames(a, b)
  );
  const groups = [];
  for (const person of ordered) {
    const last = groups[groups.length - 1];
    if (last && last.role === person.role) last.people.push(person);
    else groups.push({ role: person.role, people: [person] });
  }

  return (
    <div className="space-y-5">
      {groups.map(({ role, people }) => {
        const Icon = ROLE_ICON[role] || Users;
        return (
          <div key={role}>
            <SectionHeading icon={Icon} label={ROLE_LABEL[role]} count={people.length} />

            {/* Nested under its heading rather than flush with it — with no
             *  box or divider around the list, the indent is what reads as
             *  "these belong to that heading". */}
            <ul className="pl-6">
              {people.map((u) => {
                // No more a single locked "owner" role — the guard now is just
                // "you can't edit or remove yourself from here" (same idea as the
                // floor roster's own self-exclusion).
                const locked = u.id === currentUser.id;
                const since = sinceLabel(u);
                return (
                  /* A row, not a stack. This used to be four lines in a
                   *  ~110px band occupying the left third of a 1440px window,
                   *  with the section rule above it drawing a table edge over
                   *  nothing. Identity holds a fixed column so every name and
                   *  email lines up down the group; where they work runs in
                   *  the middle; when they arrived sits right, against the
                   *  actions. Fifteen people now fit on one screen. */
                  <li
                    key={u.id}
                    className="group flex items-center gap-4 py-2 px-1 rounded-md transition-colors hover:bg-faint"
                  >
                    <Avatar user={u} size={30} />

                    <div className="w-56 shrink-0 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-ink truncate">{u.name}</p>
                        {u.status !== "active" && <Badge tone="warn">Pending</Badge>}
                        {u.id === currentUser.id && <Badge tone="info">You</Badge>}
                      </div>
                      <p className="text-xs text-ink-3 truncate">{u.email}</p>
                    </div>

                    <div className="flex-1 min-w-0">
                      <PersonAssignments user={u} locations={locations} />
                    </div>

                    {/* The PIN reads as a column of its own down the roster —
                     *  fixed width for the same reason the date beside it is,
                     *  so "who can't approve anything" is a glance rather than
                     *  a read. */}
                    <div className="w-28 shrink-0">
                      <PersonPin user={u} users={allUsers} onSetPin={onSetPin} />
                    </div>

                    {/* Fixed width so the column holds its edge whether or not
                     *  a given person has a date, and so the actions below
                     *  never move left and right between rows. */}
                    <span className="w-28 shrink-0 text-right text-xs text-ink-4 truncate">{since}</span>

                    {!locked ? (
                      <RowActions>
                        {/* An invite you cannot chase is a dead row. The old
                         *  one offered a sentence about what you could not do
                         *  yet, where the one action that matters belongs. */}
                        {u.status === "invited" && (
                          <IconButton
                            label={`Resend invite to ${u.name}`}
                            icon={Send} size={14}
                            onClick={() => onResend(u)}
                          />
                        )}
                        <IconButton label={`Edit ${u.name}`} icon={Pencil} size={14} onClick={() => onEdit(u)} />
                        <IconButton
                          label={`Remove ${u.name}`}
                          icon={Trash2}
                          size={14}
                          onClick={() => onRemove(u.id)}
                          className="hover:text-danger"
                        />
                      </RowActions>
                    ) : (
                      /* Your own row has no controls, on purpose. Hold the
                       * space anyway so the column above it stays straight. */
                      <span className="w-[62px] shrink-0" aria-hidden="true" />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Root -- */

export default function TeamScreen({
  users,
  locations,
  currentUser,
  onInvite,
  onUpdate,
  onRemove,
  onResend,
  onSetPin,
}) {
  const [tab, setTab] = useState("all");
  const [locIds, setLocIds] = useState([]);
  const [query, setQuery] = useState("");
  const [sortIdx, setSortIdx] = useState(0);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState(null);

  const multiLocation = locations.length > 1;
  /* One PIN per person, so this is one question per person — it used to be
   * "is any of their locations missing one". */
  const gapFor = (u) => u.status === "active" && !u.pin;

  /* Location is a SCOPE, not a view. The two are different questions — "which
   * of these people am I looking at" versus "at which of my plants" — and
   * they compose: Princeton AND Foley, with no lead PIN. It sits in the page
   * header rather than the toolbar because it frames the whole screen,
   * subtitle included, the way the title does. Nothing ticked means every
   * location, so the menu needs no "All" row — only a way back, which is the
   * pinned panel under the list. */
  const inScope = (u) => locIds.length === 0 || locIds.some((id) => u.locationIds.includes(id));
  const scoped = users.filter(inScope);

  /* Named views, each carrying its own count — the shape TasksScreen
   * established, badges and all. Counts are of the SCOPED roster, so picking
   * Princeton and reading "No PIN 3" means three at Princeton, not three
   * company-wide of whom some are elsewhere. */
  const TABS = [
    { id: "all", label: "Everyone", icon: Users, match: () => true },
    { id: "pin", label: "No PIN", icon: ShieldCheck, match: gapFor },
    { id: "pending", label: "Pending", icon: Mail, match: (u) => u.status !== "active" },
  ].map((t) => ({ ...t, count: scoped.filter(t.match).length }));

  const activeTab = TABS.find((t) => t.id === tab) || TABS[0];
  const q = query.trim().toLowerCase();
  const visible = scoped
    .filter(activeTab.match)
    .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));

  /* What needs you, in one sentence. The oldest outstanding invite wins — it
   * is the only thing here that goes stale on its own. Failing that, the
   * people who cannot authorise anything on the floor yet. Failing both,
   * nothing: a subtitle that always speaks stops being read. */
  const stalest = scoped
    .filter((u) => u.status !== "active" && u.invitedAt)
    .sort((a, b) => new Date(a.invitedAt) - new Date(b.invitedAt))[0];
  const gapCount = scoped.filter(gapFor).length;
  const subtitle = stalest ? (
    <span>
      <span className="font-medium text-ink">{stalest.name}</span>&rsquo;s invite has been out{" "}
      <span className="font-medium">{relativeTime(stalest.invitedAt).replace(" ago", "")}</span> without
      an answer.
    </span>
  ) : gapCount > 0 ? (
    <span>
      <span className="font-medium text-ink">{gapCount}</span>{" "}
      {gapCount === 1 ? "person has" : "people have"} no PIN yet, so nothing gated can be
      authorised in their name.
    </span>
  ) : null;

  return (
    <div>
      {/* The scope lives in the page header the shell already draws, beside
       *  the title: it frames everything under it, subtitle included, so it
       *  belongs with the thing that names the page rather than in the row of
       *  controls that only narrows the list. */}
      {multiLocation && (
        <Slot name="page-actions">
          <Dropdown
            multiple
            aria-label="Limit to locations"
            icon={MapPin}
            placeholder="All locations"
            summary={(n) => `${n} locations`}
            value={locIds}
            onChange={setLocIds}
            options={locations.map((l) => ({ value: l.id, label: l.name }))}
            /* The panel that clears the scope is not one of the places you
             * can scope to, so it gets its own surface under the list —
             * what `pinned` is for. Absent until there is something to
             * clear. */
            pinned={
              locIds.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setLocIds([])}
                  className="w-full flex items-center justify-center h-[var(--row-h)] rounded-md text-sm text-ink-3 hover:text-ink hover:bg-faint transition-colors duration-100"
                >
                  All locations
                </button>
              ) : null
            }
            pinnedSide="bottom"
          />
        </Slot>
      )}

      <Slot name="page-subtitle">{subtitle}</Slot>

      {/* One toolbar, same shape as the Tasks screen: named views with their
       *  own counted badges on the left, and on the right the controls that
       *  act on what those views produced — find one person, flip the order,
       *  add somebody. */}
      <StickyFadeHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* No `fade` here, unlike Tasks: three chips never outgrow the row,
           *  and the fade band is what was eating the trailing badge — an
           *  armed rail masks its own right edge, and "Pending" is the last
           *  chip. Tasks gets away with it because its last tab is the one
           *  deliberately left uncounted. */}
          <Segmented
            value={tab}
            onChange={setTab}
            className="min-w-0"
            options={TABS.map((t) => ({
              value: t.id,
              label: t.label,
              icon: t.icon,
              /* Everyone is the resting state, not a queue with a number
               * that wants something from you — same reason Tasks leaves
               * Completed unbadged. */
              count: t.id === "all" ? undefined : t.count,
            }))}
          />

          <div className="flex items-center gap-1.5 shrink-0">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search teammates…"
              className="w-52"
            />
            <Tooltip label={`Sorted ${NAME_SORTS[sortIdx].label} — tap to flip`}>
              <IconButton
                label={`Sort by name: ${NAME_SORTS[sortIdx].label}`}
                icon={NAME_SORTS[sortIdx].icon}
                onClick={() => setSortIdx((i) => (i + 1) % NAME_SORTS.length)}
              />
            </Tooltip>
            <Button variant="primary" icon={UserPlus} onClick={() => setInviting(true)}>
              Invite
            </Button>
          </div>
        </div>
      </StickyFadeHeader>

      <div className="space-y-5">
        <TeamList
          users={visible}
          /* The filtered list is what's rendered; the whole roster is what a
           * new PIN has to be unique against, and a search box must not be
           * able to hand out a code somebody off-screen already holds. */
          allUsers={users}
          locations={locations}
          currentUser={currentUser}
          compareNames={NAME_SORTS[sortIdx].compare}
          onEdit={setEditing}
          onRemove={onRemove}
          onResend={onResend}
          onSetPin={onSetPin}
        />
      </div>

      {inviting && (
        <InviteDialog
          locations={locations}
          onCancel={() => setInviting(false)}
          onInvite={(user) => {
            onInvite(user);
            setInviting(false);
          }}
        />
      )}

      {editing && (
        <EditDialog
          user={editing}
          locations={locations}
          onCancel={() => setEditing(null)}
          onSave={(patch) => {
            onUpdate(editing.id, patch);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
