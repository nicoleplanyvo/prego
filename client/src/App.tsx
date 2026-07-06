import { Navigate, Route, Routes } from 'react-router-dom';
import MenuPage from './pages/guest/MenuPage';
import CheckoutPage from './pages/guest/CheckoutPage';
import StatusPage from './pages/guest/StatusPage';
import StaffLogin from './pages/staff/StaffLogin';
import BoardPage from './pages/staff/BoardPage';
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import LocationsAdmin from './pages/admin/LocationsAdmin';
import MenuAdmin from './pages/admin/MenuAdmin';
import StripeAdmin from './pages/admin/StripeAdmin';

export default function App(): JSX.Element {
  return (
    <Routes>
      {/* Gast */}
      <Route path="/l/:slug" element={<MenuPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/o/:token" element={<StatusPage />} />

      {/* Barkeeper */}
      <Route path="/staff" element={<StaffLogin />} />
      <Route path="/staff/board" element={<BoardPage />} />

      {/* Betreiber */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="/admin/locations" replace />} />
        <Route path="locations" element={<LocationsAdmin />} />
        <Route path="menu" element={<MenuAdmin />} />
        <Route path="stripe" element={<StripeAdmin />} />
      </Route>

      <Route path="*" element={<Landing />} />
    </Routes>
  );
}

function Landing(): JSX.Element {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-champagne/10 blur-3xl"
      />
      <p className="text-[11px] font-semibold uppercase tracking-luxe text-champagne">Cocktail Ordering</p>
      <h1 className="mt-4 font-display text-7xl font-medium tracking-tight">
        prego<span className="text-champagne">.</span>
      </h1>
      <p className="mt-5 max-w-sm text-lg font-light leading-relaxed text-ivory/60">
        Bestellen &amp; bezahlen per QR-Code.
        <br />
        Gemacht für mobile Bars mit Stil.
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <a
          href="/admin/login"
          className="bg-ivory px-8 py-4 text-xs font-bold uppercase tracking-[0.2em] text-noir transition hover:bg-champagne focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
        >
          Für Bar-Betreiber
        </a>
        <a
          href="/staff"
          className="border border-ivory/25 px-8 py-4 text-xs font-bold uppercase tracking-[0.2em] text-ivory transition hover:border-champagne hover:text-champagne focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
        >
          Barkeeper-Login
        </a>
      </div>
    </main>
  );
}
