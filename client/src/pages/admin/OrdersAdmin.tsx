import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, euro } from '../../api';
import type { AdminLocation, AdminOrder, OrderStatus } from '../../types';

const STATUS_META: Record<OrderStatus, { label: string; className: string }> = {
  PENDING_PAYMENT: { label: 'Unbezahlt', className: 'bg-ivory/10 text-ivory/50' },
  NEW: { label: 'Neu', className: 'bg-champagne/15 text-champagne' },
  IN_PROGRESS: { label: 'In Arbeit', className: 'bg-champagne/15 text-champagne' },
  READY: { label: 'Fertig', className: 'bg-oliva/15 text-oliva' },
  COMPLETED: { label: 'Abgeschlossen', className: 'bg-oliva/15 text-oliva' },
  CANCELLED: { label: 'Storniert', className: 'bg-red-950/60 text-red-300' },
};

const CANCELLABLE: OrderStatus[] = ['NEW', 'IN_PROGRESS', 'READY'];

export default function OrdersAdmin(): JSX.Element {
  const queryClient = useQueryClient();
  const [locationId, setLocationId] = useState('');
  const [days, setDays] = useState(7);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: locations = [] } = useQuery({
    queryKey: ['admin-locations'],
    queryFn: () => api<AdminLocation[]>('/api/admin/locations', { auth: 'admin' }),
  });

  const params = new URLSearchParams({ days: String(days) });
  if (locationId) params.set('locationId', locationId);
  if (search.trim()) params.set('q', search.trim());

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['admin-orders', locationId, days, search.trim()],
    queryFn: () => api<AdminOrder[]>(`/api/admin/orders?${params.toString()}`, { auth: 'admin' }),
  });

  const cancelOrder = useMutation({
    mutationFn: (orderId: string) =>
      api<AdminOrder & { refunded: boolean }>(`/api/admin/orders/${orderId}/cancel`, { method: 'POST', auth: 'admin' }),
    onSuccess: (data) => {
      setError(null);
      if (!data.refunded) setError('Storniert – es war keine Zahlung zu erstatten.');
      void queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Storno fehlgeschlagen.'),
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">Bestellungen</h2>
        <div className="flex flex-wrap gap-2">
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            aria-label="Standort filtern"
            className="rounded-xl border-2 border-ivory/15 bg-carta px-3 py-2 text-sm font-semibold focus:border-champagne focus:outline-none"
          >
            <option value="">Alle Standorte</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            aria-label="Zeitraum"
            className="rounded-xl border-2 border-ivory/15 bg-carta px-3 py-2 text-sm font-semibold focus:border-champagne focus:outline-none"
          >
            <option value={1}>Heute</option>
            <option value={7}>7 Tage</option>
            <option value={30}>30 Tage</option>
            <option value={90}>90 Tage</option>
          </select>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nr. oder Gastname"
            aria-label="Bestellungen durchsuchen"
            className="w-44 rounded-xl border-2 border-ivory/15 px-3 py-2 text-sm focus:border-champagne focus:outline-none"
          />
        </div>
      </div>

      {error && <p className="mt-3 rounded-xl bg-red-950/50 px-4 py-2 text-sm font-medium text-red-300">{error}</p>}

      {isLoading ? (
        <p className="mt-6 text-ivory/60">Bestellungen werden geladen …</p>
      ) : orders.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-ivory/15 p-8 text-center text-ivory/50">
          Keine Bestellungen im gewählten Zeitraum.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {orders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              busy={cancelOrder.isPending}
              onCancel={() => {
                if (window.confirm(`Bestellung № ${order.number} stornieren? Bezahlte Beträge werden automatisch erstattet.`)) {
                  cancelOrder.mutate(order.id);
                }
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderRow(props: { order: AdminOrder; busy: boolean; onCancel: () => void }): JSX.Element {
  const { order } = props;
  const meta = STATUS_META[order.status];
  const created = new Date(order.createdAt);

  return (
    <li className="rounded-2xl border border-ivory/10 bg-carta p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="font-display text-2xl font-light tabular-nums">
          <span className="text-champagne">№</span> {order.number}
        </p>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${meta.className}`}>{meta.label}</span>
        {order.refundedAt && (
          <span className="rounded-full bg-ivory/10 px-3 py-1 text-xs font-bold text-ivory/60">Erstattet</span>
        )}
        <p className="text-sm text-ivory/55">
          {created.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}{' '}
          {created.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · {order.location.name}
          {order.tableLabel && ` · Tisch ${order.tableLabel}`}
          {order.guestName && ` · ${order.guestName}`}
        </p>
        <p className="ml-auto font-semibold tabular-nums">
          {euro(order.subtotalCents + order.tipCents)}
          {order.tipCents > 0 && (
            <span className="ml-1 text-xs font-normal text-ivory/45">inkl. {euro(order.tipCents)} Trinkgeld</span>
          )}
        </p>
        {CANCELLABLE.includes(order.status) && (
          <button
            type="button"
            onClick={props.onCancel}
            disabled={props.busy}
            className="rounded-lg border-2 border-ivory/15 px-3 py-1.5 text-xs font-bold text-red-300 transition hover:border-red-400/60 disabled:opacity-50"
          >
            Stornieren & erstatten
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-ivory/60">{order.items.map((i) => `${i.quantity}× ${i.name}`).join(' · ')}</p>
    </li>
  );
}
