/**
 * consolecheat free-games cart proxy.
 * Cloudflare dashboard → Workers → Edit code → paste → deploy.
 *
 * POST /add  { token, region, skus }   max 4 SKUs
 * The cookie is never logged or stored.
 */
const ADD_HASH = "93eb198753e06cba3a30ed3a6cd3abc1f1214c11031ffc5b0a5ca6d08c77061f";
const ENDPOINT = "https://web.np.playstation.com/api/graphql/v1/op";
const CATALOGS = [
  "https://free.consolecheat.com/public/data/games/",
  "https://free.consolecheat.com/data/games/",
];
const ALLOWED = new Set([
  "https://free.consolecheat.com",
  "https://robfreak.github.io",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);
const MAX_SKUS = 4;
const PAUSE_MS = 280;
const skuCache = new Map();

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (ALLOWED.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) },
  });
}

function emptyResult(error) {
  return { authFailed: false, cartFull: false, results: [], error };
}

function extractToken(raw) {
  const trimmed = String(raw ?? "").trim();
  const match = trimmed.match(/pdccws_p=([^;\s]+)/i);
  let value = match ? match[1] : trimmed;
  try {
    value = decodeURIComponent(value);
  } catch {
    /* keep */
  }
  value = value.trim();
  if (value.length < 20 || value.length > 4000 || /[\s;]/.test(value)) return null;
  return value;
}

function scrub(message, token) {
  return String(message ?? "").split(token).join("••••").slice(0, 180);
}

function classify(message) {
  const text = message.toLowerCase();
  if (text.includes("access denied") || text.includes("authorized") || text.includes("unauthor") || text.includes("not signed") || text.includes("login") || text.includes("session")) return "auth";
  if (text.includes("maximum") || text.includes("too many") || text.includes("cart is full") || text.includes("limit of") || (text.includes("cart") && text.includes("full"))) return "full";
  if (text.includes("already") || text.includes("owned") || text.includes("duplicate") || text.includes("in your cart") || text.includes("entitlement")) return "skipped";
  return "failed";
}

async function catalogSkus(region) {
  const cached = skuCache.get(region);
  if (cached) return cached;
  for (const base of CATALOGS) {
    try {
      const response = await fetch(`${base}${region}.json`, { headers: { Accept: "application/json" } });
      if (!response.ok) continue;
      const raw = await response.json();
      const skus = new Set();
      if (Array.isArray(raw)) {
        for (const row of raw) if (Array.isArray(row) && typeof row[0] === "string") skus.add(row[0]);
      }
      if (skus.size) {
        skuCache.set(region, skus);
        return skus;
      }
    } catch {
      /* try the next catalog host */
    }
  }
  return null;
}

async function postAdd(token, sku) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Origin: "https://checkout.playstation.com",
      Referer: "https://checkout.playstation.com/cart",
      "User-Agent": "Mozilla/5.0",
      "apollographql-client-name": "web-checkout",
      "apollographql-client-version": "1.0.0",
      "x-psn-storefront-type": "checkout:standalone",
      Cookie: `pdccws_p=${token}; isSignedIn=true`,
    },
    body: JSON.stringify({
      operationName: "addToCart",
      variables: { skus: [{ skuId: sku }] },
      extensions: { persistedQuery: { version: 1, sha256Hash: ADD_HASH } },
    }),
  });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = null; }
  return { status: response.status, text, json: body };
}

function succeeded(payload) {
  if (payload.json?.errors?.length) return false;
  if (payload.text.includes("subTotalPrice")) return true;
  return Boolean(payload.json?.data?.webCheckoutCartAdd);
}

function failureMessage(payload) {
  const fromErrors = (payload.json?.errors ?? []).map((error) => error?.message ?? "").filter(Boolean).join("; ");
  if (fromErrors) return fromErrors;
  if (payload.status >= 400) return `PlayStation responded with HTTP ${payload.status}.`;
  return "Could not add this item to the cart.";
}

const pause = () => new Promise((resolve) => setTimeout(resolve, PAUSE_MS));

async function handleAdd(request, origin) {
  let input;
  try { input = await request.json(); } catch { return json(emptyResult("invalid_request"), 400, origin); }
  if (!input || typeof input.token !== "string" || typeof input.region !== "string" || !Array.isArray(input.skus)) {
    return json(emptyResult("invalid_request"), 400, origin);
  }
  if (!/^[a-z]{2}$/.test(input.region)) return json(emptyResult("unknown_region"), 400, origin);
  const token = extractToken(input.token);
  if (!token) return json(emptyResult("invalid_cookie"), 400, origin);
  const skus = input.skus.filter((sku) => typeof sku === "string");
  if (skus.length === 0) return json(emptyResult("invalid_request"), 400, origin);
  if (skus.length > MAX_SKUS) return json(emptyResult("too_many"), 400, origin);
  const allowed = await catalogSkus(input.region);
  if (!allowed) return json(emptyResult("catalog_unavailable"), 502, origin);
  for (const sku of skus) if (!allowed.has(sku)) return json(emptyResult("not_in_catalog"), 400, origin);
  const results = [];
  let authFailed = false;
  let cartFull = false;
  for (let index = 0; index < skus.length; index++) {
    if (index > 0) await pause();
    if (authFailed || cartFull) break;
    const sku = skus[index];
    let payload;
    try { payload = await postAdd(token, sku); } catch {
      results.push({ sku, status: "failed", message: "Could not reach PlayStation." });
      continue;
    }
    if (succeeded(payload)) {
      results.push({ sku, status: "added" });
      continue;
    }
    const message = scrub(failureMessage(payload), token);
    const kind = classify(message);
    if (kind === "auth") {
      authFailed = true;
      results.push({ sku, status: "failed", message: "Cookie expired or invalid." });
    } else if (kind === "full") {
      cartFull = true;
      results.push({ sku, status: "failed", message: "Cart is full. Check out on PlayStation first." });
    } else if (kind === "skipped") {
      results.push({ sku, status: "skipped", message });
    } else {
      results.push({ sku, status: "failed", message });
    }
  }
  return json({ authFailed, cartFull, results }, 200, origin);
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") ?? "";
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      if (!ALLOWED.has(origin)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== "POST" || url.pathname !== "/add") return json(emptyResult("not_found"), 404, origin);
    if (origin && !ALLOWED.has(origin)) return json(emptyResult("forbidden"), 403, origin);
    return handleAdd(request, origin);
  },
};
