import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { brandingStyle, DEFAULT_ACCENT, DEFAULT_BG } from '../../branding';
import type { Branding, TenantMe } from '../../types';

const MAX_LOGO_DATA_URL = 400_000; // ~300 KB Binärdaten als Base64

export default function BrandingAdmin(): JSX.Element {
  const queryClient = useQueryClient();
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [bg, setBg] = useState(DEFAULT_BG);
  const [logo, setLogo] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: me, isLoading } = useQuery({
    queryKey: ['admin-me'],
    queryFn: () => api<TenantMe>('/api/admin/me', { auth: 'admin' }),
  });

  // Gespeicherten Stand ins Formular laden (nur solange nichts geändert wurde)
  useEffect(() => {
    if (me && !dirty) {
      setAccent(me.brandAccent ?? DEFAULT_ACCENT);
      setBg(me.brandBg ?? DEFAULT_BG);
      setLogo(me.logoDataUrl);
    }
  }, [me, dirty]);

  const save = useMutation({
    mutationFn: (branding: { logoDataUrl: string | null; brandAccent: string | null; brandBg: string | null }) =>
      api<Branding>('/api/admin/branding', { method: 'PATCH', auth: 'admin', body: branding }),
    onSuccess: () => {
      setDirty(false);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-me'] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.'),
  });

  const handleLogoFile = async (file: File): Promise<void> => {
    setError(null);
    try {
      const dataUrl = await fileToLogoDataUrl(file);
      if (dataUrl.length > MAX_LOGO_DATA_URL) {
        setError('Logo ist auch nach Verkleinerung zu groß. Bitte ein einfacheres Bild verwenden.');
        return;
      }
      setLogo(dataUrl);
      setDirty(true);
    } catch {
      setError('Logo konnte nicht gelesen werden. PNG, JPG, WebP oder SVG verwenden.');
    }
  };

  if (isLoading || !me) return <p className="text-ivory/60">Design wird geladen …</p>;

  const preview: Branding = {
    logoDataUrl: logo,
    accent: accent === DEFAULT_ACCENT ? null : accent,
    bg: bg === DEFAULT_BG ? null : bg,
  };

  return (
    <div>
      <h2 className="text-lg font-extrabold">Design</h2>
      <p className="mt-1 text-sm text-ivory/55">
        Logo und Farben erscheinen auf allen Gast-Seiten (Speisekarte, Bezahlen, Status) – deine Bar, dein Auftritt.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-ivory/10 bg-carta p-5 shadow-sm">
          <h3 className="font-bold">Logo</h3>
          {logo ? (
            <div className="mt-3 flex items-center gap-4">
              <img src={logo} alt="Logo-Vorschau" className="max-h-16 max-w-[180px] rounded bg-ivory/5 object-contain p-2" />
              <button
                type="button"
                onClick={() => {
                  setLogo(null);
                  setDirty(true);
                }}
                className="rounded-lg border-2 border-ivory/15 px-3 py-2 text-sm font-bold text-red-300 transition hover:border-red-400/60"
              >
                Entfernen
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-ivory/45">Noch kein Logo hochgeladen.</p>
          )}
          <label className="mt-4 inline-block cursor-pointer rounded-xl border-2 border-ivory/15 px-4 py-2.5 text-sm font-bold transition hover:border-ivory/30">
            {logo ? 'Anderes Logo wählen' : 'Logo hochladen'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleLogoFile(file);
                e.target.value = '';
              }}
            />
          </label>
          <p className="mt-2 text-xs text-ivory/45">PNG, JPG, WebP oder SVG · wird automatisch verkleinert (max. ~300 KB).</p>

          <h3 className="mt-6 font-bold">Farben</h3>
          <div className="mt-3 space-y-3">
            <ColorField
              label="Akzentfarbe"
              hint="Buttons, Preise, Hervorhebungen"
              value={accent}
              onChange={(value) => {
                setAccent(value);
                setDirty(true);
              }}
            />
            <ColorField
              label="Hintergrund"
              hint="Seitenhintergrund der Gast-Ansicht"
              value={bg}
              onChange={(value) => {
                setBg(value);
                setDirty(true);
              }}
            />
          </div>

          {error && <p className="mt-4 rounded-xl bg-red-950/50 px-4 py-2 text-sm font-medium text-red-300">{error}</p>}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                save.mutate({
                  logoDataUrl: logo,
                  brandAccent: accent === DEFAULT_ACCENT ? null : accent,
                  brandBg: bg === DEFAULT_BG ? null : bg,
                })
              }
              disabled={save.isPending || !dirty}
              className="rounded-xl bg-champagne px-5 py-3 font-bold text-noir transition hover:bg-champagne-dark disabled:opacity-50"
            >
              {save.isPending ? 'Wird gespeichert …' : 'Speichern'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAccent(DEFAULT_ACCENT);
                setBg(DEFAULT_BG);
                setLogo(null);
                setDirty(true);
              }}
              className="rounded-xl border-2 border-ivory/15 px-4 py-3 font-bold transition hover:border-ivory/30"
            >
              Auf prego-Look zurücksetzen
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-ivory/10 bg-carta p-5 shadow-sm">
          <h3 className="font-bold">Vorschau</h3>
          <div style={brandingStyle(preview)} className="mt-3 overflow-hidden rounded-xl border border-ivory/10 bg-noir p-5">
            {logo && <img src={logo} alt="" className="mb-3 max-h-10 max-w-[140px] object-contain" />}
            <p className="text-[11px] font-semibold uppercase tracking-luxe text-champagne">{me.name}</p>
            <h4 className="mt-1 font-display text-2xl font-medium tracking-tight text-ivory">Sommerfest</h4>
            <div className="mt-4 flex items-center justify-between border-b border-ivory/10 pb-3">
              <div>
                <p className="font-medium text-ivory">Aperol Spritz</p>
                <p className="font-display text-sm italic text-champagne">8,50 €</p>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-full border border-champagne bg-champagne/10 text-champagne">
                +
              </span>
            </div>
            <button type="button" className="mt-4 h-11 w-full bg-ivory text-xs font-bold uppercase tracking-[0.2em] text-noir">
              Bezahlen · 8,50 €
            </button>
          </div>
          <p className="mt-3 text-xs text-ivory/45">
            So sieht die Speisekarte für Gäste aus. Auf ausreichenden Kontrast zwischen Hintergrund und Akzentfarbe achten.
          </p>
        </section>
      </div>
    </div>
  );
}

function ColorField(props: { label: string; hint: string; value: string; onChange: (value: string) => void }): JSX.Element {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl bg-ivory/5 px-4 py-3">
      <span>
        <span className="block text-sm font-semibold">{props.label}</span>
        <span className="block text-xs text-ivory/45">{props.hint}</span>
      </span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-xs uppercase text-ivory/55">{props.value}</span>
        <input
          type="color"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          aria-label={props.label}
          className="h-10 w-14 cursor-pointer rounded border-2 border-ivory/15 bg-transparent"
        />
      </span>
    </label>
  );
}

/** Bild einlesen und auf max. 512 px verkleinern; SVG bleibt unverändert. */
async function fileToLogoDataUrl(file: File): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
  if (file.type === 'image/svg+xml') return raw;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('decode failed'));
    el.src = raw;
  });
  const maxEdge = 512;
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas failed');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}
