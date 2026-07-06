import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { getAdminToken, setAdminToken } from '../../api';

const tabs = [
  { to: '/admin/locations', label: 'Standorte' },
  { to: '/admin/menu', label: 'Speisekarte' },
  { to: '/admin/design', label: 'Design' },
  { to: '/admin/stats', label: 'Auswertung' },
  { to: '/admin/stripe', label: 'Stripe & Abo' },
];

export default function AdminLayout(): JSX.Element {
  const navigate = useNavigate();
  const token = getAdminToken();

  useEffect(() => {
    if (!token) navigate('/admin/login', { replace: true });
  }, [token, navigate]);

  if (!token) return <div />;

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-5 pb-16">
      <header className="flex items-center justify-between py-5">
        <h1 className="text-2xl font-extrabold tracking-tight">
          prego<span className="text-champagne">.</span> <span className="text-base font-semibold text-ivory/40">Verwaltung</span>
        </h1>
        <button
          type="button"
          onClick={() => {
            setAdminToken(null);
            navigate('/admin/login', { replace: true });
          }}
          className="rounded-lg border-2 border-ivory/15 px-3 py-2 text-sm font-semibold transition hover:border-ivory/30"
        >
          Abmelden
        </button>
      </header>

      <nav className="flex gap-1 rounded-xl bg-ivory/10 p-1" aria-label="Bereiche">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex-1 rounded-lg px-3 py-2 text-center text-sm font-bold transition ${
                isActive ? 'bg-carta shadow-sm' : 'text-ivory/50 hover:text-ivory/80'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}
