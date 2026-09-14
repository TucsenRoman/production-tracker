"use client";

/**
 * UI primitives.
 *
 * One module per component family; this file is the public surface. Import
 * from `components/ui` — never from a file inside this folder — so a component
 * can be split or renamed without touching a screen.
 *
 * Every surface in the product is composed from these — screens never reach for
 * raw colour or spacing utilities. Variants are plain objects rather than a
 * class-variance library so there's no dependency to keep in step.
 */

export { cx } from "./cx";
export { scrollAppToTop, scrollAppToToolbar } from "./scroll";
export { SlotProvider, SlotTarget, Slot } from "./Slot";
export { Button, IconButton } from "./Button";
export { Card } from "./Card";
export { StickyFadeHeader } from "./StickyFadeHeader";
export { ScreenToolbar } from "./ScreenToolbar";
export { SectionHeading } from "./SectionHeading";
export { RowActions } from "./RowActions";
export { Badge } from "./Badge";
export { MetaRow } from "./MetaRow";
export { Label, Field } from "./Field";
export { Input, PinInput } from "./Input";
export { SearchInput } from "./SearchInput";
export { Tooltip } from "./Tooltip";
export { Dropdown } from "./Dropdown";
export { Popover } from "./Popover";
export { ScrollArea } from "./ScrollArea";
export { TabDot, Segmented } from "./Segmented";
export { Switch } from "./Switch";
export { StatCard, StatGrid } from "./StatCard";
export { ProgressBar } from "./ProgressBar";
export { EmptyState } from "./EmptyState";
export { SkeletonRows } from "./Skeleton";
export { Modal } from "./Modal";
export { useToast, ToastProvider } from "./Toast";
