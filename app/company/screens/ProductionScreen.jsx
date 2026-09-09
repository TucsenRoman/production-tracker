"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpFromLine,
  Check,
  CalendarPlus,
  Factory,
  Clock,
  Package,
  Palette,
  TriangleAlert,
  SlidersHorizontal,
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
  Popover,
  SectionHeading,
  Segmented,
  Slot,
  StickyFadeHeader,
  Tooltip,
  cx,
} from "../../components/ui";
import {
  behindStock,
  defaultMinBatch,
  normalizeItem,
  refillQty,
  stockIn,
  shiftDate,
  worthMaking,
  worthMoving,
} from "../../lib/domain";

/**
 * Console-side production targets.
 *
 * The flow this screen runs, in the order a manager actually thinks it:
 *
 *   1. here is what is on the floor
 *   2. here is the min and the max it should sit between
 *   3. so here is what you should plan — and how much of that is a run
 *      versus stock already sitting in the back
 *   4. disagree? change the amount, or change the min and max themselves
 *
 * Every number comes from the domain's own vocabulary rather than a private
 * one invented here: `threshold` is the min, `max` the fill target,
 * `refillQty` the gap between the floor and that max, `behindStock` what
 * could be put out without making anything at all.
 *
 * That last one is why the recommendation is split. "Plan 82 lb" is wrong
 * when 42 lb of it is already in the freezer — the honest answer is move 42
 * and make 40, and a screen that says 82 sends someone to smoke bacon that
 * already exists.
 *
 * The day-by-day strip stayed on the floor Board, where a shift is genuinely
 * working one day at a time. A manager is deciding what to commit, not what
 * is happening at 2pm on Thursday.
 */

/* ONE ROW PER PRODUCT, and the row IS the card.
 *
 * This screen briefly ran two organizing devices stacked on each other: a
 * family meter chart on top, and a grid of plan cards below that only
 * rendered the family you had clicked. The chart was really a nav control
 * wearing a chart's clothes, the cards restated numbers the row above had
 * already drawn, and answering "what do I commit to today" cost a legend
 * read, a family click and then a card read.
 *
 * A meter with a name, a number and an action on it is a card. Drawing both
 * was drawing the same object twice. So the rollup is gone, the click-gate
 * is gone, and every product is one row: name, badge, pipeline bar, floor
 * against target, and the single action that row needs — expandable for
 * amount and station. Ranked most-urgent-first, so the products that need a
 * decision are the ones at the top of the screen, and a fully stocked
 * product settles to the bottom without needing a tab to hide in.
 */

/* Colour only where it discriminates.
 *
 * Two palettes are at work on a row and they answer different questions.
 * The BADGE says how much trouble this product is in, and only trouble
 * earns a hue: `out` is danger, `below` is warn, everything else is
 * neutral. A tone that repeats down the whole list is decoration.
 *
 * The BAR says where the product's stock currently sits in the pipeline, so
 * each band needs to be told apart from its neighbours rather than ranked
 * against them — that's a categorical question, which is why they are
 * distinct hues and not a tint ramp of one.
 *
 * Four bands, not six. Packing and production used to be drawn apart, but
 * how far along a run is inside the smokehouse is the floor terminal's
 * question, not a planning one: from a desk, a batch that exists is a batch
 * that exists, and splitting it bought a legend entry and a colour for a
 * distinction nobody plans against.
 */
/* VOCABULARY: a batch, not a run.
 *
 * The user's call, and it overrides what this file used to say. Earlier
 * passes had this screen inventing "run" for the thing it creates and
 * "book" for the act of creating it — neither word appears in the domain,
 * and both were argued for here on the circular grounds that the screen
 * already used them.
 *
 * So: the console SCHEDULES A BATCH. The floor terminal already calls a
 * physical, in-progress job a batch, and this is the same object earlier in
 * its life — planned, then in production, then closed with a final weight.
 * One word, one thing, at every stage.
 *
 * The two bar bands carry the stage instead of the noun doing it: "Planned"
 * is a batch nobody has touched, "In production" is one that physically
 * exists somewhere in the plant. That distinction is structural — the
 * `schedule` map and the `batches` array really are separate, and
 * `handleAddScheduleTask` deliberately never writes to the second — so it
 * still has to be visible. It just does not need a second noun to say it.
 *
 * Prose comments below this line predate the rename and still say "run" in
 * places. They mean batch. Left alone deliberately: a blind find-and-replace
 * through this file's long comments is how a previous pass turned sentences
 * into gibberish. */
const STATE = {
  /* Nothing on the floor is not the same problem as being under par: one is
   * a case a customer is standing in front of, the other is a number
   * trending the wrong way. */
  out: { label: "Out", tone: "danger", rank: 0 },
  below: { label: "Low", tone: "warn", rank: 1 },
  make: { label: "Needs a batch", tone: "neutral", rank: 2 },
  move: { label: "Move from back", tone: "neutral", rank: 3 },
  planned: { label: "Planned", tone: "neutral", rank: 4 },
  /* NOT AT MAX, AND THAT IS FINE.
   *
   * The state this screen was missing. It had a danger state and a perfect
   * state and nothing in between, so every product that was not exactly at
   * its ceiling read as work — which is how a case sitting comfortably above
   * its minimum ended up on a list headed "needs a decision today".
   *
   * A product is `fine` when it is above its minimum AND the gap left is too
   * small to be worth an action. Both halves matter: above the minimum
   * alone is not enough (there may be a real 40 lb hole worth filling), and
   * a small gap alone is not enough (a product at 2 lb with a minimum of 60
   * is an emergency no matter how little it would take to fix).
   *
   * Ranked just under `planned` and above `full`: a planned product has a
   * person's name on it, a fine one has nobody's, and a full one has no
   * question at all. */
  fine: { label: "Fine", tone: "neutral", rank: 5 },
  /* "At target", not "On hand" — that phrase now names a BAND on the bar
   * (stock sitting behind the floor), and one screen cannot have it mean
   * two things. This label rarely renders, since badges are out/below only,
   * but it matches the row's own fallback text when it does. */
  full: { label: "At target", tone: "neutral", rank: 6 },
};

/* WHAT THE SCREEN WANTS FROM YOU — the three sections, in that order.
 *
 * The list was one flat run of twenty-odd rows sorted by urgency, which is a
 * ranking and not an answer. A ranking says "this one more than that one";
 * it never says "and from here down, nothing". The screen's entire job is to
 * say which two or three things need a decision today, and it was leaving the
 * reader to work out where the list stopped mattering.
 *
 * So the sort became a grouping, and the group names are the three different
 * things the screen can want:
 *
 *   NEEDS YOU     something is wrong — below the minimum, or empty
 *   WORTH A TOP-UP  nothing is wrong, but there is a hole worth filling
 *   FINE            nothing to do, for one of several reasons
 *
 * FINE collapses, and that is the point of the whole exercise: on a normal
 * morning this screen should be three rows tall and a count. A product being
 * fine is information — it is just not information you need to scroll past
 * fifteen times to get at the four that are not. */
const GROUPS = [
  {
    id: "needs",
    label: "Needs you",
    icon: TriangleAlert,
    /* Something is wrong AND you can fix it. Both halves are required — see
     * `covered` below for why the second one is not a detail. */
    match: (r) => (r.state === "out" || r.state === "below") && r.hasAction,
  },
  {
    id: "worth",
    label: "Worth a top-up",
    icon: ArrowUpFromLine,
    /* Keyed on whether there is anything to DO, not on the state name. A
     * product whose batch is already booked can still have stock in the
     * freezer worth carrying out — that is a top-up, not a fine. */
    match: (r) => r.hasAction,
  },
  {
    id: "covered",
    label: "Covered",
    icon: Clock,
    /* SHORT, AND NOTHING YOU CAN DO ABOUT IT.
     *
     * The section that had to exist once the other three did. Being below
     * the minimum and being able to act are different questions, and the
     * first cut of this grouping quietly assumed they were the same one:
     * urgency went to NEEDS YOU, so eight products sat under a heading
     * demanding attention with no button on any of them, because their
     * batch was already booked and the freezer was empty. A list that asks
     * for something it cannot accept is worse than one that stays quiet.
     *
     * But they are not FINE either — that was the previous version's lie,
     * and the one worth naming: a case short of its minimum is short TODAY,
     * whatever lands next Tuesday. So they get their own line, collapsed,
     * where the count alone answers the only question they raise: is
     * anything falling through the cracks? */
    match: (r) => r.state === "out" || r.state === "below",
    collapsible: true,
  },
  {
    id: "fine",
    label: "Fine",
    icon: Check,
    /* The catch-all, by construction: anything the sections above did not
     * claim is above its minimum and has nothing worth doing. Each row still
     * says which flavour of fine it is in its own quiet text — at target,
     * N planned, N lb short of a batch — but the reason is a detail and the
     * answer is the same. */
    match: () => true,
    collapsible: true,
  },
];


/* The bar's legend, and the order the bands are drawn in: left to right,
 * closest-to-sold through to nobody-has-arranged-it. Reading the key top to
 * bottom is reading the pipeline, so it doubles as instructions for the bar
 * rather than an alphabetical list to cross-reference. The remainder is bare
 * track, not a fill — nothing arranged should look like nothing.
 *
 * That remainder is "Till full" — and getting there took five tries worth
 * remembering, because the wrong ones failed in two distinct ways.
 *
 * It was "Needs a plan" first. Wrong frame: both buttons on a row hand work
 * to somebody (Stock to whoever is on the floor today, Make to a station on
 * a production day), so the gap is not an absent plan.
 *
 * Then "Unassigned", which was the right frame and still the wrong words on
 * a bar. Every OTHER band names stock that physically exists somewhere, so
 * "21 lb unassigned" read as a sixth pile of meat sitting in a corner
 * nobody had claimed — the user caught it immediately. "Still to assign"
 * fixed the tense and not the problem: it still named a quantity without
 * saying what the quantity was measured against.
 *
 * "Till max" finally named a destination, and stuck for a while. But `max`
 * is a SETTING — a number somebody typed into the Min & max editor — so the
 * label measured the gap against a piece of configuration rather than
 * against anything in the shop. Accurate, and slightly bureaucratic.
 *
 * "Till full" is the same distance said the way the case itself is
 * described, and "till" carries the sense of counting down to a point that
 * "to" leaves ambiguous — "to full" can be read as a destination label,
 * "till full" can only be read as what is left.
 * A meat case is full or it is not; `max` is only how the app stores that.
 * It also lines up with the `full` state a row reaches when the floor meets
 * its target, so "0 till full" and state `full` are the same fact.
 *
 * Two rules came out of this, both cheap to violate:
 *   1. A remainder names its DESTINATION, not its status. Status words
 *      ("unassigned", "unplanned", "open") describe a pile; only the
 *      destination makes it read as a gap.
 *   2. Name that destination the way the SHOP says it, not the way the
 *      schema does. "Max" is a field; "full" is a case somebody is
 *      standing in front of. */
const BANDS = [
  { key: "floor", label: "On floor", swatch: "bg-stage-floor" },
  { key: "onhand", label: "On hand", swatch: "bg-stage-onhand" },
  { key: "production", label: "In production", swatch: "bg-stage-production" },
  { key: "planned", label: "Planned", swatch: "bg-stage-planned" },
];

/* Where back stock is pulled from, and in what order.
 *
 * The bar says "On hand" and stops there — one band, one number. But that is
 * not a place anybody can walk to, and the domain has always tracked two:
 * `made` is produced-but-not-put-away sitting out, `freezer` is put away cold
 * — different shelves, different handling, and `putOutAll` in domain.js
 * already empties both. So the split lives in the delegation modal and on the
 * task it writes, where somebody is deciding an actual trip. A stocking task
 * saying "get 128 lb from the back" sends someone hunting; "88 off the made
 * pile, 40 out of the freezer" is a route.
 *
 * It was briefly two bands on the bar, and that was the wrong place for it:
 * a fifth hue and a fifth legend entry, spent answering a question the list
 * is not asking. A row is scanned for shape; only the modal is read.
 *
 * Made comes first on purpose: it is already out and at temperature, the pile
 * is meant to be transient, and anything left on it is the stock most likely
 * to be in somebody's way. The freezer is the reserve you break into after. */
const PULL_ORDER = ["made", "freezer"];

/** Split an amount across the back locations, made first. */
function splitPull(item, amount) {
  let left = amount;
  const out = [];
  for (const where of PULL_ORDER) {
    if (left <= 0) break;
    const have = stockIn(item, where);
    const take = Math.min(have, left);
    if (take > 0) {
      out.push({ where, qty: +take.toFixed(1) });
      left -= take;
    }
  }
  return out;
}

const WHERE_LABEL = { made: "the made pile", freezer: "the freezer" };
const pullSentence = (parts, unit) =>
  parts.map((p) => `${Math.round(p.qty)} ${unit} from ${WHERE_LABEL[p.where]}`).join(", ");

export default function ProductionScreen({
  schedule,
  inventory,
  batches = [],
  today,
  stations,
  onSetRange,
  onAddTask,
  onAddTasks,
  tasks = [],
  onAddStocking,
}) {
  const [rangesOpen, setRangesOpen] = useState(false);
  /* How much of the column each bar's TRACK occupies. See the mode comment
   * on the Segmented below. */
  const [lengthMode, setLengthMode] = useState("fill");
  /* The colour key, collapsed by default — see the Key chip below. */
  const [keyOpen, setKeyOpen] = useState(false);
  /* Review-before-booking for the bulk action — see BulkBookModal. */
  const [bulkOpen, setBulkOpen] = useState(false);
  /* Closed on arrival, both of them. The two collapsed groups are the two
   * you came here NOT to read — one has nothing wrong, the other has
   * nothing you can do — and a screen that opens showing thirteen of those
   * is the screen this was before it could tell them apart. */
  const [openGroups, setOpenGroups] = useState(() => new Set());
  const toggleGroup = (id) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* Where an accepted plan lands: the next production day AFTER today.
   *
   * Not today. Planning from the console deliberately never spawns a live
   * batch (see handleAddScheduleTask), and the committed-work scan below
   * skips today because on the FLOOR a same-day add does spawn one and
   * counting both would double-book. Net effect if this pointed at today:
   * the one-click button would write a plan that the row it sits on could
   * never see, so nothing on screen moved and the click looked broken.
   *
   * Aiming at tomorrow is also the truer product stance — today's run is
   * already underway and belongs to the floor terminal; a manager at a desk
   * is committing the days ahead. */
  const defaultDay = useMemo(() => {
    for (let i = 1; i <= 7; i += 1) {
      const key = shiftDate(today, i);
      const dow = new Date(`${key}T00:00:00`).getDay();
      if (dow !== 0 && dow !== 6) return key;
    }
    return shiftDate(today, 1);
  }, [today]);

  /* Built by hand rather than one toLocaleDateString call: asking Intl for
   * weekday + day together renders "7 Mon" in en-US, which reads as a typo. */
  const defaultDayLabel = useMemo(() => {
    const d = new Date(`${defaultDay}T00:00:00`);
    return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${d.getDate()}`;
  }, [defaultDay]);

  const rows = useMemo(() => {
    /* What is already committed against each product, kept as two piles: a
     * run that physically exists somewhere in the plant, and a line booked
     * on a future day that nobody has touched yet. Both are "committed" for
     * the out/below/make classification; the bar draws them apart because
     * one is stock coming and the other is only an intention. */
    const scheduled = new Map();
    const inProduction = new Map();
    /* `unit`, when given, is checked against the product's own unit before
     * the quantity is added — the floor's board has always done this and the
     * planning desk never did, so a mismatch silently inflated the number
     * here while reading correctly there. Anything with no unit to compare
     * (a batch, a stocking task) is counted as before. */
    const unitOf = new Map(inventory.map((i) => [i.product, i.unit || "lb"]));
    const bump = (map, product, n, unit) => {
      if (unit != null && unit !== (unitOf.get(product) || "lb")) return;
      map.set(product, (map.get(product) || 0) + n);
    };

    /* A rolling window forward, NOT the rest of the calendar week. On a
     * Friday the current week has no production days left, so a week-bounded
     * scan could never see a plan at all and everything read as unplanned —
     * including runs booked for Monday. A plan is a plan regardless of which
     * week it falls in.
     *
     * Today is now IN the window, which it could not be before. The old
     * exclusion was there because a plan line and the batch it spawned were
     * indistinguishable, so counting today meant counting the same pounds
     * twice — and the cost was a blind spot exactly where it hurt most: a run
     * the floor queued for this morning was invisible to this screen, which
     * cheerfully proposed scheduling it again. A started line now carries its
     * `batchId` and is skipped here, because `inProduction` below is already
     * counting that batch. Unstarted lines are real committed work and count.
     *
     * Units are checked, not assumed. A plan measured in racks is not three
     * pounds of bacon, and summing it as though it were is how a target reads
     * as met by work that does not exist. */
    for (let i = 0; i <= 7; i += 1) {
      const key = shiftDate(today, i);
      const dow = new Date(`${key}T00:00:00`).getDay();
      if (dow === 0 || dow === 6) continue; // no production at the weekend
      for (const station of stations) {
        for (const t of (schedule[key] || {})[station] || []) {
          if (t.batchId) continue; // already a live batch — counted below
          bump(scheduled, t.text, Number(t.qty) || 0, t.unit);
        }
      }
    }
    /* Every unfinished batch counts the same here regardless of stage.
     * Which stage it sits in — smokehouse, packaging, shelf-ready — is the
     * floor terminal's business; from a planning desk the only question a
     * batch answers is "is this quantity already coming?". */
    for (const b of batches) {
      if (b.finalWeight != null) continue; // already landed in stock
      const qty = Number(b.boxWeight ?? b.estWeight) || 0;
      bump(inProduction, b.product, qty);
    }

    /* Moves already asked for. Without this the screen re-offers "Stock 42"
     * every time it is opened, because a stocking task changes nothing about
     * inventory until somebody actually carries the boxes out — the same
     * de-duplication `planned` does for runs, which is the half that was
     * missing when this split was first sketched. Matches on the task's own
     * `product` field, not its title, so renaming the copy can't break it. */
    const stocking = new Map();
    for (const t of tasks) {
      if (t.completed || t.category !== "stocking" || !t.product) continue;
      bump(stocking, t.product, Number(t.qty) || 0);
    }

    return inventory
      .map(normalizeItem)
      .map((item) => {
        const floor = stockIn(item, "floor");
        const behind = behindStock(item);
        const refill = refillQty(item);
        const fromBack = Math.min(refill, behind);
        const stockingQty = stocking.get(item.product) || 0;
        const stillToStock = Math.max(0, Math.round(fromBack - stockingQty));
        /* How much of the back stock somebody has ALREADY been sent for.
         * Carried on the row so the modal can say why the stocking route is
         * closed instead of silently not offering it.
         *
         * CLAMPED for the availability maths, RAW for anything shown to a
         * person. They diverge exactly when somebody overrides the counts:
         * ask for 33 off a shelf the records say holds 20 and the clamp is
         * right about what can be promised, and wrong about what was asked.
         * A row that answers "20 queued" to a task reading "Restock 33 lb"
         * is telling the manager their own instruction did not land. */
        const queuedStock = Math.round(Math.min(stockingQty, fromBack));
        const queuedRaw = Math.round(stockingQty);
        const toMake = Math.max(0, +(refill - behind).toFixed(1));
        const scheduledQty = scheduled.get(item.product) || 0;
        const inProductionQty = inProduction.get(item.product) || 0;
        const planned = scheduledQty + inProductionQty;

        /* MIN IS THE TRIGGER. MAX IS ONLY THE TARGET.
         *
         * This used to read `refill > 0` and nothing else — the moment a
         * case was one pound off its ceiling it wanted work, and the
         * minimum was decoration on a badge. That is backwards. The minimum
         * is the line that says something is wrong; the max only says where
         * to stop once you have decided to act.
         *
         * So there are two ways onto the list now and they are not the same
         * kind of thing:
         *
         *   URGENT — below the minimum. Something IS wrong. Offered
         *   regardless of how small the fix is, because the two failure
         *   modes are not symmetric: running out is loud, immediate, and
         *   there is a customer standing in front of the case, while an
         *   inefficiently small run is quiet and costs a changeover. When in
         *   doubt, be wrong on the cheap side.
         *
         *   WORTH IT — above the minimum, nothing wrong, but there is a hole
         *   big enough to be worth filling while you are here. Moving stock
         *   qualifies at any size (it is free); making has to clear the
         *   product's minimum batch.
         *
         * Everything else is `fine`, which is the whole point. */
        const stillToMake = Math.max(0, Math.round(toMake - planned));
        const urgent = floor < item.threshold;
        const canOffer =
          worthMoving(stillToStock) || worthMaking(item, stillToMake);

        /* Order matters, and `planned` used to sit above the urgency
         * checks — so a product sitting at 18 with a minimum of 45 was
         * classified "handled" the moment a batch existed for it. That was
         * survivable while the list was one flat run. It stopped being
         * survivable the moment there was a section called FINE for it to
         * land in, because the screen was then saying "nothing to worry
         * about" about a case that is short right now.
         *
         * A booked batch lands next week. The floor is short today. Being
         * below the minimum outranks having a plan. */
        let state;
        if (refill <= 0) state = "full";
        else if (floor <= 0) state = "out";
        else if (urgent) state = "below";
        else if (planned >= toMake && toMake > 0) state = "planned";
        else if (!canOffer) state = "fine";
        else if (stillToMake > 0) state = "make";
        else state = "move";

        /* Computed once, here, because the ROW and the SECTION must not be
         * allowed to disagree about it. They did: the row asked "is there
         * anything offerable" and the section asked "what state is this",
         * and a product whose batch was covered but whose freezer stock was
         * not landed under a heading that said FINE with a button on it. */
        const canMakeNow =
          stillToMake > 0 && (urgent || worthMaking(item, stillToMake));
        const hasAction = worthMoving(stillToStock) || canMakeNow;

        return {
          item,
          floor,
          behind,
          refill,
          fromBack,
          stillToStock,
          queuedStock,
          queuedRaw,
          toMake,
          planned,
          stillToMake,
          hasAction,
          canMakeNow,
          scheduled: scheduledQty,
          inProduction: inProductionQty,
          state,
        };
      })
      .sort(
        (a, b) =>
          STATE[a.state].rank - STATE[b.state].rank ||
          b.refill - a.refill ||
          a.item.product.localeCompare(b.item.product),
      );
  }, [inventory, schedule, batches, tasks, today, stations]);

  /* Only "attention" rows feed the header — a planned or on-hand product
   * has nothing left to decide. */
  const attention = useMemo(
    () => rows.filter((r) => ["out", "below", "make", "move"].includes(r.state)),
    [rows],
  );

  const groupOf = (r) => GROUPS.findIndex((g) => g.match(r));
  const countIn = (gi) => rows.filter((r) => groupOf(r) === gi).length;
  const needsCount = countIn(0);
  const worthCount = countIn(1);
  const coveredCount = countIn(2);
  const fineCount = countIn(3);
  /* Only batches worth running. This is the line that used to put a 2 lb
   * pork belly run and a 3 lb ribeye run into a ten-item bulk proposal —
   * `>= 1` meant "any amount at all", which is not a threshold, it is the
   * absence of one. A product still below its minimum stays in regardless
   * of size; see the classification above for why the asymmetry. */
  const runnable = attention.filter(
    (r) =>
      worthMaking(r.item, Math.round(r.toMake - r.planned)) ||
      (r.floor < r.item.threshold && r.toMake - r.planned >= 1),
  );

  /* Scale mode's shared ruler: the largest target in the catalogue takes the
   * full column, everything else takes its honest fraction of that. */
  const biggestMax = useMemo(
    () => rows.reduce((n, r) => Math.max(n, r.item.max || 0), 0),
    [rows],
  );
  const trackPctFor = (item) => {
    if (lengthMode !== "scale" || biggestMax <= 0) return 100;
    /* A hard floor of 4%, and it is a real (small) lie. Below about that a
     * track cannot show its own fill, hold a hover, or carry the minimum
     * tick — a row that can do none of those has stopped being a row. Four
     * percent of a wide column is a few pixels of distortion at the very
     * bottom of the range, which is cheaper than a product that silently
     * cannot be read or clicked. */
    return Math.max(4, ((item.max || 0) / biggestMax) * 100);
  };

  /* What a bulk booking WOULD be. Deliberately just the proposal — the
   * button opens a review, it does not commit.
   *
   * One click used to book every run on the screen: ten production slots,
   * each on a real day at a real station, from a control whose entire label
   * was a number. Nothing about a toolbar button reads as "commit the whole
   * list", nothing showed what was about to happen, and undoing it meant
   * finding ten schedule rows by hand. A bulk action is the one place where
   * the cost of a mis-click is multiplied by the number of rows, which is
   * exactly where a confirmation earns its keep. */
  const bulkTasks = runnable
    .map((r) => ({
      day: defaultDay,
      station: stations[0],
      product: r.item.product,
      qty: Math.max(0, Math.round(r.toMake - r.planned)),
      unit: r.item.unit,
    }))
    .filter((t) => t.qty > 0);

  const commitBulk = (tasks) => {
    if (tasks.length === 0) return;
    if (onAddTasks) onAddTasks(tasks);
    else tasks.forEach((t) => onAddTask(t.day, t.station, t.product, t.qty, t.unit));
    setBulkOpen(false);
  };

  return (
    <div>
      {/* The old header ran four facts together in small grey type jammed
       *  against a button. It is a sentence now, in the order the screen
       *  argues them — what is wrong, what can be moved, what has to be
       *  made — with the one bulk action that answers it sitting at the
       *  end rather than a summary with nothing to do about itself. */}
      {/* Min & max sits with the page title, not in the toolbar.
       *
       *  It is a SETTINGS dialog — every product's band in one place, opened
       *  when a band is wrong, which is monthly at best. The toolbar is the
       *  strip you use every morning, and a control you touch twelve times a
       *  year was holding a slot in it and pushing the day's actual action
       *  out of alignment with the column it acts on.
       *
       *  Moving it up also lets the toolbar's right edge line up with the
       *  list's right edge, so "Book N runs" now sits directly above the
       *  Delegate buttons it is the bulk form of. The one-at-a-time control
       *  and the all-at-once control are the same column.
       *
       *  Posted through `Slot` rather than prop-drilled: `rangesOpen` lives
       *  in this screen, and threading it up through ConsoleShell just to
       *  render a button would put the button and its handler in different
       *  files. */}
      <Slot name="page-actions">
        <Tooltip label="Levels by product">
          <IconButton
            label="Levels by product"
            icon={SlidersHorizontal}
            onClick={() => setRangesOpen(true)}
          />
        </Tooltip>
      </Slot>

      {/* z=50, up from the default 10. The bar's own marks outrank it
       *  otherwise: a hovered band sits at z-10 and the minimum tick at
       *  z-20, and because `PlanMeter`'s wrapper is `relative` with an auto
       *  z-index it never opens a stacking context to contain them. So a
       *  row scrolling under a sticky toolbar painted its tick straight
       *  through it. Chrome outranks content. */}
      <StickyFadeHeader pad={28} z={50}>
        {/* Mode and key live in the toolbar, not over the list.
         *
         *  They sat in a band between the header and the first row, under a
         *  "Most urgent first" caption. Two problems. The caption described
         *  a sort nobody chose and cannot change — it read like a control
         *  and did nothing, which is worse than saying nothing, and the
         *  ranking is self-evident the moment you look at two rows. And the
         *  band itself was a second toolbar: everything in it acts on the
         *  whole list, exactly like the buttons already sitting in the real
         *  one, so the screen was asking where to look for a control by
         *  splitting them across two rows.
         *
         *  Now one toolbar. It also stays put — StickyFadeHeader pins it,
         *  so the key is still on screen at row forty, which is precisely
         *  where somebody stops remembering what purple meant. */}
        {/* px-2 matches the list rows' own padding. Without it the toolbar
         *  ran 8px wider than the list, and nothing in it could line up
         *  with a column below. */}
        <div className="flex items-center justify-between gap-x-4 gap-y-2 flex-wrap px-2">
          <div className="flex items-center gap-3 flex-wrap">
          {/* Fill / Scale — what the LENGTH of a track means.
           *
           *  Fill: every track is the full column, so a bar is read against
           *  its own product's max. Twenty bars all reaching the same right
           *  edge, each answering "how full is this one". Right for the
           *  screen's actual job — which products need a decision — and
           *  wrong for any comparison between rows, since 25 lb of Maple
           *  Brats and 130 lb of Pork Bellies both draw a full track when
           *  they are at target.
           *
           *  Scale: one ruler for the catalogue. The biggest target takes
           *  the whole column and everything else takes its true fraction,
           *  so a pound is the same distance on every row and the bars can
           *  finally be compared with each other — how much product this
           *  is, not just how full its case is.
           *
           *  This is deliberately a MODE and not a default, and it is the
           *  second time bar length has tried to carry meaning here. The
           *  first was a dropdown that scaled length by target size while
           *  fill carried a different measurement — two scales on one row,
           *  silently, which is why it was deleted. Length can mean
           *  something as long as the reader chose it and can see which
           *  choice is live. */}
            {/* Bare chips, no track — the shape `Segmented` was built to
             *  have ("the chips sit on the page and the active one takes
             *  the 5% tint", per the primitive's own note).
             *
             *  It briefly wore a bordered track, on the theory that two
             *  chips with only a tint between them read as two loose words.
             *  Two things were wrong with that. A four-sided rounded box
             *  around a group is the one structure this app's design system
             *  bans outright — grouping is a hairline or nothing. And the
             *  border plus its 2px inset made the control 34px tall in a
             *  row where every other control is 28, which is the specific
             *  defect a rendered-page audit exists to catch: nothing is
             *  wrong with either height on its own, only with the two of
             *  them side by side.
             *
             *  The 5% tint on the active chip is the grammar. It is what
             *  every other Segmented in the app uses, and the 12px gap to
             *  the next control against the chips' own 4px is what says
             *  these two are one thing. */}
            <Segmented
              size="sm"
              value={lengthMode}
              onChange={setLengthMode}
              options={[
                {
                  value: "fill",
                  label: "Fill",
                  hint: "Every bar fills the column — each one read against its own product's max",
                },
                {
                  value: "scale",
                  label: "Scale",
                  hint: "One scale for all products — bar length is the size of the target, so rows compare",
                },
              ]}
            />
            {/* Grouped by what it acts on, not by what shape it is.
             *
             *  The key sits with Fill/Scale because those two are the same
             *  question — HOW TO READ THE BARS. Everything on the right is
             *  the other question: what to do about them. It briefly lived
             *  on the right beside Min & max, on the weaker grouping "both
             *  are icons you rarely press", and that cost the toolbar its
             *  alignment: with an icon sitting after it, "Book N runs"
             *  could not line up with the Delegate column it is the bulk
             *  form of.
             *
             *  An icon rather than the old labelled chip, because that chip
             *  carried a row of four 6px swatches — a decoration competing
             *  with the very bars it was trying to explain. */}
            {/* The key floats now, and that is a layout fix as much as a
             *  visual one.
             *
             *  Open, it used to take a line of its own beneath the toolbar:
             *  the whole list jumped down six rows' worth of nothing, and
             *  jumped back when you closed it — for a legend you consult
             *  while looking at a bar, which is exactly the moment you do
             *  not want the bars to move. A reference panel should sit ON
             *  the thing it explains, not shove it.
             *
             *  `Popover` portals it and positions it fixed, which is not
             *  fussiness: this toolbar is a `StickyFadeHeader`, an element
             *  whose entire job is carrying a mask-image, and a mask clips
             *  its subtree. An absolutely-positioned panel here gets cut off
             *  at the header's padding edge and faded out by the header's
             *  own gradient. Anchored start-aligned: the icon sits at the left of the
             *  row, so the panel opens rightward from it. `Popover` clamps
             *  to the viewport either way. */}
            <Popover
              open={keyOpen}
              onClose={() => setKeyOpen(false)}
              align="start"
              label="What the colours on the bars mean"
              panelClassName="p-3"
              content={
                <ul className="flex flex-col gap-1.5 text-xs text-ink-2 whitespace-nowrap">
                  {BANDS.map((b) => (
                    <li key={b.key} className="flex items-center gap-2">
                      <span className={cx("w-2.5 h-2.5 rounded-full shrink-0", b.swatch)} />
                      {b.label}
                    </li>
                  ))}
                  <li className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-line border border-line-strong" />
                    Till full
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-[3px] h-3 rounded-full shrink-0 bg-ink mx-[3.5px]" />
                    Minimum
                  </li>
                </ul>
              }
            >
              {/* Suppressed while the panel is up. The pointer is still on
               *  the icon after the click, so the hover label fired on top
               *  of the thing it had just opened — two floating layers from
               *  one control, one of them explaining a panel you are
               *  already looking at. */}
              <Tooltip label="What the colours mean" disabled={keyOpen}>
                <IconButton
                  label="Colour key"
                  icon={Palette}
                  aria-expanded={keyOpen}
                  onClick={() => setKeyOpen((v) => !v)}
                  className={keyOpen ? "bg-hover text-icon" : undefined}
                />
              </Tooltip>
            </Popover>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* The triage, in three words and two numbers.
             *
             *  It read "1 out · 8 low" — two counts of the same kind of
             *  trouble, which is a detail the rows themselves already carry
             *  in their badges. What the reader actually wants off a toolbar
             *  is the shape of the morning: how many need me, how many are
             *  worth a look, how many I can ignore.
             *
             *  "N fine" is the number that would have been unsayable a
             *  version ago, and it is the one that makes the other two mean
             *  something — nine needing attention out of twelve is a bad
             *  day, nine out of forty is a Tuesday. */}
            <span className="text-xs tnum">
              {needsCount > 0 && (
                <span className="text-danger font-medium">{needsCount} need you</span>
              )}
              {needsCount > 0 && worthCount > 0 && (
                <span className="text-ink-3"> · </span>
              )}
              {worthCount > 0 && (
                <span className="text-ink-2">{worthCount} worth a top-up</span>
              )}
              {(needsCount > 0 || worthCount > 0) && fineCount + coveredCount > 0 && (
                <span className="text-ink-3"> · </span>
              )}
              {fineCount + coveredCount > 0 && (
                <span className="text-ink-3">{fineCount + coveredCount} fine</span>
              )}
            </span>
            {bulkTasks.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                icon={CalendarPlus}
                onClick={() => setBulkOpen(true)}
              >
                Schedule {bulkTasks.length}{" "}
                {bulkTasks.length === 1 ? "batch" : "batches"}&hellip;
              </Button>
            )}
            {/* Icon-only. Min & max are SETTINGS — opened when a product's
             *  band is wrong, which is monthly at best — and a full-width
             *  labelled button sat them at the same weight as the action
             *  taken every morning. Really they want to live with the
             *  product record on Inventory; until they do, this is the
             *  honest weight for them here. */}
          </div>
        </div>

      </StickyFadeHeader>

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={Check} title="No products yet" description="Add products from Inventory to see targets here." />
        </Card>
      ) : (
        <div>
          {/* Striped, not ruled — and definitely not boxed.
           *
           *  Bordered cards in a grid put a frame around every product and
           *  made the list read as twenty objects. Hairlines fixed that, but
           *  a rule between rows is a mark that has to be drawn, seen, and
           *  then ignored: it separates by adding ink. A tinted every-other
           *  row separates by contrast alone, which costs nothing to look
           *  past — and it pairs better with this list's actual job, which
           *  is tracking one bar horizontally across a wide row to its
           *  button. The stripe is the guide rail; a hairline never was.
           *
           *  The stripe now restarts inside each section rather than running
           *  continuously, so a group always opens on white. A stripe that
           *  carries across a heading reads as one list wearing a label
           *  halfway down it. */}
          {GROUPS.map((g, gi) => {
            /* First match wins, so every row lands in exactly one section
             * and the counts add up to the catalogue. */
            const items = rows.filter(
              (r) => GROUPS.findIndex((x) => x.match(r)) === gi,
            );
            if (items.length === 0) return null;
            const open = !g.collapsible || openGroups.has(g.id);
            return (
              <section key={g.id} className="mb-5 last:mb-0">
                {/* The heading is the containing device — the reason these
                 *  rows need no box around them. `pl-6` on the list is what
                 *  closes the group at the other end. */}
                {g.collapsible ? (
                  /* Only the two no-action groups open and close. Making
                   *  NEEDS YOU or WORTH A TOP-UP collapsible would be
                   *  offering to hide the work, which is a feature nobody
                   *  should be given. */
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => toggleGroup(g.id)}
                    className="w-full text-left rounded-md -mx-1 px-1 hover:bg-faint transition-colors duration-100"
                  >
                    <SectionHeading icon={g.icon} label={g.label} count={items.length} />
                  </button>
                ) : (
                  <SectionHeading icon={g.icon} label={g.label} count={items.length} />
                )}

                {open && (
                  <ul className="pl-6">
                    {items.map((row, i) => (
                      <PlanRow
                        key={row.item.product}
                        row={row}
                        defaultDay={defaultDay}
                        defaultDayLabel={defaultDayLabel}
                        onAddTask={onAddTask}
                        onAddStocking={onAddStocking}
                        striped={i % 2 === 1}
                        trackPct={trackPctFor(row.item)}
                        stations={stations}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {bulkOpen && (
        <BulkBookModal
          tasks={bulkTasks}
          dayLabel={defaultDayLabel}
          stations={stations}
          onClose={() => setBulkOpen(false)}
          onConfirm={commitBulk}
        />
      )}

      {rangesOpen && (
        <RangesModal
          inventory={inventory}
          onSetRange={onSetRange}
          onClose={() => setRangesOpen(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ parts -- */

/**
 * The pipeline bar for one product: floor, then back stock that could be
 * put out today, then batches that physically exist, then runs booked but
 * untouched — and whatever is left is bare track: the distance still to
 * cover before this product hits its max.
 *
 * Bands are drawn as cumulative spans from 0, widest first, so each later
 * span paints over the one before it and the seams never show. Each is its
 * own hover target with its own number, positioned on the pointer rather
 * than centred on the segment (`followCursor` is load-bearing — a segment
 * can be most of the bar's width).
 *
 * `adding` is the ghost of an amount being typed in the expanded row: it
 * shows where the bar would reach if that run were booked, which is the
 * whole reason to type a number other than the recommended one.
 */
function PlanMeter({ row, adding = 0, trackPct = 100 }) {
  const { item, floor, fromBack, inProduction, scheduled } = row;
  const max = item.max;
  const pct = (n) => (max > 0 ? Math.max(0, Math.min(100, (n / max) * 100)) : 0);

  const cFloor = floor;
  const cOnHand = cFloor + fromBack;
  const cProduction = cOnHand + inProduction;
  const cPlanned = cProduction + scheduled;
  const tillMax = Math.max(0, max - cPlanned);

  /* DISCRETE SEGMENTS, drawn right to left.
   *
   * These were cumulative spans from zero — every band a pill starting at 0,
   * widest painted first, each later one covering the last so the seams never
   * showed. That produced exactly the right picture and made a band
   * impossible to animate on its own: growing the "on hand" span would have
   * grown it from zero, so it would have bloomed out from behind the floor
   * band as a halo rather than thickening the stretch you were pointing at.
   *
   * Each band is now its own box, [start, end], which can be hovered and
   * resized without touching its neighbours. The overlap trick that hid the
   * seams is kept, just moved: every segment is stretched 5px (its own
   * radius) to the LEFT, and they are painted right to left, so each one's
   * rounded left cap lands underneath the segment drawn after it. The
   * rightmost cap of each band stays visible, which is the join the old
   * version drew and the reason it read as one continuous bar. */
  const SEGMENTS = [
    { key: "floor", from: 0, to: cFloor, swatch: "bg-stage-floor", label: `${Math.round(floor)} ${item.unit} on floor` },
    { key: "onhand", from: cFloor, to: cOnHand, swatch: "bg-stage-onhand", label: `${Math.round(fromBack)} ${item.unit} on hand, ready to move` },
    { key: "production", from: cOnHand, to: cProduction, swatch: "bg-stage-production", label: `${Math.round(inProduction)} ${item.unit} in production` },
    { key: "planned", from: cProduction, to: cPlanned, swatch: "bg-stage-planned", label: `${Math.round(scheduled)} ${item.unit} planned` },
  ].filter((s) => s.to > s.from);

  /* Where a segment sits, and the leftward overlap that hides its cap.
   *
   * OVERLAP IS ONE FULL BAR HEIGHT, not half. This was 5px — the radius —
   * on the reasoning that the cap is 5px wide, so 5px of tuck should cover
   * it. It does not, and the geometry says why: at 5px of overlap the two
   * caps are still curving against each OTHER. The left band's cap falls
   * from full height to nothing across its last 5px while the right band's
   * cap rises from nothing to full height across the same 5px, and the
   * union of two circles crossing like that pinches to ~87% in the middle.
   * That is the notch — small enough to survive a screenshot at 100% and
   * obvious the moment anybody looks closely.
   *
   * For a cap to read as a colour boundary rather than a join, the band
   * BEHIND it has to be at full height across the whole curve. A band only
   * reaches full height one radius in from its own start, so the one behind
   * has to start two radii back: 2 × 5px = the bar's own height. 14px,
   * because that is the height a band takes when it is hovered, and the
   * seam has to hold in that state too.
   *
   * The first segment starts flush at zero — nothing to its left to tuck
   * under, and a negative offset there pokes out of the track. */
  const CAP_TUCK = 14;
  const place = (s, i) =>
    i === 0
      ? { left: 0, width: `${pct(s.to)}%` }
      : {
          left: `calc(${pct(s.from)}% - ${CAP_TUCK}px)`,
          width: `calc(${pct(s.to) - pct(s.from)}% + ${CAP_TUCK}px)`,
        };

  return (
    /* Three boxes deep, and each one earns its place. The outer is a fixed
     * 16px hover area whose height never changes, so the row cannot twitch
     * as the pointer crosses it. The middle is a 14px stage — the height a
     * grown segment needs, unclipped. The inner is the 10px resting track
     * everything is drawn against. */
    <div
      className="relative h-4 flex items-center transition-[width] duration-300 ease-out motion-reduce:transition-none"
      style={{ width: `${trackPct}%` }}
    >
      <div className="relative w-full h-3.5">
        {/* The resting track, and the bare stretch at the end of it. The
         *  track names the boundary it ends at, the way the min tick names
         *  the one it sits on — "Maximum 130 lb" — and then the distance to
         *  it. Both halves are load-bearing and neither is reachable any
         *  other way: the max is a SETTING the row no longer prints, and the
         *  gap is arithmetic nobody should have to do. */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2.5 rounded-full bg-line">
          <span aria-hidden="true" className="absolute inset-0">
            <Tooltip
              label={`Maximum ${max} ${item.unit} · ${Math.round(tillMax)} ${item.unit} till full`}
              className="w-full h-full"
              disabled={tillMax <= 0}
              followCursor
            />
          </span>
        </div>

        {/* The typed amount, sitting in the gap it would actually fill —
         *  after everything real, before the end of the track. Not
         *  interactive and not hoverable: it is a preview of a number the
         *  reader is currently typing, not a thing to inspect. */}
        {adding > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1/2 -translate-y-1/2 h-2.5 pointer-events-none rounded-full bg-cold-soft transition-[left,width] duration-300 ease-out motion-reduce:transition-none"
            style={{
              left: `calc(${pct(cPlanned)}% - 14px)`,
              width: `calc(${pct(Math.min(max, cPlanned + adding)) - pct(cPlanned)}% + 14px)`,
            }}
          />
        )}

        {/* Right to left, so each cap tucks under its left-hand neighbour. */}
        {[...SEGMENTS].reverse().map((s) => {
          const i = SEGMENTS.indexOf(s);
          return (
            <span
              key={s.key}
              aria-hidden="true"
              /* 10px at rest, 14px on ITS OWN hover — the band under the
               * pointer, not the bar it belongs to. Centred, so it thickens
               * outward instead of dropping. 120ms: fast enough not to read
               * as lag, slow enough to be a movement rather than a jump. */
              className={cx(
                "absolute top-1/2 -translate-y-1/2 h-2.5 hover:h-3.5 rounded-full hover:z-10",
                "transition-[height,left,width] duration-[120ms] ease-out motion-reduce:transition-none",
                s.swatch,
              )}
              style={place(s, i)}
            >
              <Tooltip label={s.label} className="w-full h-full" followCursor />
            </span>
          );
        })}

        {/* Darkest, most solid mark on the row on purpose — every fill is
         *  muted, and a threshold line in the same register all but
         *  disappeared crossing the lighter ones. It marks WHERE the minimum
         *  sits: a gradation on a scale, true of every product whether or
         *  not anything is wrong, which is why it is ink and not amber.
         *
         *  It hovers like every band does, because it is the one mark whose
         *  VALUE cannot be got any other way now that the numbers came off
         *  the row — a band at least has its own width to compare against
         *  its neighbours; a tick is only a position.
         *
         *  The 3px line sits in a 12px hover target: a hairline is a
         *  pixel-accurate mouse move, and the reason to reach for it is
         *  usually that you could not read it precisely in the first place.
         *  Above the segments so it stays reachable at either end. */}
        <span
          className="absolute z-20 top-1/2 -translate-y-1/2 -translate-x-1/2 h-[18px] transition-[left] duration-300 ease-out motion-reduce:transition-none"
          style={{ left: `${pct(item.threshold)}%` }}
        >
          <Tooltip
            label={`Minimum ${item.threshold} ${item.unit}`}
            className="h-full w-3 justify-center"
            followCursor
          >
            <span aria-hidden="true" className="w-[3px] h-full rounded-full bg-ink" />
          </Tooltip>
        </span>
      </div>
    </div>
  );
}

/**
 * One product, one row — the meter, the numbers and the decision together.
 *
 * The action slot is never empty. Where there is nothing to MAKE it carries
 * the reason instead, because a row reading "Low" with a blank
 * right-hand side looks broken rather than finished. A product that only
 * needs moving gets no button at all: the console has no move handler —
 * putting stock on the floor is floor work — so the only thing a button
 * there could do is book a run for meat already sitting in the freezer.
 * That shipped once before it was caught.
 */
function PlanRow({
  row,
  defaultDay,
  defaultDayLabel,
  onAddTask,
  onAddStocking,
  striped = false,
  trackPct = 100,
  stations,
}) {
  const { item, fromBack, stillToStock, planned, queuedRaw, stillToMake, state } = row;
  const s = STATE[state];

  const [open, setOpen] = useState(false);

  /* All three come off the row, computed once where the state was decided.
   * Recomputing them here is how the row and its section came to disagree. */
  /* QUEUED ONLY — booked batches already have a band.
   *
   * This briefly showed "N booked" too, and the render settled the
   * question in one screenshot: seven of the eight visible rows wore a
   * chip, because most products have something in production. A mark that
   * constant down a list is decoration, which is the same test that took
   * the "Low" badge off two passes ago.
   *
   * And it was redundant on top of that. Everything booked is ALREADY on
   * the bar — in-production and planned are two of its four bands, drawn to
   * scale, two inches to the right. A stocking task is the one commitment
   * the bar cannot draw, because it moves nothing until somebody carries
   * the boxes, and that is precisely why delegating a move looked like
   * nothing happened. This chip exists for that one gap and no other. */
  const committed = queuedRaw > 0 ? `${queuedRaw} queued` : null;

  const canMake = row.canMakeNow;
  const canStock = stillToStock > 0 && !!onAddStocking;
  const hasAction = row.hasAction && (canMake || canStock);

  return (
    <>
      <li className={cx("px-2 py-2 rounded-md", striped && "bg-faint")}>
        <div className="flex items-center gap-3">
          {/* Names get room, and get to wrap.
           *
           *  They were a single truncated line in a 176px column, which is
           *  narrower than half this catalogue: "Bratwurst - Jalapeño
           *  Cheddar" and "Bratwurst - Jalapeño Habanero" both rendered as
           *  "Bratwurst - Jalapeñ…", so the column asked the reader to
           *  identify products by a string that was identical across
           *  several of them. Wider, two lines, and the full name on hover —
           *  a truncated label is only acceptable when something else on the
           *  row identifies the thing, and here nothing does. */}
          <span className="w-60 shrink-0 min-w-0 flex items-start gap-2 self-center">
            {/* The shrinking half of this column, and it needs its own
             *  wrapper: `Tooltip` is `inline-flex shrink-0`, so passing it
             *  `min-w-0` does nothing — it refuses to give up width, takes
             *  its full content size, and shoves whatever sits beside it
             *  out of the 240px column and over the bar. That is how
             *  "41 queued" ended up printed underneath a green band.
             *
             *  A plain `min-w-0 flex-1` span around it puts the shrink where
             *  flexbox can act on it, and `max-w-full` inside keeps the
             *  tooltip's own box within it so the name clamps to two lines
             *  instead of running on. */}
            <span className="min-w-0 flex-1">
              <Tooltip label={item.product} className="max-w-full">
                <span className="text-sm font-medium text-ink leading-snug line-clamp-2 text-left">
                  {item.product}
                </span>
              </Tooltip>
            </span>
            {/* "Out" only. The "Low" badge went the moment the sections
             *  arrived: every row under NEEDS YOU is low by definition, so a
             *  badge saying so was the heading repeated sixteen times in
             *  amber — a tone constant down a whole group, which is this
             *  screen's own definition of decoration.
             *
             *  Out still earns one, because it discriminates WITHIN the
             *  group: an empty case is a different problem from a thin one,
             *  and that is the distinction the section cannot draw. */}
            {state === "out" && <Badge tone={s.tone}>{s.label}</Badge>}
            {/* WHAT HAS ALREADY BEEN ASKED FOR.
             *
             *  Delegating used to leave no mark on the row at all. The task
             *  was written, the toast fired, the modal knew about it on
             *  reopen — and the row a manager was actually looking at was
             *  pixel-identical before and after, because this fact only had
             *  a home in the branch that renders when there is NOTHING left
             *  to do. Any product that still needed a batch swallowed its
             *  own stocking task silently.
             *
             *  It cannot live on the bar: the bands are physical stock, and
             *  a stocking task moves nothing until somebody carries the
             *  boxes. It cannot live in the action column either without
             *  pushing the buttons out of the alignment that column exists
             *  to hold. So it sits with the name, in the slot the badge
             *  already occupies — the row's "what you should know about
             *  this product before you look at anything else" position. */}
            {/* shrink-0, because a long product name will otherwise eat it:
             *  "Bratwurst - Jalapeño Cheddar" clipped this to "68 booke" on
             *  the first render. The name is the flexible half of this
             *  column and already truncates to two lines; the chip is a
             *  fixed fact and has to keep its width. */}
            {committed && (
              <span className="shrink-0">
                <Badge tone="neutral">{committed}</Badge>
              </span>
            )}
          </span>

          <div className="flex-1 min-w-0">
            <PlanMeter row={row} trackPct={trackPct} />
          </div>

          {/* No number column at all.
           *
           *  It went `0 / 60–130`, then just the floor figure, then nothing.
           *  The bar already draws every one of those: the fill is the
           *  floor, the ink tick is the minimum, the end of the track is the
           *  max. A printed figure beside it was the same fact in a second
           *  notation, and it cost the row's most valuable property —
           *  scanning twenty bars for shape is instant, scanning twenty
           *  numbers is arithmetic.
           *
           *  Precision has somewhere better to live: every band on the bar
           *  is its own hover with its own number, and the Delegate modal
           *  opens with the full breakdown. Nothing was lost that the reader
           *  can't get in one gesture, at the moment they actually need it. */}

          {/* ONE verb, because the row is not where that choice belongs.
           *
           *  This was two buttons — Stock and Make — in two fixed cells. It
           *  aligned, but it put the fork in the road at the widest, most
           *  repeated part of the screen: twenty rows each asking a question
           *  ("run or move?") whose answer needs the numbers that are only
           *  in the modal anyway. And where a product needed both, the row
           *  quietly implied you picked one. (A per-row Skip briefly sat
           *  beside it and was scrapped: parking a product is not a
           *  decision, and a control for deferring one costs the same
           *  attention on every row as the control for making it.)
           *
           *  Delegate is the thing every row genuinely has in common: hand
           *  this to somebody. HOW — a run at a station, or stock carried
           *  out of the back — and HOW MUCH are the same decision, made in
           *  one place with the bar in front of you. */}
          {/* One cell, two possible contents: the button, or the reason
           *  there isn't one. The status text used to sit on a second line
           *  under the bar, to keep an inactive row from pushing the button
           *  out of alignment — but a fixed-width cell already guarantees
           *  that, and the second line was making short rows tall for a
           *  fact nobody is scanning for. Where a decision would be is the
           *  right place to say why there isn't one. Kept quiet (ink-4, no
           *  weight) so a column of them never competes with the buttons
           *  that DO want a click. */}
          <span className="w-28 shrink-0 flex justify-end">
            {hasAction ? (
              /* Outlined, always. This was `primary` for out/below, which
               *  put nine filled blue buttons down the right edge of the
               *  resting screen — the loudest thing on the page, spent on a
               *  fact the row already states twice (a badge, and its
               *  position at the top of the list).
               *
               *  The sections are what changed the argument. Urgency now
               *  has a heading with its own name and count carrying it, so
               *  the colour was the third notation of the same thing. The
               *  screen's one filled accent belongs to the action you take
               *  after deciding — the confirm inside the modal — not to
               *  twenty invitations to open one. */
              <Button
                size="sm"
                className="w-full"
                variant="secondary"
                onClick={() => setOpen(true)}
              >
                Delegate
              </Button>
            ) : (
              /* Only the reasons the chip does not already give. "N planned"
               * and "N queued" moved to the name, so repeating them here
               * would print the same fact twice on one row. */
              <span className="text-xs text-ink-4 tnum truncate">
                {state === "full"
                  ? "at target"
                  : /* The reason, in the gap's own units. "Fine" on its own
                     *  invites the obvious question — fine according to
                     *  what? — and the answer is a number the reader can
                     *  check against the bar beside it. */
                    state === "fine" && stillToMake > 0
                    ? `${stillToMake} ${item.unit} short of a batch`
                    : null}
              </span>
            )}
          </span>
        </div>

      </li>

      {open && (
        <DelegateModal
          row={row}
          recStock={stillToStock}
          recMake={stillToMake}
          canStock={canStock}
          canMake={canMake}
          defaultDayLabel={defaultDayLabel}
          stations={stations}
          onClose={() => setOpen(false)}
          onConfirm={(how, qty, station, pull) => {
            if (how === "make") onAddTask(defaultDay, station, item.product, qty, item.unit);
            else
              onAddStocking(item.product, qty, item.unit, state === "out", {
                parts: pull,
                sentence: pullSentence(pull, item.unit),
              });
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

/**
 * Delegating one product: who does it, and how much.
 *
 * The amount used to live behind a chevron on every row — three controls
 * times twenty-odd products is sixty controls competing on a screen whose
 * job is to say which two or three things need a decision today. A
 * disclosure that is closed by default also reads as "there is more here"
 * on every single row, which is the opposite of a ranked list.
 *
 * So the row commits to one thing (which products need somebody), and this
 * holds the whole decision. It opens on the recommended route with the
 * recommended amount already typed, so the fast path is a click and Enter.
 *
 * The bar comes with it, full size and itemised, because the amount is
 * exactly the argument the bar is making: the ghost band moves as you type,
 * so 60 visibly overshoots the max instead of having to be worked out.
 *
 * **Switching route re-types the amount.** 42 lb is the right answer for
 * carrying stock out of the back and the wrong one for booking a run, and
 * an amount left over from the other route is the kind of default that gets
 * committed without being read.
 */
function DelegateModal({
  row,
  recStock,
  recMake,
  canStock,
  canMake,
  defaultDayLabel,
  stations,
  onClose,
  onConfirm,
}) {
  const { item, floor, fromBack, inProduction, scheduled, planned, queuedStock, toMake, refill } = row;

  /* Opens on the route that puts product on the floor SOONEST — stocking
   * where there is anything in the back to carry out, because it happens
   * today and a run does not land until next week. */
  const [how, setHow] = useState(canStock ? "stock" : "make");
  /* Every route has an amount, including the ones the screen would not have
   * suggested. An override with a blank box is not an override; it is a
   * blank box. When the recommendation is zero because the screen believes
   * the gap is already covered, fall back to the honest gap-to-full — which
   * is exactly the number someone overriding is asserting is real. */
  const recFor = (h) =>
    h === "make"
      ? recMake > 0
        ? recMake
        : Math.max(0, Math.round(refill - planned))
      : recStock > 0
        ? recStock
        : Math.max(0, Math.round(refill));
  const [qty, setQty] = useState(String(recFor(canStock ? "stock" : "make")));
  const [station, setStation] = useState(stations[0]);
  const n = Number(qty) || 0;
  const isMake = how === "make";

  /* Recomputed from the typed amount, not the recommendation — the task
   * this creates must describe the trip somebody is actually making. */
  const pull = splitPull(item, Math.min(n, fromBack));
  /* How much of the requested move the records cannot account for. Zero on
   * every normal path; positive only when somebody has overridden the
   * screen's belief about what is in the back. */
  const unrecorded = Math.max(0, Math.round(n - pull.reduce((t, x) => t + x.qty, 0)));

  const pickHow = (next) => {
    setHow(next);
    setQty(String(recFor(next)));
  };

  const minBatch = item.minBatch ?? defaultMinBatch(item.max);

  /* QUICK AMOUNTS — the three or four numbers anybody actually types.
   *
   * The box starts on the recommendation and most of the time that is the
   * answer. The rest of the time the manager is reaching for one of a very
   * small set of round destinations — get it off the floor's minimum, get
   * the case looking full, fill it properly, run one batch — and typing
   * those means doing the subtraction in their head first: max minus what
   * is on the floor minus what is already coming. The screen already knows
   * every one of those numbers.
   *
   * They are DESTINATIONS, not percentages of the amount. "To min" is what
   * it takes to reach the minimum, not 100% of something; "To 80%" is the
   * case at 80% of what it holds, which is the merchandising answer — a
   * case that reads as full from across the shop without being packed to
   * the ceiling.
   *
   * Filtered to what is real: a destination already reached is dropped
   * (nothing to do), and duplicates collapse, so a product whose 80% and
   * full land on the same rounded number offers one chip rather than two
   * that do the same thing. On the make route "One batch" joins them,
   * because the smallest run worth doing is itself a destination. */
  /* MEASURED FROM A DIFFERENT PLACE ON EACH ROUTE, because the two routes
   * do arithmetically different things.
   *
   * MOVING raises the floor by exactly what you carry out, so a destination
   * is measured from the floor: carry 40 and the case has 40 more in it.
   *
   * MAKING adds to the pipeline, and the pipeline already contains stock in
   * the back and batches on the way. Measuring a run from the floor would
   * ask for product that is already coming — which is the exact mistake the
   * recommendation exists to prevent, reintroduced one control to its left.
   *
   * Getting this wrong is not subtle: on a product with 42 in the back and
   * 52 in production, a floor-measured "To full" offered 82 while the hint
   * an inch below said the gap was 30. Two numbers for one question, on one
   * screen, disagreeing. */
  const quickBase = isMake ? floor + fromBack + inProduction + scheduled : floor;
  const QUICK = (() => {
    const out = [];
    const add = (label, value) => {
      const v = Math.max(0, Math.round(value));
      if (v > 0 && !out.some((q) => q.value === v)) out.push({ label, value: v });
    };
    add("To min", item.threshold - quickBase);
    add("To 80%", item.max * 0.8 - quickBase);
    add("To full", item.max - quickBase);
    /* The smallest run worth doing is a destination too — and the only one
     * that survives when everything else is already covered, which is
     * exactly the override case. */
    if (isMake) add("One batch", minBatch);
    return out;
  })();
  const tillMax = Math.max(0, item.max - (floor + fromBack + inProduction + scheduled));
  /* Overshooting the ceiling is the one mistake the recommendation exists
   * to prevent, and it is the one thing the bar cannot show — it clamps at
   * 100%, so past the end there is nothing left to draw. Said in words. */
  const over = Math.max(0, Math.round(n - tillMax));

  /* Both routes are always shown AND always usable; the reason a route is
   * unnecessary is stated, never enforced.
   *
   * This went through three positions. Filtering an unavailable route out
   * was the first and worst — Pork Bellies had 128 lb sitting in the back
   * and offered nothing but a production run, because a stocking task was
   * already open; the screen was right and completely silent, which reads
   * as broken. *A closed door with a reason on it is not clutter; a missing
   * door is.* Then the door was drawn but locked, which was better and
   * still wrong: see the ROUTES comment below for why a derived number does
   * not get the final word over a person who can see the freezer. */
  const stockWhy = canStock
    ? null
    : queuedStock > 0
      ? `${queuedStock} ${item.unit} is already on today's task list`
      : fromBack > 0
        ? "nothing left in the back once what's queued is out"
        : "nothing in the back to put out";
  const makeWhy = canMake
    ? null
    : toMake <= 0
      /* No em-dash inside the reason: the sentence it lands in already has
       * one ("Can't schedule a batch — <reason>."), and two in eight words reads
       * as a stutter rather than an aside. */
      ? "the back already covers the gap"
      : `${Math.round(planned)} ${item.unit} is already booked`;

  /* NEITHER ROUTE IS EVER LOCKED.
   *
   * They used to be `disabled` whenever the screen could not see a reason
   * for them, which quietly made a derived number the final word. It is not.
   * Every figure on this screen is downstream of a count somebody typed into
   * a tablet with cold hands, and the two most common failures in a real
   * shop both point the same way: stock that was pulled and never logged,
   * and a freezer number that has been stale for a week. In both cases the
   * screen says "the back already covers the gap" and the person standing in
   * front of the empty freezer knows better.
   *
   * So the reason stays and the door opens. A recommendation that cannot be
   * overridden is not a recommendation, and a manager who has to go and
   * correct an inventory count before they are allowed to book a batch they
   * already know they need will do neither.
   *
   * What is left is the honest half: the screen still says what it believes
   * and why, right under the control, so an override is a decision taken
   * against a stated reason rather than a click into silence. */
  const ROUTES = [
    { value: "stock", label: "Stock from back" },
    { value: "make", label: "Schedule a batch" },
  ];
  const why = isMake ? makeWhy : stockWhy;

  return (
    <Modal
      open
      icon={isMake ? Factory : Package}
      title={`Delegate ${item.product}`}
      onClose={onClose}
      footer={
        <>
          {/* Ghost, not outlined. Cancel is the one thing in a dialog nobody
           *  needs help finding — Escape and the backdrop both do it — and
           *  giving it a border put it at the same visual weight as the
           *  action it declines. The form archetype this app follows spends
           *  its border budget on the primary and leaves the retreat plain. */}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={n <= 0} onClick={() => onConfirm(how, n, station, pull)}>
            {isMake ? `Schedule ${n} ${item.unit}` : "Add to today's list"}
          </Button>
        </>
      }
    >
      <div className="mt-1">
        <PlanMeter row={row} adding={n} />
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3 tnum">
        {BANDS.map((b) => {
          const value =
            b.key === "floor"
              ? floor
              : b.key === "onhand"
                ? fromBack
                : b.key === "production"
                  ? inProduction
                  : scheduled;
          if (value <= 0) return null;
          return (
            <span key={b.key} className="flex items-center gap-1.5">
              <span className={cx("w-2.5 h-2.5 rounded-full", b.swatch)} />
              {b.label} {Math.round(value)}
            </span>
          );
        })}
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-line border border-line-strong" />
          Till full {Math.round(tillMax)}
        </span>
      </div>

      {/* A stack of labelled fields, one rhythm, one label idiom.
       *
       *  This was seven blocks separated by six different margins
       *  (mt-1, mt-2.5, mt-4, mt-1.5, mt-2.5, mt-4, mt-2), with two
       *  different ways of writing a label — a bare <p> for "How", a
       *  <span> inside a <label> for "Amount" — and prose that drifted
       *  across three ink ranks in three consecutive lines: the
       *  consequence at ink-3, the pull route at ink-2, the
       *  recommendation at ink-4. Ink rank is how this system says what
       *  matters; spent at random it says nothing.
       *
       *  `Field` is the app's own form primitive and the shape the task
       *  form modal already uses: label above, control, hint below in the
       *  light ink. Everything explanatory is now a hint attached to the
       *  control it explains, instead of a paragraph floating between two
       *  controls and belonging to neither. */}
      <div className="mt-4 space-y-4">
        {/* Everything under the chips is one hint, in one order: what this
         *  route does, why the other one is shut, then the trip itself.
         *
         *  They were three separate paragraphs before, and `Field` renders
         *  its hint AFTER its children — so leaving any of them beside the
         *  control put the concrete instruction above the sentence that
         *  frames it, with the light-ink line reading as a footnote to the
         *  dark one instead of to the control. Spans inside the hint keep
         *  the reading order honest (and stay legal inside its <p>). */}
        <Field
          label="How"
          hint={
            <>
              {isMake
                ? `Schedules a batch at a station. Lands ${defaultDayLabel} — today's production belongs to the floor terminal.`
                : "Goes to today's task list, open to anyone on shift. Nothing gets made — this is stock already sitting in the back."}
              {/* Warn ink, not the lightest grey, and it names the screen
               *  as the thing with the opinion — "the screen wouldn't
               *  suggest this" rather than "you can't". The difference is
               *  the whole point: one is a locked door, the other is a
               *  second opinion you are free to overrule, which is the only
               *  honest posture for a number derived from a count somebody
               *  typed on a tablet. */}
              {why && (
                <span className="block mt-1.5 text-warn">
                  The screen wouldn&rsquo;t suggest this — {why}. Go ahead
                  anyway if the counts are off.
                </span>
              )}
              {/* The route, not just the amount. Whoever picks this task up
               *  has to walk somewhere, and "128 lb from the back" does not
               *  say where. The split follows the typed amount, so lowering
               *  it to 60 stops mentioning the freezer at all.
               *
               *  Full ink inside a light-ink block: it is the one line here
               *  that is an instruction to a person rather than an
               *  explanation of a control. */}
              {!isMake && n > 0 && (
                <span className="block mt-1.5 text-ink tnum">
                  {pull.length > 0 && <>Pull {pullSentence(pull, item.unit)}.</>}
                  {/* The override made visible. Ask for 128 when the system
                   *  believes there are 88, and the task should say so — the
                   *  person walking to the freezer is the one who can settle
                   *  it, and sending them with a number the records do not
                   *  support and no warning is how a count stays wrong. */}
                  {unrecorded > 0 && (
                    <span className={pull.length > 0 ? "block mt-1" : undefined}>
                      {unrecorded} {item.unit} more than the count shows — worth a
                      recount while you&rsquo;re back there.
                    </span>
                  )}
                </span>
              )}
            </>
          }
        >
          <Segmented size="sm" value={how} onChange={pickHow} options={ROUTES} />
        </Field>

        <div className="flex items-start gap-4 flex-wrap">
          <Field
            label={`Amount (${item.unit})`}
            hint={
              /* "Recommended" is a lie on an override — the screen's actual
               *  recommendation there is zero, which is what the warn line
               *  above just said. Naming the fallback for what it is keeps
               *  the two lines from contradicting each other one inch
               *  apart. */
              <span className="tnum">
                {why ? "Gap to full" : "Recommended"} {recFor(how)} {item.unit}
                {planned > 0 && ` · ${Math.round(planned)} already committed`}
              </span>
            }
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="w-24 block">
                <Input
                  autoFocus
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="tnum"
                  aria-label={`Amount for ${item.product}`}
                />
              </span>
              {/* Ghost until it matches what is in the box, then the same 5%
               *  tint an active Segmented chip takes. Selected and hovered
               *  are one value in this system, and a chip that lights up
               *  when you have typed its number by hand is the cheapest way
               *  to say "you are at a round place" without printing a
               *  fourth line of grey text under the field. */}
              {QUICK.map((q) => (
                <Button
                  key={q.label}
                  size="sm"
                  variant={n === q.value ? "subtle" : "ghost"}
                  aria-pressed={n === q.value}
                  onClick={() => setQty(String(q.value))}
                >
                  {q.label}
                </Button>
              ))}
            </div>
            {/* Promoted out of the footnote it used to end.
             *
             *  Overshooting the ceiling is the one mistake the
             *  recommendation exists to prevent, and the only one the bar
             *  physically cannot draw — past 100% there is nothing left of
             *  the track. It used to be the last clause of the lightest
             *  grey line in the dialog, which is where this system puts the
             *  things that do not matter. */}
            {over > 0 && (
              <p className="mt-1.5 text-xs font-medium text-warn tnum">
                {over} {item.unit} over max
              </p>
            )}
            {/* The other end of the same guardrail. The screen will not
             *  PROPOSE a batch under this size, but nothing stops you typing
             *  one — and there are good reasons to (a rush order, a gap
             *  before a holiday). Said once, in words, without disabling
             *  anything: the number is a default, not a rule, and the person
             *  overriding it can see what they are overriding. */}
            {isMake && n > 0 && n < minBatch && (
              <p className="mt-1.5 text-xs text-ink-3 tnum">
                Under the {minBatch} {item.unit} smallest batch for this product.
              </p>
            )}
          </Field>

          {isMake && (
            <Field label="Station">
              <Segmented
                size="sm"
                value={station}
                onChange={setStation}
                options={stations.map((st) => ({ value: st, label: st }))}
              />
            </Field>
          )}
        </div>
      </div>
    </Modal>
  );
}

/**
 * Review before a bulk booking.
 *
 * The button that opens this used to BE the booking: one click wrote ten
 * production runs onto real days at a real station, from a control whose
 * whole label was a number. Nothing said what was about to happen, and
 * undoing it meant hunting ten schedule rows by hand.
 *
 * A bulk action is the one place where the cost of a mis-click multiplies
 * by the number of rows, so it is the one place a confirmation reliably
 * earns its keep — and this is a confirmation that shows the work rather
 * than asking "are you sure?", which is a question nobody can answer
 * without the list in front of them.
 *
 * Rows start checked, because the recommendation IS the proposal and the
 * fast path should still be two clicks. Unchecking is for the one product
 * the manager knows something the screen doesn't about — which is most of
 * why a bulk action felt risky in the first place: not that it did the
 * wrong arithmetic, but that it left no room to disagree with one line of
 * it.
 */
function BulkBookModal({ tasks, dayLabel, stations, onClose, onConfirm }) {
  const [dropped, setDropped] = useState(() => new Set());
  const [station, setStation] = useState(stations[0]);

  const toggle = (product) =>
    setDropped((prev) => {
      const next = new Set(prev);
      if (next.has(product)) next.delete(product);
      else next.add(product);
      return next;
    });

  const chosen = tasks.filter((t) => !dropped.has(t.product));
  const total = chosen.reduce((n, t) => n + t.qty, 0);
  const unit = tasks[0]?.unit || "lb";

  return (
    <Modal
      open
      size="lg"
      icon={CalendarPlus}
      title="Schedule these batches"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={chosen.length === 0}
            onClick={() => onConfirm(chosen.map((t) => ({ ...t, station })))}
          >
            Schedule {chosen.length} {chosen.length === 1 ? "batch" : "batches"}
          </Button>
        </>
      }
    >
      <p className="text-xs text-ink-3">
        Every product that still needs a batch, at its recommended amount. All
        of these land {dayLabel} — today&rsquo;s production belongs to the
        floor terminal.
      </p>

      {/* One station for the batch. Per-run stations belong in the row's own
       *  Delegate modal; asking for twelve of them here would make the fast
       *  path slower than doing it one at a time, which is the only reason
       *  this screen exists.
       *
       *  Label above, not beside, and no track around the chips — the same
       *  `Field` + bare `Segmented` shape as every other form in the app.
       *  It was an inline label next to a bordered chip group, which meant
       *  this one control disagreed with the Delegate modal's identical
       *  control on both counts at once. */}
      <Field label="Station" className="mt-3">
        <Segmented
          size="sm"
          value={station}
          onChange={setStation}
          options={stations.map((st) => ({ value: st, label: st }))}
        />
      </Field>

      <ul className="mt-3 border-y border-line divide-y divide-line max-h-[45vh] overflow-y-auto">
        {tasks.map((t) => {
          const on = !dropped.has(t.product);
          return (
            <li key={t.product}>
              {/* The whole row toggles, and the box is a drawing.
               *
               *  This was a native <input type="checkbox" accent-ink>
               *  inside a <label>. It behaved correctly — the label made
               *  the row clickable — but it rendered as a column of ten
               *  20px square-cornered near-black blocks, which was the
               *  heaviest ink in the dialog and outweighed the product
               *  names it was there to qualify. A control that shouts
               *  louder than its own subject has its rank backwards.
               *
               *  So: a 16px rounded span, aria-hidden, no handler of its
               *  own, and the click on the row. That is this app's task-row
               *  contract, and it is the same one for the same reason —
               *  a user aiming carefully at the box and a user tapping
               *  anywhere on the line get the identical result.
               *
               *  Filled with ink rather than the accent: selection is not
               *  an accent in this system, identity and state are ink. Ten
               *  blue squares here would spend the screen's whole colour
               *  budget on "yes, still checked". */}
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(t.product)}
                className={cx(
                  "w-full flex items-center gap-2.5 px-1 py-2 rounded-md text-left",
                  "transition-colors duration-100 hover:bg-faint",
                  !on && "opacity-45",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    "shrink-0 flex items-center justify-center w-4 h-4 rounded border",
                    "transition-colors duration-100",
                    on
                      ? "border-ink bg-ink text-white"
                      : "border-line-strong text-transparent",
                  )}
                >
                  <Check size={10} strokeWidth={3} />
                </span>
                <span className="flex-1 min-w-0 truncate text-sm text-ink">
                  {t.product}
                </span>
                <span className="shrink-0 text-sm text-ink tnum">
                  {t.qty} {t.unit}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-xs text-ink-4 tnum">
        {Math.round(total)} {unit} across {chosen.length}{" "}
        {chosen.length === 1 ? "batch" : "batches"}
        {dropped.size > 0 && ` · ${dropped.size} skipped`}
      </p>
    </Modal>
  );
}

/* Mutually exclusive, so the counts add up to the catalogue. "Under min"
 * deliberately excludes the empty ones — those are their own bucket. */
const RANGE_FILTERS = [
  { id: "all", label: "All", match: () => true },
  { id: "out", label: "Out", match: (i) => stockIn(i, "floor") <= 0 },
  {
    id: "under",
    label: "Under min",
    match: (i) => stockIn(i, "floor") > 0 && stockIn(i, "floor") < i.threshold,
  },
  {
    id: "in",
    label: "In range",
    match: (i) => stockIn(i, "floor") >= i.threshold && stockIn(i, "floor") < i.max,
  },
  { id: "over", label: "At max", match: (i) => stockIn(i, "floor") >= i.max },
];

/** Which value each sortable column reads off a product. */
const RANGE_COLUMNS = {
  product: (i) => i.product,
  floor: (i) => stockIn(i, "floor"),
  min: (i) => i.threshold,
  max: (i) => i.max,
  batch: (i) => i.minBatch ?? defaultMinBatch(i.max),
};

function RangesModal({ inventory, onSetRange, onClose }) {
  const [q, setQ] = useState("");
  /* Alphabetical to start — the list is for finding a known product. Clicking
   * a number column starts DESCENDING, because the reason to sort by "on
   * floor" or "min" is almost always to see the extremes first, and making
   * someone click twice to get there is a small tax paid every time. */
  const [sort, setSort] = useState({ key: "product", dir: "asc" });
  const [filter, setFilter] = useState("all");

  const onSort = (key) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "product" ? "asc" : "desc" },
    );

  const searched = inventory
    .map(normalizeItem)
    .filter((i) => i.product.toLowerCase().includes(q.trim().toLowerCase()));

  /* Counts come off the searched set, not the whole catalogue, so a filter
   * chip never promises rows the search has already excluded. */
  const counts = Object.fromEntries(
    RANGE_FILTERS.map((f) => [f.id, searched.filter(f.match).length]),
  );
  const active = RANGE_FILTERS.find((f) => f.id === filter) || RANGE_FILTERS[0];

  const items = searched
    .filter(active.match)
    .sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      const read = RANGE_COLUMNS[sort.key] || RANGE_COLUMNS.product;
      const va = read(a);
      const vb = read(b);
      const cmp =
        typeof va === "string" ? va.localeCompare(vb) : va - vb;
      // Product name as the tiebreak, so equal numbers never reshuffle.
      return dir * cmp || a.product.localeCompare(b.product);
    });

  return (
    <Modal
      open
      size="lg"
      icon={SlidersHorizontal}
      title="Levels by product"
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Find a product…"
      />

      <div className="mt-2.5">
        <Segmented
          fade
          size="sm"
          value={filter}
          onChange={setFilter}
          options={RANGE_FILTERS.map((f) => ({
            value: f.id,
            label: f.label,
            count: f.id === "all" ? undefined : counts[f.id] || undefined,
          }))}
        />
      </div>

      <div className="mt-3 flex items-center gap-2 px-1">
        <SortHeader label="Product" col="product" sort={sort} onSort={onSort} className="flex-1 justify-start" />
        <SortHeader label="On floor" col="floor" sort={sort} onSort={onSort} className="w-16 justify-end" />
        <SortHeader label="Min" col="min" sort={sort} onSort={onSort} className="w-16 justify-center" />
        <SortHeader label="Max" col="max" sort={sort} onSort={onSort} className="w-16 justify-center" />
        {/* The knob behind the whole "fine" idea, sitting with the other two
         *  settings rather than in a screen of its own. Min says when to
         *  start, max says where to stop, min batch says whether the job is
         *  big enough to be worth doing at all — three numbers, one place. */}
        <SortHeader label="Min batch" col="batch" sort={sort} onSort={onSort} className="w-20 justify-center" />
      </div>

      <div className="mt-1 border-y border-line max-h-[50vh] overflow-y-auto">
        {items.length === 0 ? (
          /* Left, not centred, and one ink step up from the lightest.
           *
           *  Centring is the one alignment this design system does not
           *  have — every block on every screen starts at the same left
           *  edge, and a centred line here broke that for the one moment
           *  the list has nothing else in it. It was also ink-4, the
           *  lightest grey available, which is the rank reserved for
           *  footnotes beside real content; when it IS the content, it
           *  reads as disabled. */
          <p className="px-1 py-6 text-xs text-ink-3">
            {q ? `No product matches “${q}”.` : "Nothing in this state."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <RangeRow key={item.product} item={item} onSetRange={onSetRange} />
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function SortHeader({ label, col, sort, onSort, className }) {
  const active = sort.key === col;
  const Icon = sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cx(
        "flex items-center gap-1 shrink-0 text-xs font-medium transition-colors",
        active ? "text-ink" : "text-ink-3 hover:text-ink",
        className,
      )}
    >
      {label}
      {/* Only the active column shows a direction — an arrow on every header
       *  reads as decoration and stops meaning anything. */}
      {active && <Icon size={11} className="shrink-0" />}
    </button>
  );
}

function RangeRow({ item, onSetRange }) {
  const [min, setMin] = useState(String(item.threshold));
  const [max, setMax] = useState(String(item.max));
  const [batch, setBatch] = useState(
    String(item.minBatch ?? defaultMinBatch(item.max)),
  );
  const floor = stockIn(item, "floor");

  const commit = () => {
    const t = Number(min) || 0;
    const m = Number(max) || 0;
    const b = Number(batch) || 0;
    const was = item.minBatch ?? defaultMinBatch(item.max);
    if (t === item.threshold && m === item.max && b === was) return;
    onSetRange(item.product, { threshold: t, max: m, minBatch: b });
  };
  const onKey = (e) => {
    if (e.key === "Enter") e.currentTarget.blur();
  };

  return (
    /* py-1, not py-1.5: with a 28px input inside, 1.5 made a 40px row
     * against 14px text — a ratio of 2.9, outside the 2.0–2.7 band this
     * app's lists sit in, and visibly looser than the run list in the
     * Book-these-runs dialog next door. py-1 lands both at 36px. */
    <li className="flex items-center gap-2 px-1 py-1">
      <span className="flex-1 min-w-0 truncate text-sm text-ink">{item.product}</span>
      <span
        className={cx(
          "w-16 text-right shrink-0 text-xs tnum",
          floor <= 0
            ? "text-danger font-semibold"
            : floor < item.threshold
              ? "text-warn font-medium"
              : "text-ink-4",
        )}
      >
        {floor}
      </span>
      <span className="w-16 shrink-0">
        <Input
          type="number"
          value={min}
          onChange={(e) => setMin(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
          className="tnum"
          aria-label={`Minimum for ${item.product}`}
        />
      </span>
      <span className="w-16 shrink-0">
        <Input
          type="number"
          value={max}
          onChange={(e) => setMax(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
          className="tnum"
          aria-label={`Maximum for ${item.product}`}
        />
      </span>
      <span className="w-20 shrink-0">
        <Input
          type="number"
          value={batch}
          onChange={(e) => setBatch(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
          className="tnum"
          aria-label={`Smallest batch worth running for ${item.product}`}
        />
      </span>
    </li>
  );
}
