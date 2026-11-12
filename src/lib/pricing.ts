/**
 * Price presentation rules:
 *  - Real prices are always shown in their original currency with date and source.
 *  - Store statistics use only store prices from the last 90 days; the average
 *    requires at least 3 observations.
 *  - Conversions are indicative, labelled, dated, and never presented as offers.
 */
import { convert } from "./fx/providers.ts";

export type PriceKind = "launch" | "official" | "store";

export interface PriceObs {
  kind: PriceKind;
  country_code: string;
  currency_code: string;
  amount: number;
  observed_at: string;
  product_url: string | null;
  in_stock: boolean | null;
  store: { name: string } | null;
  source: { name: string; homepage_url: string | null } | null;
}

export interface Rate {
  quote: string;
  rate: number;
  provider: string;
  rate_date: string;
}

export const MARKETS = [
  { country: "US", name: "Estados Unidos", currency: "USD" },
  { country: "DO", name: "República Dominicana", currency: "DOP" },
  { country: "MX", name: "México", currency: "MXN" },
] as const;

export const KIND_LABEL: Record<PriceKind, string> = { launch: "Lanzamiento", official: "Oficial", store: "Tienda" };

const DAY = 86_400_000;

export function storeStats(prices: PriceObs[], country: string, now: number) {
  const recent = prices.filter((p) => p.kind === "store" && p.country_code === country && now - Date.parse(p.observed_at) <= 90 * DAY);
  if (!recent.length) return null;
  // Stats are only meaningful within one currency.
  const currency = recent[0].currency_code;
  const same = recent.filter((p) => p.currency_code === currency).map((p) => Number(p.amount));
  return {
    currency,
    min: Math.min(...same),
    max: Math.max(...same),
    avg: same.length >= 3 ? Math.round((same.reduce((a, b) => a + b, 0) / same.length) * 100) / 100 : null,
    samples: same.length,
    lastObserved: recent.map((p) => p.observed_at).sort().at(-1)!,
  };
}

/** Most relevant real price: latest official, else latest launch, else lowest recent store price. */
export function referencePrice(prices: PriceObs[]): PriceObs | null {
  const latest = (k: PriceKind) => prices.filter((p) => p.kind === k).sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0];
  return latest("official") ?? latest("launch") ?? prices.filter((p) => p.kind === "store").sort((a, b) => a.amount - b.amount)[0] ?? null;
}

export function conversions(price: PriceObs, rates: Rate[]) {
  const usd = Object.fromEntries(rates.map((r) => [r.quote, Number(r.rate)]));
  return MARKETS.map((m) => m.currency)
    .filter((c) => c !== price.currency_code)
    .map((c) => ({ currency: c, amount: convert(Number(price.amount), price.currency_code, c, usd) }))
    .filter((x): x is { currency: (typeof MARKETS)[number]["currency"]; amount: number } => x.amount !== null);
}

const fmtCache = new Map<string, Intl.NumberFormat>();
export function money(amount: number, currency: string, maxFrac = 0) {
  const key = `${currency}:${maxFrac}`;
  if (!fmtCache.has(key))
    fmtCache.set(key, new Intl.NumberFormat("es", { style: "currency", currency, currencyDisplay: "code", maximumFractionDigits: maxFrac, minimumFractionDigits: 0 }));
  return fmtCache.get(key)!.format(amount);
}
