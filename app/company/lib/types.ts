/**
 * The shapes the console's state is made of.
 *
 * Written while converting the FLOOR, which reads console state directly
 * (`companyStore`, `companyDomain`, `actionAccess`) — see the cross-dependency
 * note in the reorg. The console's own modules are still JavaScript; when they
 * convert, they should import from here rather than redeclaring these.
 *
 * No "use client": types only, erased at build.
 */

export type CompanyRole = "admin" | "manager";

/** A person with a console record. Crew never sign in and have none. */
export interface CompanyPerson {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: CompanyRole;
  locationIds: string[];
  status: string;
  invitedAt?: string;
  /** Issued by an admin; the floor's approval dialog matches against it. */
  pin?: string | null;
}

export interface DayHours {
  open: string;
  close: string;
}

/** Seven entries, index 0 is Sunday. `null` is closed that day. */
export type WeekHours = (DayHours | null)[];

export interface CompanyLocation {
  id: string;
  name: string;
  address?: string;
  timezone?: string;
  photoUrl?: string | null;
  hours?: WeekHours;
}

/** An action that may require a manager to stand behind it. */
export interface GatedAction {
  id: string;
  label: string;
  detail: string;
  defaultRequiresLead: boolean;
  /** Gated by definition: only the named people may approve it. */
  targeted?: boolean;
  accessUserIds?: string[];
}

/** action id → does it require an approval. */
export type Permissions = Record<string, boolean>;

/** action id → the people named on it. */
export type ActionAccess = Record<string, string[]>;

export interface CompanySession {
  userId: string;
  email: string;
}
