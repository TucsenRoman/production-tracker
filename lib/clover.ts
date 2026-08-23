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
