/** Paste the Cloudflare Worker URL here, without a trailing slash. */
export const WORKER_URL = "";

export type ItemStatus = "added" | "skipped" | "failed";

export type AddResult = {
  authFailed: boolean;
  cartFull: boolean;
  results: { sku: string; status: ItemStatus; message?: string }[];
  error?: string;
};

export async function addBatch(input: { token: string; region: string; skus: string[] }): Promise<AddResult> {
  const base = WORKER_URL.trim().replace(/\/$/, "");
  if (!base) throw new Error("not_configured");
  const response = await fetch(`${base}/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ token: input.token, region: input.region, skus: input.skus.slice(0, 4) }),
  });
  let payload: AddResult | null = null;
  try {
    payload = (await response.json()) as AddResult;
  } catch {
    payload = null;
  }
  if (!response.ok || !payload || !Array.isArray(payload.results)) {
    throw new Error(payload?.error || "request_failed");
  }
  return {
    authFailed: Boolean(payload.authFailed),
    cartFull: Boolean(payload.cartFull),
    results: payload.results,
  };
}

const CLIENT = "49f17b2f-bd8d-424b-bf5e-43786fb33be5";

export function checkoutUrl(sku: string): string {
  return `https://checkout.playstation.com/add/${encodeURIComponent(sku)}?clientId=${CLIENT}`;
}
