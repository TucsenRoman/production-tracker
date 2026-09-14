"use client";

import type { ClassValue } from "./types";

export const cx = (...parts: ClassValue[]): string =>
  parts.filter(Boolean).join(" ");
