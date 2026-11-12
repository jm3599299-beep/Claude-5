import { ExternalLink, Info } from "lucide-react";
import { formatDate } from "@/lib/format";
import { FX_ATTRIBUTION } from "@/lib/fx/providers";
import { KIND_LABEL, MARKETS, conversions, money, referencePrice, storeStats, type PriceObs, type Rate } from "@/lib/pricing";

export function PriceSection({ prices, rates, now }: { prices: PriceObs[]; rates: Rate[]; now: number }) {
  const ref = referencePrice(prices);
  const conv = ref ? conversions(ref, rates) : [];
  const rateInfo = rates[0];
  const attribution = rateInfo ? FX_ATTRIBUTION[rateInfo.provider] : null;

  return (
    <section aria-label="Precios de esta configuración" className="rounded-2xl border border-border bg-surface">
      <div className="border-b border-border bg-surface-2/50 px-4 py-2.5">
        <h3 className="font-display font-semibold">Precios</h3>
      </div>
      <div className="space-y-5 p-4">
        {MARKETS.map((m) => {
          const list = prices.filter((p) => p.country_code === m.country).sort((a, b) => b.observed_at.localeCompare(a.observed_at));
          const stats = storeStats(prices, m.country, now);
          return (
            <div key={m.country}>
              <h4 className="mb-2 text-sm font-semibold">{m.name}</h4>
              {list.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead className="text-left text-xs text-fg-muted">
                      <tr>
                        <th className="py-1 pr-3 font-medium">Tipo</th>
                        <th className="py-1 pr-3 font-medium">Precio real</th>
                        <th className="py-1 pr-3 font-medium">Tienda</th>
                        <th className="py-1 pr-3 font-medium">Fecha</th>
                        <th className="py-1 font-medium">Fuente</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {list.map((p, i) => (
                        <tr key={i}>
                          <td className="py-1.5 pr-3">{KIND_LABEL[p.kind]}</td>
                          <td className="py-1.5 pr-3 font-semibold">{money(Number(p.amount), p.currency_code, 2)}</td>
                          <td className="py-1.5 pr-3">
                            {p.store ? (p.product_url ? <a href={p.product_url} target="_blank" rel="noopener noreferrer nofollow" className="text-primary hover:underline">{p.store.name}</a> : p.store.name) : "—"}
                            {p.in_stock === false && <span className="ml-1 text-xs text-fg-muted">(sin stock)</span>}
                          </td>
                          <td className="py-1.5 pr-3 text-fg-muted">
                            <time dateTime={p.observed_at}>{formatDate(p.observed_at)}</time>
                          </td>
                          <td className="py-1.5">
                            {p.source?.homepage_url ? (
                              <a href={p.source.homepage_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
                                {p.source.name} <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              (p.source?.name ?? "—")
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {stats && (
                    <p className="mt-2 text-xs text-fg-muted">
                      Tiendas (últimos 90 días, {stats.samples} observación{stats.samples === 1 ? "" : "es"}): mínimo {money(stats.min, stats.currency)} · máximo{" "}
                      {money(stats.max, stats.currency)}
                      {stats.avg !== null ? ` · promedio ${money(stats.avg, stats.currency)}` : " · promedio no disponible (se necesitan al menos 3 precios)"}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm italic text-fg-muted">Sin precios registrados en {m.name}.</p>
              )}
            </div>
          );
        })}

        {ref && conv.length > 0 && rateInfo && (
          <div className="rounded-xl border border-dashed border-border bg-surface-2/40 p-3">
            <p className="flex items-start gap-1.5 text-xs font-medium">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
              Conversión orientativa del precio de {KIND_LABEL[ref.kind].toLowerCase()} ({money(Number(ref.amount), ref.currency_code)}). No es un precio de venta ni una oferta.
            </p>
            <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {conv.map((c) => (
                <li key={c.currency}>
                  ≈ <span className="font-semibold">{money(c.amount, c.currency)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-fg-muted">
              Tipo de cambio del {formatDate(rateInfo.rate_date)}
              {attribution ? (
                <>
                  {" · "}
                  <a href={attribution.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {attribution.text}
                  </a>
                </>
              ) : (
                ` · ${rateInfo.provider}`
              )}
              . Los precios reales pueden incluir impuestos, aranceles y márgenes locales distintos.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
