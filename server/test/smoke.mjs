/**
 * API-Smoke-Test gegen einen laufenden Server mit Seed-Daten.
 * Läuft ohne Test-Framework: `node test/smoke.mjs` (API_URL überschreibbar).
 * Stripe-Aufrufe (Bestellung anlegen, Refund) brauchen echte Keys und sind bewusst ausgespart.
 */
const BASE = process.env.API_URL ?? 'http://localhost:3300';

let failures = 0;

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${name}${detail ? ` – ${detail}` : ''}`);
  }
}

async function request(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* CSV o. Ä. */
  }
  return { status: res.status, json, text };
}

console.log(`Smoke-Test gegen ${BASE}`);

// --- Health ---
{
  const { status, json } = await request('/api/health');
  check('health', status === 200 && json?.ok === true);
}

// --- Öffentliche Speisekarte ---
{
  const { status, json } = await request('/api/public/locations/sommerfest');
  check('public menu erreichbar', status === 200);
  check('public menu: acceptingOrders vorhanden', typeof json?.acceptingOrders === 'boolean');
  check('public menu: queueSize vorhanden', typeof json?.queueSize === 'number');
  check('public menu: branding vorhanden', json?.branding !== undefined);
  check('public menu: Kategorien vorhanden', Array.isArray(json?.categories) && json.categories.length > 0);
}

// --- Staff: Login, Bestellstopp, wieder öffnen ---
let staffToken = null;
{
  const { status, json } = await request('/api/staff/login', {
    method: 'POST',
    body: { locationSlug: 'sommerfest', pin: '4711' },
  });
  check('staff login', status === 200 && typeof json?.token === 'string');
  staffToken = json?.token ?? null;
}
if (staffToken) {
  const paused = await request('/api/staff/location', {
    method: 'PATCH',
    token: staffToken,
    body: { acceptingOrders: false },
  });
  check('bestellstopp setzen', paused.status === 200 && paused.json?.acceptingOrders === false);

  const rejected = await request('/api/public/orders', {
    method: 'POST',
    body: { locationSlug: 'sommerfest', tipCents: 0, items: [{ menuItemId: 'x', quantity: 1 }] },
  });
  check('bestellung während bestellstopp abgelehnt', rejected.status === 409);

  const reopened = await request('/api/staff/location', {
    method: 'PATCH',
    token: staffToken,
    body: { acceptingOrders: true },
  });
  check('bestellstopp aufheben', reopened.status === 200 && reopened.json?.acceptingOrders === true);
}

// --- Admin: Login, Stats, Bestellliste, Branding, Menü-Pflege, CSV ---
let adminToken = null;
{
  const { status, json } = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'demo@prego.app', password: 'prego2026!' },
  });
  check('admin login', status === 200 && typeof json?.token === 'string');
  adminToken = json?.token ?? null;
}
if (adminToken) {
  const stats = await request('/api/admin/stats?days=7', { token: adminToken });
  check('admin stats', stats.status === 200 && typeof stats.json?.today?.revenueCents === 'number');
  check('admin stats: 7 Tages-Eimer', stats.json?.byDay?.length === 7);

  const orders = await request('/api/admin/orders?days=7', { token: adminToken });
  check('admin bestellliste', orders.status === 200 && Array.isArray(orders.json));

  const branding = await request('/api/admin/branding', {
    method: 'PATCH',
    token: adminToken,
    body: { brandAccent: '#E5484D', brandBg: '#101418' },
  });
  check('branding speichern', branding.status === 200 && branding.json?.brandAccent === '#E5484D');

  const badBranding = await request('/api/admin/branding', {
    method: 'PATCH',
    token: adminToken,
    body: { brandAccent: 'rot' },
  });
  check('branding: ungültige farbe abgelehnt', badBranding.status === 400);

  const publicBranding = await request('/api/public/locations/sommerfest');
  check('branding beim gast sichtbar', publicBranding.json?.branding?.accent === '#E5484D');

  await request('/api/admin/branding', {
    method: 'PATCH',
    token: adminToken,
    body: { logoDataUrl: null, brandAccent: null, brandBg: null },
  });

  const menu = await request(`/api/admin/locations/${publicBranding.json?.id}/menu`, { token: adminToken });
  const item = menu.json?.[0]?.items?.[0];
  check('admin menü lesbar', menu.status === 200 && Boolean(item));
  if (item) {
    const edited = await request(`/api/admin/items/${item.id}`, {
      method: 'PATCH',
      token: adminToken,
      body: { priceCents: item.priceCents + 10 },
    });
    check('artikel-preis änderbar', edited.status === 200 && edited.json?.priceCents === item.priceCents + 10);
    await request(`/api/admin/items/${item.id}`, {
      method: 'PATCH',
      token: adminToken,
      body: { priceCents: item.priceCents },
    });
  }

  const csv = await request('/api/admin/export.csv?days=30', { token: adminToken });
  check('csv-export', csv.status === 200 && csv.text.includes('Datum;Uhrzeit;Standort'));
}

console.log(failures === 0 ? '\nAlle Smoke-Tests bestanden.' : `\n${failures} Test(s) fehlgeschlagen.`);
process.exit(failures === 0 ? 0 : 1);
