/**
 * Exchange-rate providers. Rates are fetched once a day by a scheduled job and
 * stored with their date and provider; the site never calls the provider at
 * request time.
 */
export const FX_CURRENCIES = ["USD", "DOP", "MXN"] as const;
export type FxCurrency = (typeof FX_CURRENCIES)[number];

export interface FxSnapshot {
  provider: string;
  base: "USD";
  rateDate: string; // YYYY-MM-DD (provider's last update, UTC)
  rates: Record<FxCurrency, number>;
}

/** Attribution required by the open-access tier; null when not required. */
export const FX_ATTRIBUTION: Record<string, { text: string; url: string } | null> = {
  "exchangerate-api-open": { text: "Rates By Exchange Rate API", url: "https://www.exchangerate-api.com" },
  "exchangerate-api": null,
};

interface ErApiResponse {
  result: string;
  time_last_update_unix?: number;
  rates?: Record<string, number>;
  conversion_rates?: Record<string, number>;
  "error-type"?: string;
}

export function parseErApi(body: ErApiResponse, provider: string): FxSnapshot {
  if (body.result !== "success") throw new Error(`Proveedor de divisas: ${body["error-type"] ?? "respuesta no válida"}`);
  const rates = body.rates ?? body.conversion_rates ?? {};
  const out = {} as Record<FxCurrency, number>;
  for (const c of FX_CURRENCIES) {
    const r = rates[c];
    if (typeof r !== "number" || !(r > 0)) throw new Error(`Falta el tipo de cambio USD→${c}`);
    out[c] = r;
  }
  if (!body.time_last_update_unix) throw new Error("La respuesta no indica la fecha de actualización");
  return { provider, base: "USD", rateDate: new Date(body.time_last_update_unix * 1000).toISOString().slice(0, 10), rates: out };
}

export async function fetchUsdRates(apiKey = process.env.EXCHANGERATE_API_KEY): Promise<FxSnapshot> {
  const keyed = Boolean(apiKey);
  const url = keyed ? `https://v6.exchangerate-api.com/v6/${encodeURIComponent(apiKey!)}/latest/USD` : "https://open.er-api.com/v6/latest/USD";
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (res.status === 429) throw new Error("Límite de peticiones del proveedor (429). Reintentar más tarde.");
  if (!res.ok) throw new Error(`Proveedor de divisas respondió ${res.status}`);
  return parseErApi((await res.json()) as ErApiResponse, keyed ? "exchangerate-api" : "exchangerate-api-open");
}

/** Converts an amount between currencies using USD-based rates. */
export function convert(amount: number, from: string, to: string, usdRates: Partial<Record<string, number>>): number | null {
  if (from === to) return amount;
  const f = from === "USD" ? 1 : usdRates[from];
  const t = to === "USD" ? 1 : usdRates[to];
  if (!f || !t) return null;
  return (amount / f) * t;
}
