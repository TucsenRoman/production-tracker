"use client";

import { Search, X } from "lucide-react";
import { cx } from "./cx";
import { IconButton } from "./Button";

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  pill = false,
  className,
}) {
  return (
    <div
      className={cx(
        "flex items-center gap-2 h-[var(--ctl-h)] bg-surface border border-line-strong",
        // Focus ring on the whole pill (input's own ring is off) so a focused
        // search field stays one shape.
        "focus-within:border-primary focus-within:shadow-[0_0_0_2px_var(--color-canvas),0_0_0_4px_var(--color-primary)]",
        "transition-colors duration-100",
        pill ? "rounded-full px-3" : "rounded-md px-2.5",
        className,
      )}
    >
      <Search size={14} className="text-icon-2 shrink-0" />
      {/* type="text", not "search": browsers draw their own cancel glyph on a
          search input, on top of the clear button below. */}
      <input
        type="text"
        inputMode="search"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 h-full bg-transparent border-0 outline-none focus-visible:shadow-none text-sm text-ink placeholder:text-ink-4 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <IconButton
          label="Clear search"
          icon={X}
          size={13}
          onClick={() => onChange("")}
          className="w-5 h-5 shrink-0"
        />
      )}
    </div>
  );
}
