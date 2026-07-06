import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, euro } from '../../api';
import type { AdminStats } from '../../types';

const RANGES = [7, 14, 30] as const;

export default function StatsAdmin(): JSX.Element {
  const [days, setDays] = useState<number>(7);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats', days],
    queryFn: () => api<AdminStats>(`/api/admin/stats?days=${days}`, { auth: 'admin' }),
  });

  if (isLoading || !stats) return <p className="text-ivory/60">Auswertung wird geladen …</p>;

  const maxDayRevenue = Math.max(...stats.byDay.map((d) => d.revenueCents), 1);
  const rangeRevenue = stats.byDay.reduce((sum, d) => sum + d.revenueCents, 0);
  const rangeOrders = stats.byDay.reduce((sum, d) => sum + d.orders, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">Auswertung</h2>
        <div className="flex gap-1 rounded-xl bg-ivory/10 p-1">
          {RANGES.map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setDays(range)}
              className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${
                days === range ? 'bg-carta shadow-sm' : 'text-ivory/50 hover:text-ivory/80'
              }`}
            >
              {range} Tage
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Umsatz heute" value={euro(stats.today.revenueCents)} />
        <StatTile label="Bestellungen heute" value={String(stats.today.orders)} />
        <StatTile label="Trinkgeld heute" value={euro(stats.today.tipCents)} />
        <StatTile label="Ø Bonwert heute" value={euro(stats.today.avgOrderCents)} />
      </div>

      <section className="mt-4 rounded-2xl border border-ivory/10 bg-carta p-5 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h3 className="font-bold">Umsatz-Verlauf</h3>
          <p className="text-sm text-ivory/55">
            {euro(rangeRevenue)} · {rangeOrders} Bestellungen in {stats.days} Tagen
          </p>
        </div>
        <ul className="mt-4 space-y-2">
          {stats.byDay.map((day) => (
            <li key={day.date} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs tabular-nums text-ivory/55">{formatDay(day.date)}</span>
              <span className="h-5 flex-1 overflow-hidden rounded bg-ivory/5">
                <span
                  className="block h-full rounded bg-champagne/80"
                  style={{ width: `${Math.round((day.revenueCents / maxDayRevenue) * 100)}%` }}
                />
              </span>
              <span className="w-20 shrink-0 text-right text-xs font-semibold tabular-nums">
                {euro(day.revenueCents)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-ivory/10 bg-carta p-5 shadow-sm">
          <h3 className="font-bold">Top-Drinks ({stats.days} Tage)</h3>
          {stats.topItems.length === 0 ? (
            <p className="mt-3 text-sm text-ivory/50">Noch keine bezahlten Bestellungen im Zeitraum.</p>
          ) : (
            <ol className="mt-3 space-y-2.5">
              {stats.topItems.map((item, index) => (
                <li key={item.name} className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-champagne/15 text-xs font-bold text-champagne">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{item.name}</span>
                  <span className="shrink-0 text-sm tabular-nums text-ivory/55">
                    {item.quantity}× · {euro(item.revenueCents)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-2xl border border-ivory/10 bg-carta p-5 shadow-sm">
          <h3 className="font-bold">Nach Standort ({stats.days} Tage)</h3>
          {stats.byLocation.length === 0 ? (
            <p className="mt-3 text-sm text-ivory/50">Noch keine bezahlten Bestellungen im Zeitraum.</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {stats.byLocation.map((loc) => (
                <li key={loc.id} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate font-semibold">{loc.name}</span>
                  <span className="shrink-0 text-sm tabular-nums text-ivory/55">
                    {loc.orders} Best. · {euro(loc.revenueCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatTile(props: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-2xl border border-ivory/10 bg-carta p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-ivory/45">{props.label}</p>
      <p className="mt-1.5 text-2xl font-extrabold tabular-nums">{props.value}</p>
    </div>
  );
}

function formatDay(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}
