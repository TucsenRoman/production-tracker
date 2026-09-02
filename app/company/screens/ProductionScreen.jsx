"use client";

import React, { useState } from "react";

import { DayStrip, PlanningPane } from "../../screens/BoardScreen";
import { weekOf } from "../../lib/domain";

/**
 * Console-side production planning — reuses the floor app's own day-strip
 * and planning-pane (BoardScreen.jsx) so a floor manager gets the same
 * authoring experience from a keyboard instead of the tablet. Always
 * planning mode, even when today is selected: this screen never renders
 * (or affects) the live board of batches moving through the shop right
 * now — that stays a floor-terminal-only view. The onAdd/onRemove handlers
 * wired up in CompanyConsole.jsx write to `schedule` only and deliberately
 * never spawn a batch, unlike the floor terminal's own handleAddTask.
 *
 * Fast mockup against the existing single-location demo data: this shares
 * the same `schedule`/`inventory` the floor terminal reads and writes, so
 * a plan added here is waiting on the terminal too. Not location-scoped
 * yet — schedule has no per-location split, same as the floor app itself.
 */
export default function ProductionScreen({ schedule, inventory, today, onAddTask, onRemoveTask }) {
  const days = weekOf(today);
  const [selectedDay, setSelectedDay] = useState(today);
  const dayInfo = days.find((d) => d.key === selectedDay) || days[0];

  return (
    <div className="space-y-5">
      <DayStrip days={days} selected={selectedDay} onSelect={setSelectedDay} />
      <PlanningPane
        day={dayInfo}
        schedule={schedule}
        inventory={inventory}
        onAdd={(station, product, qty) => onAddTask(selectedDay, station, product, qty)}
        onRemove={(station, id) => onRemoveTask(selectedDay, station, id)}
      />
    </div>
  );
}
