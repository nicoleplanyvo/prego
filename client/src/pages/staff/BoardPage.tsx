import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, euro, getStaffLocation, getStaffToken, setStaffSession, ApiRequestError } from '../../api';
import type { BoardOrder, OrderStatus } from '../../types';

type BoardColumn = 'NEW' | 'IN_PROGRESS' | 'READY';

const COLUMN_META: Record<BoardColumn, { title: string }> = {
  NEW: { title: 'Neu' },
  IN_PROGRESS: { title: 'In Arbeit' },
  READY: { title: 'Fertig' },
};

export default function BoardPage(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = getStaffLocation();
  const token = getStaffToken();
  const [activeColumn, setActiveColumn] = useState<BoardColumn>('NEW');
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!token || !location) navigate('/staff', { replace: true });
  }, [token, location, navigate]);

  const { data: orders = [], error } = useQuery({
    queryKey: ['board'],
    queryFn: () => api<BoardOrder[]>('/api/staff/orders', { auth: 'staff' }),
    enabled: Boolean(token),
    refetchInterval: 30_000, // Sicherheitsnetz, falls SSE hängt
  });

  useEffect(() => {
    if (error instanceof ApiRequestError && error.status === 401) {
      setStaffSession(null, null);
      navigate('/staff', { replace: true });
    }
  }, [error, navigate]);

  // Live-Feed
  useEffect(() => {
    if (!token) return undefined;
    const source = new EventSource(`/api/staff/stream?token=${encodeURIComponent(token)}`);
    source.onmessage = () => {
      void queryClient.invalidateQueries({ queryKey: ['board'] });
      playBeep(audioCtxRef);
    };
    return () => source.close();
  }, [token, queryClient]);

  const updateStatus = useMutation({
    mutationFn: (input: { orderId: string; status: OrderStatus }) =>
      api<BoardOrder>(`/api/staff/orders/${input.orderId}/status`, {
        method: 'PATCH',
        auth: 'staff',
        body: { status: input.status },
      }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['board'] }),
  });

  const grouped = useMemo(() => {
    const map: Record<BoardColumn, BoardOrder[]> = { NEW: [], IN_PROGRESS: [], READY: [] };
    for (const order of orders) {
      if (order.status === 'NEW' || order.status === 'IN_PROGRESS' || order.status === 'READY') {
        map[order.status].push(order);
      }
    }
    return map;
  }, [orders]);

  if (!location) return <div />;
  const isPickup = location.mode === 'PICKUP';

  return (
    <div className="min-h-screen bg-noir text-ivory">
      <header className="flex items-center justify-between border-b border-ivory/10 px-5 py-4">
        <div>
          <h1 className="font-display text-xl font-medium tracking-tight">
            prego<span className="text-champagne">.</span>{' '}
            <span className="font-sans text-base font-light text-ivory/50">{location.name}</span>
          </h1>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-luxe text-ivory/35">
            {isPickup ? 'Abhol-Modus' : 'Service-Modus'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setStaffSession(null, null);
            navigate('/staff', { replace: true });
          }}
          className="border border-ivory/20 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.15em] text-ivory/60 transition hover:border-champagne hover:text-champagne"
        >
          Schicht beenden
        </button>
      </header>

      {/* Mobile: Spalten-Tabs */}
      <nav className="flex gap-1 border-b border-ivory/10 px-3 py-2.5 md:hidden" aria-label="Spalten">
        {(Object.keys(COLUMN_META) as BoardColumn[]).map((col) => (
          <button
            key={col}
            type="button"
            onClick={() => setActiveColumn(col)}
            className={`flex-1 px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.15em] transition ${
              activeColumn === col ? 'bg-champagne text-noir' : 'text-ivory/40'
            }`}
          >
            {COLUMN_META[col].title} ({grouped[col].length})
          </button>
        ))}
      </nav>

      <main className="grid gap-5 p-5 md:grid-cols-3">
        {(Object.keys(COLUMN_META) as BoardColumn[]).map((col) => (
          <section key={col} className={`${activeColumn === col ? 'block' : 'hidden'} md:block`}>
            <div className="mb-3 hidden items-center gap-3 md:flex">
              <h2 className="text-[11px] font-semibold uppercase tracking-luxe text-champagne/80">
                {COLUMN_META[col].title} · {grouped[col].length}
              </h2>
              <span aria-hidden className="h-px flex-1 bg-ivory/10" />
            </div>
            <div className="space-y-3.5">
              {grouped[col].length === 0 && (
                <p className="border border-dashed border-ivory/10 p-7 text-center text-sm font-light text-ivory/25">
                  Keine Bestellungen
                </p>
              )}
              {grouped[col].map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  isPickup={isPickup}
                  busy={updateStatus.isPending}
                  onAdvance={(status) => updateStatus.mutate({ orderId: order.id, status })}
                />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

function OrderCard(props: {
  order: BoardOrder;
  isPickup: boolean;
  busy: boolean;
  onAdvance: (status: OrderStatus) => void;
}): JSX.Element {
  const { order, isPickup } = props;
  const age = useOrderAge(order.createdAt);

  const action: { label: string; next: OrderStatus } | null =
    order.status === 'NEW'
      ? { label: 'Annehmen', next: 'IN_PROGRESS' }
      : order.status === 'IN_PROGRESS'
        ? { label: isPickup ? 'Abholbereit' : 'Fertig', next: 'READY' }
        : order.status === 'READY'
          ? { label: isPickup ? 'Abgeholt' : 'Serviert', next: 'COMPLETED' }
          : null;

  return (
    <article className="border border-ivory/15 bg-carta p-5">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-4xl font-light tabular-nums">
          <span className="text-champagne">№</span> {order.number}
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ivory/35">{age}</p>
      </div>
      {order.tableLabel && (
        <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-champagne">Tisch {order.tableLabel}</p>
      )}
      {order.guestName && <p className="mt-0.5 text-sm font-light text-ivory/50">{order.guestName}</p>}

      <ul className="mt-4 space-y-1.5">
        {order.items.map((item) => (
          <li key={item.id} className="text-lg font-medium leading-snug">
            <span className="font-display italic text-champagne">{item.quantity}×</span> {item.name}
            {item.note && <span className="block pl-6 text-sm font-light text-ivory/45">„{item.note}"</span>}
          </li>
        ))}
      </ul>

      <p className="mt-3 font-display text-sm italic text-ivory/40">{euro(order.subtotalCents)}</p>

      <div className="mt-4 flex gap-2">
        {action && (
          <button
            type="button"
            onClick={() => props.onAdvance(action.next)}
            disabled={props.busy}
            className="h-12 flex-1 bg-ivory text-xs font-bold uppercase tracking-[0.2em] text-noir transition hover:bg-champagne disabled:opacity-50"
          >
            {action.label}
          </button>
        )}
        {(order.status === 'NEW' || order.status === 'IN_PROGRESS') && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Bestellung № ${order.number} wirklich stornieren?`)) {
                props.onAdvance('CANCELLED');
              }
            }}
            disabled={props.busy}
            aria-label={`Bestellung ${order.number} stornieren`}
            className="h-12 w-12 border border-ivory/20 font-light text-ivory/50 transition hover:border-red-400/60 hover:text-red-300 disabled:opacity-50"
          >
            ✕
          </button>
        )}
      </div>
    </article>
  );
}

function useOrderAge(createdAt: string): string {
  const [, force] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(interval);
  }, []);
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000));
  return minutes === 0 ? 'gerade eben' : `vor ${minutes} Min`;
}

function playBeep(ref: React.MutableRefObject<AudioContext | null>): void {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    if (!ref.current) ref.current = new AudioCtx();
    const ctx = ref.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    /* Sound ist optional */
  }
}
