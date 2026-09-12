// Minimal Clover REST API client for fetching merchant inventory.
// Docs: https://docs.clover.com/dev/reference/inventory-getitems

export type CloverItem = {
  id: string;
  name: string;
  price: number; // in cents, per Clover convention
  priceType?: string;
  sku?: string;
  code?: string;
  hidden?: boolean;
  stockCount?: number | null;
};

type CloverItemsResponse = {
  elements: Array<{
    id: string;
    name: string;
    price: number;
    priceType?: string;
    sku?: string;
    code?: string;
    hidden?: boolean;
    itemStock?: {
      quantity?: number;
    };
  }>;
};

function getBaseUrl(): string {
  const env = process.env.CLOVER_ENV ?? "sandbox";
  return env === "production"
    ? "https://api.clover.com"
    : "https://sandbox.dev.clover.com";
}

function getCredentials() {
  const merchantId = process.env.CLOVER_MERCHANT_ID;
  const apiToken = process.env.CLOVER_API_TOKEN;

  if (!merchantId || !apiToken) {
    throw new Error(
      "Missing CLOVER_MERCHANT_ID or CLOVER_API_TOKEN environment variables. " +
        "Copy .env.local.example to .env.local and fill in your sandbox credentials."
    );
  }

  return { merchantId, apiToken };
}

export async function fetchInventory(): Promise<CloverItem[]> {
  const { merchantId, apiToken } = getCredentials();
  const baseUrl = getBaseUrl();

  // expand=itemStock pulls stock counts alongside each item in one call
  const url = `${baseUrl}/v3/merchants/${merchantId}/items?expand=itemStock&limit=100`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: "application/json",
    },
    // Inventory changes fairly often; avoid stale caching in dev.
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Clover API request failed (${res.status} ${res.statusText}): ${body}`
    );
  }

  const data = (await res.json()) as CloverItemsResponse;

  return (data.elements ?? []).map((el) => ({
    id: el.id,
    name: el.name,
    price: el.price,
    priceType: el.priceType,
    sku: el.sku,
    code: el.code,
    hidden: el.hidden,
    stockCount: el.itemStock?.quantity ?? null,
  }));
}

/* --------------------------------------------------------------- Velocity -- */

export type Velocity = {
  /** Average units (or lb, for weighed items) sold per day, keyed by item name. */
  perDay: Record<string, number>;
  days: number;
  from: string;
};

type CloverOrdersResponse = {
  elements: Array<{
    id: string;
    createdTime?: number;
    state?: string;
    lineItems?: {
      elements?: Array<{
        name?: string;
        // Clover sends `unitQty` in thousandths for weighed items, and a plain
        // integer `quantity` for counted ones. Bacon is sold by the pound, so
        // the weighed path is the one that matters here.
        unitQty?: number | null;
        quantity?: number | null;
        availableCount?: number | null;
      }>;
    };
  }>;
};

/**
 * Recent sales pace per item, used for days-of-cover.
 *
 * Returns an empty map rather than throwing when the merchant has no order
 * history — a sandbox usually doesn't, and a missing cover figure degrades to a
 * blank in the UI instead of taking the whole inventory screen down with it.
 */
export async function fetchVelocity(days = 28): Promise<Velocity> {
  const { merchantId, apiToken } = getCredentials();
  const baseUrl = getBaseUrl();

  const since = Date.now() - days * 86_400_000;
  const filter = encodeURIComponent(`createdTime>=${since}`);
  const url =
    `${baseUrl}/v3/merchants/${merchantId}/orders` +
    `?expand=lineItems&filter=${filter}&limit=1000`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiToken}`, Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Clover orders request failed (${res.status} ${res.statusText}): ${body}`
    );
  }

  const data = (await res.json()) as CloverOrdersResponse;
  const totals: Record<string, number> = {};

  for (const order of data.elements ?? []) {
    if (order.state === "open") continue; // not yet a sale
    for (const li of order.lineItems?.elements ?? []) {
      if (!li.name) continue;
      const qty = li.unitQty != null ? li.unitQty / 1000 : (li.quantity ?? 1);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      totals[li.name] = (totals[li.name] ?? 0) + qty;
    }
  }

  const perDay: Record<string, number> = {};
  for (const [name, total] of Object.entries(totals)) {
    perDay[name] = +(total / days).toFixed(3);
  }

  return { perDay, days, from: new Date(since).toISOString() };
}
