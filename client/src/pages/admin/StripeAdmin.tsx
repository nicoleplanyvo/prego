import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import type { TenantMe } from '../../types';

interface ConnectStatus {
  connected: boolean;
  chargesEnabled: boolean;
}

export default function StripeAdmin(): JSX.Element {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [busy, setBusy] = useState<'onboard' | 'checkout' | 'portal' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: me } = useQuery({
    queryKey: ['admin-me'],
    queryFn: () => api<TenantMe>('/api/admin/me', { auth: 'admin' }),
  });

  const { data: connect } = useQuery({
    queryKey: ['stripe-connect-status'],
    queryFn: () => api<ConnectStatus>('/api/stripe/connect/status', { auth: 'admin' }),
  });

  // Nach Rückkehr von Stripe (?onboarded=1 / ?subscribed=1) Status neu laden
  useEffect(() => {
    if (searchParams.get('onboarded') || searchParams.get('subscribed') || searchParams.get('refresh')) {
      void queryClient.invalidateQueries({ queryKey: ['stripe-connect-status'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-me'] });
    }
  }, [searchParams, queryClient]);

  const redirect = async (path: string, kind: 'onboard' | 'checkout' | 'portal'): Promise<void> => {
    setBusy(kind);
    setError(null);
    try {
      const result = await api<{ url: string }>(path, { method: 'POST', auth: 'admin' });
      window.location.href = result.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Weiterleitung fehlgeschlagen.');
      setBusy(null);
    }
  };

  const chargesEnabled = connect?.chargesEnabled ?? false;
  const subscriptionActive = me?.subscriptionStatus === 'active' || me?.subscriptionStatus === 'trialing';

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-ivory/10 bg-carta p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Auszahlungen (Stripe Connect)</h2>
          <StatusBadge ok={chargesEnabled} okText="Aktiv" pendingText={connect?.connected ? 'Unvollständig' : 'Nicht verbunden'} />
        </div>
        <p className="mt-2 text-sm text-ivory/60">
          Gäste zahlen direkt an dein Stripe-Konto. prego behält automatisch 2 % pro Transaktion ein – der Rest landet ohne
          Umweg bei dir.
        </p>
        <button
          type="button"
          onClick={() => void redirect('/api/stripe/connect/onboard', 'onboard')}
          disabled={busy !== null}
          className="mt-4 rounded-xl bg-champagne px-5 py-3 font-bold text-noir transition hover:bg-champagne-dark disabled:opacity-50"
        >
          {busy === 'onboard' ? 'Weiterleitung …' : chargesEnabled ? 'Stripe-Daten aktualisieren' : 'Jetzt mit Stripe verbinden'}
        </button>
      </section>

      <section className="rounded-2xl border border-ivory/10 bg-carta p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">prego-Abo</h2>
          <StatusBadge ok={subscriptionActive} okText="Aktiv" pendingText={me?.subscriptionStatus === 'none' ? 'Kein Abo' : (me?.subscriptionStatus ?? '–')} />
        </div>
        <p className="mt-2 text-sm text-ivory/60">
          Die monatliche Grundgebühr deckt Hosting, Support und alle Updates ab. Kündigung jederzeit im Kundenportal.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {!subscriptionActive && (
            <button
              type="button"
              onClick={() => void redirect('/api/stripe/billing/checkout', 'checkout')}
              disabled={busy !== null}
              className="rounded-xl bg-champagne px-5 py-3 font-bold text-noir transition hover:bg-champagne-dark disabled:opacity-50"
            >
              {busy === 'checkout' ? 'Weiterleitung …' : 'Abo abschließen'}
            </button>
          )}
          {me?.subscriptionStatus !== 'none' && (
            <button
              type="button"
              onClick={() => void redirect('/api/stripe/billing/portal', 'portal')}
              disabled={busy !== null}
              className="rounded-xl border-2 border-ivory/15 px-5 py-3 font-bold transition hover:border-ivory/30 disabled:opacity-50"
            >
              {busy === 'portal' ? 'Weiterleitung …' : 'Kundenportal öffnen'}
            </button>
          )}
        </div>
      </section>

      {error && <p className="rounded-xl bg-red-950/50 px-4 py-3 text-sm font-medium text-red-300">{error}</p>}

      {!chargesEnabled && (
        <p className="rounded-xl bg-ivory/10 px-4 py-3 text-sm text-ivory/70">
          Hinweis: Solange Stripe nicht vollständig verbunden ist, sehen Gäste die Speisekarte, können aber nicht bestellen.
        </p>
      )}
    </div>
  );
}

function StatusBadge(props: { ok: boolean; okText: string; pendingText: string }): JSX.Element {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${
        props.ok ? 'bg-oliva/10 text-oliva' : 'bg-champagne/10 text-champagne'
      }`}
    >
      {props.ok ? props.okText : props.pendingText}
    </span>
  );
}
