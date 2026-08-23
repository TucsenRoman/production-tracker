"use client";

/**
 * Enterprise/company domain model.
 *
 * This is the account layer that sits above a shop floor: a company owns one
 * or more locations, a roster of admin/manager users (distinct from the PIN-
 * based shop-floor staff), and the integrations each location connects to
 * its POS. Kept in its own module — separate from ../../lib/domain.js — so
 * the shop-floor terminal and the admin console can evolve independently.
 */

import { Boxes, ShoppingBag, Store } from "lucide-react";

export const ROLES = ["owner", "admin", "manager", "staff"];

export const ROLE_LABEL = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
};

/** Owner is the only role that can't be changed or removed by another admin. */
export const ROLE_LOCKED = { owner: true };

export const PROVIDERS = [
  { id: "clover", name: "Clover", icon: Store, available: true, blurb: "POS + inventory sync" },
  { id: "square", name: "Square", icon: ShoppingBag, available: false, blurb: "POS + payments" },
  { id: "toast", name: "Toast", icon: Boxes, available: false, blurb: "POS for restaurants" },
];

let idCounter = 0;
export function newCompanyId(prefix) {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36).slice(-4)}${idCounter.toString(36)}`.toUpperCase();
}

/** Loose but real-looking validation — enough to catch obvious typos in a demo. */
export const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

export function maskKey(value) {
  if (!value) return "";
  const s = String(value);
  if (s.length <= 4) return "••••";
  return `•••• •••• ${s.slice(-4)}`;
}

/* ------------------------------------------------------------ Seed state -- */

export const COMPANY_SEED = {
  company: {
    name: "Milaca Meats",
    plan: "Enterprise",
    ownerEmail: "dana@milacameats.com",
    createdAt: "2024-03-12T00:00:00.000Z",
  },

  locations: [
    {
      id: "LOC-1",
      name: "Milaca Meats — Main St",
      address: "412 1st Ave SE, Milaca, MN 56353",
      timezone: "America/Chicago",
    },
    {
      id: "LOC-2",
      name: "Milaca Meats — Foreston Depot",
      address: "88 Depot Rd, Foreston, MN 56330",
      timezone: "America/Chicago",
    },
  ],

  users: [
    {
      id: "U-1",
      name: "Dana Whitfield",
      email: "dana@milacameats.com",
      role: "owner",
      locationIds: ["LOC-1", "LOC-2"],
      status: "active",
      invitedAt: "2024-03-12T00:00:00.000Z",
    },
    {
      id: "U-2",
      name: "Maria Ruiz",
      email: "maria.ruiz@milacameats.com",
      role: "admin",
      locationIds: ["LOC-1", "LOC-2"],
      status: "active",
      invitedAt: "2024-04-02T00:00:00.000Z",
    },
    {
      id: "U-3",
      name: "Sam Whitfield",
      email: "sam@milacameats.com",
      role: "manager",
      locationIds: ["LOC-1"],
      status: "active",
      invitedAt: "2024-06-18T00:00:00.000Z",
    },
    {
      id: "U-4",
      name: "Tyler Boyd",
      email: "tyler.boyd@milacameats.com",
      role: "manager",
      locationIds: ["LOC-2"],
      status: "active",
      invitedAt: "2025-01-09T00:00:00.000Z",
    },
    {
      id: "U-5",
      name: "Priya Anand",
      email: "priya.anand@milacameats.com",
      role: "staff",
      locationIds: ["LOC-1"],
      status: "invited",
      invitedAt: "2026-08-18T00:00:00.000Z",
    },
  ],

  integrations: [
    {
      id: "INT-1",
      locationId: "LOC-1",
      provider: "clover",
      status: "connected",
      merchantId: "MC3819204471",
      apiKey: "clv_live_9f2a7c4e1b8d6053",
      lastSynced: "2026-08-23T13:40:00.000Z",
    },
    {
      id: "INT-2",
      locationId: "LOC-2",
      provider: "clover",
      status: "disconnected",
      merchantId: "",
      apiKey: "",
      lastSynced: null,
    },
  ],
};
