/**
 * Descarga los tipos de cambio USD→DOP/MXN del día y los guarda en exchange_rates.
 * Pensado para ejecutarse una vez al día (GitHub Actions). Idempotente por fecha y proveedor.
 *
 *   DATABASE_URL=… npm run fx:sync
 */
import postgres from "postgres";
import { fetchUsdRates, FX_CURRENCIES } from "../src/lib/fx/providers.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL");
  process.exit(2);
}
const sql = postgres(url, { max: 1, onnotice: () => {} });
const [run] = await sql<{ id: string }[]>`insert into sync_runs (job, status) values ('exchange_rates', 'running') returning id`;
try {
  const snap = await fetchUsdRates();
  for (const quote of FX_CURRENCIES) {
    if (quote === "USD") continue;
    await sql`insert into exchange_rates (base, quote, rate, provider, rate_date)
              values ('USD', ${quote}, ${snap.rates[quote]}, ${snap.provider}, ${snap.rateDate})
              on conflict (base, quote, rate_date, provider) do update set rate = excluded.rate, fetched_at = now()`;
  }
  await sql`update sync_runs set status='success', finished_at=now(), stats=${sql.json({ ...snap.rates, rateDate: snap.rateDate, provider: snap.provider })} where id=${run.id}`;
  console.log(`✓ ${snap.rateDate} (${snap.provider}): 1 USD = ${snap.rates.DOP} DOP = ${snap.rates.MXN} MXN`);
} catch (e) {
  await sql`update sync_runs set status='failed', finished_at=now(), error=${(e as Error).message} where id=${run.id}`;
  console.error(`✗ ${(e as Error).message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
