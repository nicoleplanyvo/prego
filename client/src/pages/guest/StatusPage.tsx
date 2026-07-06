import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { BrandedShell, BrandLogo } from '../../branding';
import type { PublicOrder } from '../../types';

const STATUS_STEPS: { key: PublicOrder['status']; label: string }[] = [
  { key: 'NEW', label: 'Bestellung eingegangen' },
  { key: 'IN_PROGRESS', label: 'Wird gemixt' },
  { key: 'READY', label: 'Abholbereit' },
];

function stepIndex(status: PublicOrder['status']): number {
  if (status === 'PENDING_PAYMENT') return -1;
  if (status === 'NEW') return 0;
  if (status === 'IN_PROGRESS') return 1;
  return 2; // READY & COMPLETED
}

export default function StatusPage(): JSX.Element {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [pushState, setPushState] = useState<'idle' | 'active' | 'unsupported' | 'error'>('idle');
  const audioCtxRef = useRef<AudioContext | null>(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', token],
    queryFn: () => api<PublicOrder>(`/api/public/orders/${token}`),
    enabled: Boolean(token),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'PENDING_PAYMENT') return 3000;
      // Warteschlangen-Position aktuell halten, solange die Bestellung offen ist
      if (status === 'NEW' || status === 'IN_PROGRESS') return 30_000;
      return false;
    },
  });

  // Live-Updates per SSE – Tab offen lassen genügt
  useEffect(() => {
    if (!token) return undefined;
    const source = new EventSource(`/api/public/orders/${token}/stream`);
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data as string) as { type: string; status?: PublicOrder['status'] };
        if (payload.type === 'status' && payload.status) {
          queryClient.setQueryData<PublicOrder>(['order', token], (prev) =>
            prev ? { ...prev, status: payload.status as PublicOrder['status'] } : prev
          );
          if (payload.status === 'READY') {
            playChime(audioCtxRef);
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          }
        }
      } catch {
        /* ignorieren */
      }
    };
    return () => source.close();
  }, [token, queryClient]);

  const enablePush = async (): Promise<void> => {
    if (!token) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushState('unsupported');
      return;
    }
    try {
      const keyInfo = await api<{ enabled: boolean; vapidPublicKey: string | null }>('/api/public/push/key');
      if (!keyInfo.enabled || !keyInfo.vapidPublicKey) {
        setPushState('unsupported');
        return;
      }
      const registration = await navigator.serviceWorker.register('/sw.js');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushState('error');
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyInfo.vapidPublicKey),
      });
      await api(`/api/public/orders/${token}/push`, { method: 'POST', body: subscription.toJSON() });
      setPushState('active');
    } catch {
      setPushState('error');
    }
  };

  if (isLoading || !order) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="text-lg font-light text-ivory/60">Bestellung wird geladen …</p>
      </main>
    );
  }

  const currentStep = stepIndex(order.status);
  const isService = order.mode === 'SERVICE';

  return (
    <BrandedShell branding={order.branding}>
    <main className="relative mx-auto flex min-h-screen max-w-lg flex-col items-center overflow-hidden px-6 py-12 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-champagne/10 blur-3xl"
      />
      <BrandLogo branding={order.branding} barName={order.location?.name ?? 'prego.'} className="mb-3" />
      <p className="text-[11px] font-semibold uppercase tracking-luxe text-champagne">
        {order.location?.name ?? 'prego.'}
      </p>
      <p className="mt-9 text-[11px] font-semibold uppercase tracking-luxe text-ivory/40">Ihre Bestellnummer</p>
      <p className="mt-2 font-display text-9xl font-light tabular-nums tracking-tight" aria-live="polite">
        {order.number}
      </p>

      {order.status === 'PENDING_PAYMENT' && (
        <p className="mt-9 border border-ivory/15 bg-carta px-6 py-4 font-light text-ivory/70">
          Zahlung wird bestätigt …
        </p>
      )}

      {order.status === 'CANCELLED' && (
        <p className="mt-9 border border-red-400/40 bg-red-950/50 px-6 py-4 text-red-300">
          Diese Bestellung wurde storniert.
          {order.refundedAt
            ? ' Der Betrag wurde bereits zurückerstattet – je nach Bank dauert die Gutschrift wenige Tage.'
            : ' Bitte melden Sie sich an der Bar.'}
        </p>
      )}

      {typeof order.queueAhead === 'number' &&
        order.queueAhead > 0 &&
        (order.status === 'NEW' || order.status === 'IN_PROGRESS') && (
          <p className="mt-6 text-sm font-light text-ivory/50">
            Vor Ihnen: <span className="font-display italic text-champagne">{order.queueAhead}</span>{' '}
            {order.queueAhead === 1 ? 'Bestellung' : 'Bestellungen'}
          </p>
        )}

      {order.status !== 'PENDING_PAYMENT' && order.status !== 'CANCELLED' && (
        <ol className="mt-11 w-full max-w-xs space-y-5 text-left">
          {STATUS_STEPS.map((step, index) => {
            const reached = currentStep >= index;
            const label = isService && step.key === 'READY' ? 'Kommt an Ihren Tisch' : step.label;
            return (
              <li key={step.key} className="flex items-center gap-4">
                <span
                  aria-hidden
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-sm ${
                    reached ? 'bg-champagne text-noir' : 'border border-ivory/20 text-ivory/30'
                  }`}
                >
                  {reached ? '✓' : index + 1}
                </span>
                <span className={`text-[15px] ${reached ? 'font-medium text-ivory' : 'font-light text-ivory/35'}`}>
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {order.status === 'READY' && !isService && (
        <p className="mt-10 w-full max-w-xs animate-pulse bg-ivory px-6 py-5 text-sm font-bold uppercase tracking-[0.2em] text-noir">
          Jetzt abholen
        </p>
      )}

      {order.status === 'COMPLETED' && (
        <p className="mt-10 border border-oliva/40 bg-oliva/10 px-6 py-4 font-display text-lg italic text-oliva">
          {isService ? 'Serviert – salute!' : 'Abgeholt – salute!'}
        </p>
      )}

      {isService && order.tableLabel && order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
        <p className="mt-7 font-light text-ivory/55">
          Wird an <span className="font-display italic text-champagne">Tisch {order.tableLabel}</span> serviert –
          Sie müssen nichts weiter tun.
        </p>
      )}

      {!isService && ['NEW', 'IN_PROGRESS'].includes(order.status) && (
        <div className="mt-11 w-full max-w-xs">
          <p className="text-sm font-light text-ivory/50">
            Lassen Sie diese Seite einfach offen – sie aktualisiert sich von selbst.
          </p>
          {pushState === 'idle' && (
            <button
              type="button"
              onClick={() => void enablePush()}
              className="mt-4 w-full border border-ivory/25 px-4 py-3.5 text-xs font-bold uppercase tracking-[0.15em] text-ivory transition hover:border-champagne hover:text-champagne"
            >
              Zusätzlich benachrichtigen
            </button>
          )}
          {pushState === 'active' && (
            <p className="mt-4 text-sm font-medium text-oliva">Benachrichtigung ist aktiv.</p>
          )}
          {pushState === 'unsupported' && (
            <p className="mt-4 text-sm font-light text-ivory/40">
              Ihr Browser unterstützt keine Push-Nachrichten – die Seite bleibt trotzdem live.
            </p>
          )}
          {pushState === 'error' && (
            <p className="mt-4 text-sm font-light text-ivory/40">
              Benachrichtigung nicht möglich – die Seite bleibt trotzdem live.
            </p>
          )}
        </div>
      )}

      <section className="mt-14 w-full max-w-xs border border-ivory/15 bg-carta p-5 text-left">
        <div className="flex items-center gap-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-luxe text-champagne/90">Ihre Bestellung</h2>
          <span aria-hidden className="h-px flex-1 bg-ivory/10" />
        </div>
        <ul className="mt-3 space-y-1.5">
          {order.items.map((item) => (
            <li key={item.id} className="text-sm font-light text-ivory/80">
              <span className="font-display italic text-champagne">{item.quantity}×</span> {item.name}
              {item.note && <span className="block pl-5 text-xs text-ivory/40">„{item.note}"</span>}
            </li>
          ))}
        </ul>
        {order.tipCents > 0 && (
          <p className="mt-3 border-t border-ivory/[0.07] pt-3 text-xs font-light text-ivory/45">
            + Trinkgeld – danke! <span className="font-display italic text-champagne">Salute.</span>
          </p>
        )}
      </section>
    </main>
    </BrandedShell>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function playChime(ref: React.MutableRefObject<AudioContext | null>): void {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    if (!ref.current) ref.current = new AudioCtx();
    const ctx = ref.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1174, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    /* Sound ist optional */
  }
}
