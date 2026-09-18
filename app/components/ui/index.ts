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

export type { ClassValue, IconComponent } from "./types";

export { cx } from "./cx";
export { scrollAppToTop, scrollAppToToolbar } from "./scroll";
export { SlotProvider, SlotTarget, Slot } from "./Slot";
export { Button, IconButton } from "./Button";
export type {
  ButtonProps,
  ButtonSize,
  ButtonVariant,
  IconButtonProps,
} from "./Button";
export { Card } from "./Card";
export type { CardProps } from "./Card";
export { StickyFadeHeader } from "./StickyFadeHeader";
export type { StickyFadeHeaderProps } from "./StickyFadeHeader";
export { ScreenToolbar } from "./ScreenToolbar";
export type { ScreenToolbarProps } from "./ScreenToolbar";
export { SectionHeading } from "./SectionHeading";
export type { SectionHeadingProps } from "./SectionHeading";
export { RowActions } from "./RowActions";
export type { RowActionsProps } from "./RowActions";
export { Badge } from "./Badge";
export type { BadgeProps, BadgeTone } from "./Badge";
export { MetaRow } from "./MetaRow";
export { Label, Field } from "./Field";
export type { FieldProps, LabelProps } from "./Field";
export { Input, PinInput } from "./Input";
export type { InputProps, PinInputProps } from "./Input";
export { SearchInput } from "./SearchInput";
export type { SearchInputProps } from "./SearchInput";
export { Tooltip } from "./Tooltip";
export type { TooltipProps, TooltipSide } from "./Tooltip";
export { Dropdown } from "./Dropdown";
export type {
  DropdownMultipleProps,
  DropdownOption,
  DropdownProps,
  DropdownSingleProps,
} from "./Dropdown";
export { Popover } from "./Popover";
export type { PopoverProps } from "./Popover";
export { ScrollArea } from "./ScrollArea";
export type { ScrollAreaProps } from "./ScrollArea";
export { Pill } from "./Pill";
export type { PillOption, PillProps, PillTone, PillVariant } from "./Pill";
export { TabDot, Segmented } from "./Segmented";
export type {
  SegmentedOption,
  SegmentedProps,
  TabDotProps,
  TabDotVariant,
} from "./Segmented";
export { Switch } from "./Switch";
export type { SwitchProps } from "./Switch";
export { StatCard, StatGrid } from "./StatCard";
export type { StatCardProps, StatTone } from "./StatCard";
export { ProgressBar } from "./ProgressBar";
export type { ProgressBarProps, ProgressTone } from "./ProgressBar";
export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";
export { SkeletonRows } from "./Skeleton";
export type { SkeletonRowsProps } from "./Skeleton";
export { Modal } from "./Modal";
export type { ModalProps, ModalSize } from "./Modal";
export { useToast, ToastProvider } from "./Toast";
export type { ToastFn, ToastOptions, ToastTone } from "./Toast";
