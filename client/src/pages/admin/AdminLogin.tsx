import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setAdminToken } from '../../api';

interface AuthResponse {
  token: string;
  tenant: { id: string; name: string; email: string };
}

export default function AdminLogin(): JSX.Element {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (): Promise<void> => {
    setError(null);
    setLoading(true);
    try {
      const result =
        mode === 'login'
          ? await api<AuthResponse>('/api/auth/login', { method: 'POST', body: { email, password } })
          : await api<AuthResponse>('/api/auth/register', { method: 'POST', body: { name, email, password } });
      setAdminToken(result.token);
      navigate('/admin/locations', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-3xl font-extrabold tracking-tight">
        prego<span className="text-champagne">.</span>
      </h1>
      <p className="mt-1 text-ivory/60">
        {mode === 'login' ? 'Anmelden als Bar-Betreiber.' : 'Neues Betreiber-Konto anlegen.'}
      </p>

      {mode === 'register' && (
        <>
          <label className="mt-6 block text-sm font-semibold" htmlFor="name">
            Name der Bar / Firma
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Bar Aperto"
            className="mt-1 w-full rounded-xl border-2 border-ivory/15 px-4 py-3 focus:border-champagne focus:outline-none"
          />
        </>
      )}

      <label className="mt-4 block text-sm font-semibold" htmlFor="email">
        E-Mail
      </label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="mail@bar.de"
        className="mt-1 w-full rounded-xl border-2 border-ivory/15 px-4 py-3 focus:border-champagne focus:outline-none"
      />

      <label className="mt-4 block text-sm font-semibold" htmlFor="password">
        Passwort
      </label>
      <input
        id="password"
        type="password"
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="mind. 8 Zeichen"
        className="mt-1 w-full rounded-xl border-2 border-ivory/15 px-4 py-3 focus:border-champagne focus:outline-none"
      />

      {error && <p className="mt-3 rounded-xl bg-red-950/50 px-4 py-3 text-sm font-medium text-red-300">{error}</p>}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={loading || email.length === 0 || password.length < (mode === 'register' ? 8 : 1) || (mode === 'register' && name.length < 2)}
        className="mt-6 rounded-2xl bg-champagne px-5 py-4 text-lg font-bold text-noir transition hover:bg-champagne-dark disabled:opacity-50"
      >
        {loading ? 'Einen Moment …' : mode === 'login' ? 'Anmelden' : 'Konto anlegen'}
      </button>

      <button
        type="button"
        onClick={() => {
          setMode((m) => (m === 'login' ? 'register' : 'login'));
          setError(null);
        }}
        className="mt-4 text-sm font-semibold text-ivory/60 underline-offset-2 hover:underline"
      >
        {mode === 'login' ? 'Noch kein Konto? Jetzt registrieren' : 'Schon registriert? Anmelden'}
      </button>
    </main>
  );
}
