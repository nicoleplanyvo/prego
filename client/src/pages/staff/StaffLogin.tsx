import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setStaffSession, type StaffLocationInfo } from '../../api';

interface StaffLoginResponse {
  token: string;
  location: StaffLocationInfo;
}

export default function StaffLogin(): JSX.Element {
  const navigate = useNavigate();
  const [slug, setSlug] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (): Promise<void> => {
    setError(null);
    setLoading(true);
    try {
      const result = await api<StaffLoginResponse>('/api/staff/login', {
        method: 'POST',
        body: { locationSlug: slug.trim().toLowerCase(), pin: pin.trim() },
      });
      setStaffSession(result.token, result.location);
      navigate('/staff/board', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="text-[11px] font-semibold uppercase tracking-luxe text-champagne">Bar-Zugang</p>
      <h1 className="mt-2 font-display text-5xl font-medium tracking-tight">
        prego<span className="text-champagne">.</span>
      </h1>
      <p className="mt-3 font-light text-ivory/50">Standort-Kürzel und Schicht-PIN eingeben.</p>

      <label className="mt-10 block text-[11px] font-semibold uppercase tracking-[0.2em] text-ivory/60" htmlFor="slug">
        Standort
      </label>
      <input
        id="slug"
        type="text"
        autoCapitalize="none"
        autoComplete="off"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder="z. B. sommer-gala"
        className="mt-2 w-full border-b border-ivory/20 bg-transparent px-0 py-3 text-lg font-light text-ivory placeholder:text-ivory/25 focus:border-champagne focus:outline-none"
      />

      <label className="mt-7 block text-[11px] font-semibold uppercase tracking-[0.2em] text-ivory/60" htmlFor="pin">
        PIN
      </label>
      <input
        id="pin"
        type="password"
        inputMode="numeric"
        pattern="\d*"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        placeholder="••••"
        className="mt-2 w-full border-b border-ivory/20 bg-transparent px-0 py-3 text-lg tracking-[0.5em] text-ivory placeholder:text-ivory/25 focus:border-champagne focus:outline-none"
      />

      {error && <p className="mt-4 border border-red-400/40 bg-red-950/50 px-4 py-3 text-sm text-red-300">{error}</p>}

      <button
        type="button"
        onClick={() => void handleLogin()}
        disabled={loading || slug.trim().length === 0 || pin.trim().length < 4}
        className="mt-10 h-14 bg-ivory text-sm font-bold uppercase tracking-[0.2em] text-noir transition hover:bg-champagne disabled:opacity-40"
      >
        {loading ? 'Anmelden …' : 'Schicht starten'}
      </button>
    </main>
  );
}
