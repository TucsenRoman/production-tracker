"use client";

import { Search, X } from "lucide-react";
import { cx } from "./cx";
import { IconButton } from "./Button";
import type { IconComponent } from "./types";

export interface SearchInputProps {
  value: string;
  /** Receives the string, not the event — every call site wants the string. */
  onChange: (value: string) => void;
  placeholder?: string;
  /** Swap the glyph when the field is not literally a search — the console's
   *  assistant trigger wears this shell and keeps its own mark. */
  icon?: IconComponent;
  /** A field that opens something else instead of taking the keystroke.
   *  `onFocus` fires and focus moves on; nothing is ever typed and lost. */
  readOnly?: boolean;
  onFocus?: () => void;
  "aria-label"?: string;
  pill?: boolean;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  icon: Icon = Search,
  readOnly = false,
  onFocus,
  "aria-label": ariaLabel,
  pill = false,
  className,
}: SearchInputProps) {
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
      <Icon size={14} className="text-icon-2 shrink-0" />
      {/* type="text", not "search": browsers draw their own cancel glyph on a
          search input, on top of the clear button below. */}
      <input
        type="text"
        inputMode="search"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        readOnly={readOnly}
        aria-label={ariaLabel}
        placeholder={placeholder}
        className="flex-1 min-w-0 h-full bg-transparent border-0 outline-none focus-visible:shadow-none text-sm text-ink placeholder:text-ink-4 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && !readOnly && (
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
