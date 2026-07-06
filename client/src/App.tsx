import { Navigate, Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing';
import MenuPage from './pages/guest/MenuPage';
import CheckoutPage from './pages/guest/CheckoutPage';
import StatusPage from './pages/guest/StatusPage';
import StaffLogin from './pages/staff/StaffLogin';
import BoardPage from './pages/staff/BoardPage';
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import LocationsAdmin from './pages/admin/LocationsAdmin';
import MenuAdmin from './pages/admin/MenuAdmin';
import BrandingAdmin from './pages/admin/BrandingAdmin';
import StatsAdmin from './pages/admin/StatsAdmin';
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
        <Route path="design" element={<BrandingAdmin />} />
        <Route path="stats" element={<StatsAdmin />} />
        <Route path="stripe" element={<StripeAdmin />} />
      </Route>

      <Route path="*" element={<Landing />} />
    </Routes>
  );
}
