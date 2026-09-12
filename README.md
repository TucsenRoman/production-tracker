# ProTrack — Milaca Meats production tracker

Two apps in one Next.js project, sharing a domain model and a UI kit:

- **Shop floor** (`/`) — a tablet terminal for the production floor: batches moving through stations, inventory in three states (made / freezer / floor), the day's task list, and a settings tab for the shop the tablet is set to. No sign-in; gated actions ask for a manager PIN at the moment they happen.
- **Company console** (`/company/milaca-meats`) — the office side: insights, production targets, assignments, inventory, team, permissions, locations and stations. Simulated account sign-in with an account switcher for demos.

Both run against `localStorage` (one namespace each), and stay in sync across tabs through the `storage` event — the console plans, the floor runs.

## Layout

```
app/
  page.tsx / layout.tsx / globals.css     root route (floor, inside an iPad mock), theme tokens
  api/inventory, api/sales                Clover proxy routes (server only)
  lib/                                    SHARED: domain.js (model + seed), persistence.js
                                          (localStorage hook factory), stations.jsx, clover.ts
  components/                             SHARED UI: ui.jsx (the design-system primitives),
                                          AppShell.jsx (rail/tabs chrome), TabletFrame.jsx
  floor/                                  the tablet app
    ProductionTracker.jsx                 state + handlers, wires the screens
    screens/                              Batches, Inventory, Tasks, Settings
    components/                           ItemModal, LocationSetting
    lib/                                  store (floor namespace), approval (PIN gate),
                                          companyRoster / sharedStations / deviceLocation
                                          (the floor's read-only windows onto console state)
  company/                                the console
    page.tsx, milaca-meats/page.tsx, help/ routes
    CompanyConsole.jsx                    state + handlers, wires the screens
    screens/  components/  lib/           console screens, chrome + modals, domain/store/nav
```

The floor's `TasksScreen` is also embedded in the console as "Assignments".

## Running

```bash
npm install
npm run dev
```

Create `.env.local` in the project root:

```
CLOVER_ENV=sandbox            # or production
CLOVER_MERCHANT_ID=...
CLOVER_API_TOKEN=...
NEXT_PUBLIC_PERSIST=on        # "off" disables localStorage so every refresh re-seeds
```

Without Clover credentials the floor falls back to the seeded catalogue and shows Clover as unreachable.

`npm run build` and `npm run lint` are the checks.

## Demo accounts

Sign in on the console as any seeded user (no password). Floor PINs for approvals: Dana `1357`, Maria `2468`. The console's account menu has a "Two locations" toggle that folds a second shop into the demo at runtime.
