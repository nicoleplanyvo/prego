import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { api } from '../../api';
import type { AdminLocation } from '../../types';

export default function LocationsAdmin(): JSX.Element {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [mode, setMode] = useState<'PICKUP' | 'SERVICE'>('PICKUP');
  const [pin, setPin] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['admin-locations'],
    queryFn: () => api<AdminLocation[]>('/api/admin/locations', { auth: 'admin' }),
  });

  const createLocation = useMutation({
    mutationFn: () =>
      api<AdminLocation>('/api/admin/locations', {
        method: 'POST',
        auth: 'admin',
        body: { name, slug, mode, staffPin: pin },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-locations'] });
      setShowForm(false);
      setName('');
      setSlug('');
      setPin('');
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof Error ? err.message : 'Anlegen fehlgeschlagen.'),
  });

  const toggleActive = useMutation({
    mutationFn: (loc: AdminLocation) =>
      api<AdminLocation>(`/api/admin/locations/${loc.id}`, {
        method: 'PATCH',
        auth: 'admin',
        body: { active: !loc.active },
      }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['admin-locations'] }),
  });

  if (isLoading) return <p className="text-ivory/60">Standorte werden geladen …</p>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold">Standorte</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-xl bg-champagne px-4 py-2 font-bold text-noir transition hover:bg-champagne-dark"
        >
          {showForm ? 'Abbrechen' : '+ Neuer Standort'}
        </button>
      </div>

      {showForm && (
        <div className="mt-4 rounded-2xl border border-ivory/10 bg-carta p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold" htmlFor="loc-name">Name</label>
              <input
                id="loc-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z. B. Stadtfest Köln"
                className="mt-1 w-full rounded-xl border-2 border-ivory/15 px-3 py-2 focus:border-champagne focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold" htmlFor="loc-slug">Slug (URL-Kürzel)</label>
              <input
                id="loc-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="stadtfest-koeln"
                className="mt-1 w-full rounded-xl border-2 border-ivory/15 px-3 py-2 focus:border-champagne focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold" htmlFor="loc-mode">Modus</label>
              <select
                id="loc-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as 'PICKUP' | 'SERVICE')}
                className="mt-1 w-full rounded-xl border-2 border-ivory/15 bg-carta px-3 py-2 focus:border-champagne focus:outline-none"
              >
                <option value="PICKUP">Abholung (Gast holt am Tresen ab)</option>
                <option value="SERVICE">Service (Kellner bringt an den Tisch)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold" htmlFor="loc-pin">Barkeeper-PIN (4–8 Ziffern)</label>
              <input
                id="loc-pin"
                type="text"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                maxLength={8}
                placeholder="4711"
                className="mt-1 w-full rounded-xl border-2 border-ivory/15 px-3 py-2 tracking-widest focus:border-champagne focus:outline-none"
              />
            </div>
          </div>
          {formError && <p className="mt-3 rounded-xl bg-red-950/50 px-4 py-2 text-sm font-medium text-red-300">{formError}</p>}
          <button
            type="button"
            onClick={() => createLocation.mutate()}
            disabled={createLocation.isPending || name.length < 2 || !/^[a-z0-9-]{2,}$/.test(slug) || !/^\d{4,8}$/.test(pin)}
            className="mt-4 rounded-xl bg-champagne px-5 py-3 font-bold text-noir transition hover:bg-champagne-dark disabled:opacity-50"
          >
            {createLocation.isPending ? 'Wird angelegt …' : 'Standort anlegen'}
          </button>
        </div>
      )}

      <ul className="mt-4 space-y-3">
        {locations.length === 0 && !showForm && (
          <li className="rounded-2xl border border-dashed border-ivory/15 p-8 text-center text-ivory/50">
            Noch keine Standorte. Lege den ersten an – jeder Standort bekommt eigene QR-Codes und eine eigene PIN.
          </li>
        )}
        {locations.map((loc) => (
          <LocationCard key={loc.id} location={loc} onToggleActive={() => toggleActive.mutate(loc)} />
        ))}
      </ul>
    </div>
  );
}

function LocationCard(props: { location: AdminLocation; onToggleActive: () => void }): JSX.Element {
  const { location } = props;
  const [qrOpen, setQrOpen] = useState(false);
  const [tableCount, setTableCount] = useState(10);
  const [busy, setBusy] = useState(false);

  const guestUrl = `${window.location.origin}/l/${location.slug}`;

  const downloadDataUrl = (dataUrl: string, filename: string): void => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
  };

  const downloadBaseQr = async (): Promise<void> => {
    setBusy(true);
    try {
      const dataUrl = await QRCode.toDataURL(guestUrl, { width: 1024, margin: 2, color: { dark: '#201812', light: '#FFFFFF' } });
      downloadDataUrl(dataUrl, `prego-${location.slug}.png`);
    } finally {
      setBusy(false);
    }
  };

  const downloadTableQrs = async (): Promise<void> => {
    setBusy(true);
    try {
      for (let table = 1; table <= tableCount; table += 1) {
        // eslint-disable-next-line no-await-in-loop
        const dataUrl = await QRCode.toDataURL(`${guestUrl}?t=${table}`, {
          width: 1024,
          margin: 2,
          color: { dark: '#201812', light: '#FFFFFF' },
        });
        downloadDataUrl(dataUrl, `prego-${location.slug}-tisch-${table}.png`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-2xl border border-ivory/10 bg-carta p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-extrabold">{location.name}</p>
          <p className="text-sm text-ivory/55">
            /l/{location.slug} · {location.mode === 'PICKUP' ? 'Abholung' : 'Service am Tisch'} ·{' '}
            <span className={location.active ? 'font-semibold text-oliva' : 'font-semibold text-red-300'}>
              {location.active ? 'aktiv' : 'inaktiv'}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setQrOpen((v) => !v)}
            className="rounded-xl border-2 border-ivory/15 px-3 py-2 text-sm font-bold transition hover:border-ivory/30"
          >
            QR-Codes
          </button>
          <button
            type="button"
            onClick={props.onToggleActive}
            className="rounded-xl border-2 border-ivory/15 px-3 py-2 text-sm font-bold transition hover:border-ivory/30"
          >
            {location.active ? 'Deaktivieren' : 'Aktivieren'}
          </button>
        </div>
      </div>

      {qrOpen && (
        <div className="mt-4 rounded-xl bg-ivory/5 p-4">
          <p className="text-sm font-semibold">Gast-Link: <span className="font-mono text-ivory/70">{guestUrl}</span></p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void downloadBaseQr()}
              disabled={busy}
              className="rounded-xl bg-ivory px-4 py-2 text-sm font-bold text-noir transition hover:bg-ivory/80 disabled:opacity-50"
            >
              Standort-QR herunterladen
            </button>
            {location.mode === 'SERVICE' && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold" htmlFor={`tables-${location.id}`}>Tische:</label>
                <input
                  id={`tables-${location.id}`}
                  type="number"
                  min={1}
                  max={200}
                  value={tableCount}
                  onChange={(e) => setTableCount(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
                  className="w-20 rounded-lg border-2 border-ivory/15 px-2 py-1.5 text-sm focus:border-champagne focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void downloadTableQrs()}
                  disabled={busy}
                  className="rounded-xl bg-ivory px-4 py-2 text-sm font-bold text-noir transition hover:bg-ivory/80 disabled:opacity-50"
                >
                  {busy ? 'Erzeuge …' : 'Tisch-QRs herunterladen'}
                </button>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-ivory/50">
            {location.mode === 'SERVICE'
              ? 'Jeder Tisch bekommt einen eigenen QR-Code (…?t=Tischnummer) – die Bestellung landet mit Tischnummer auf dem Board.'
              : 'Diesen QR-Code am Tresen und auf Aufstellern platzieren.'}
          </p>
        </div>
      )}
    </li>
  );
}
