# prego. – Order Management für mobile Bars

Gäste scannen einen QR-Code, bestellen und bezahlen am Handy (Stripe) und werden benachrichtigt,
sobald die Bestellung abholbereit ist – oder der Kellner serviert direkt an den Tisch.

## Die drei Ansichten

| Ansicht | URL | Zweck |
|---|---|---|
| **Gast** | `/l/:slug` (QR-Ziel), `/checkout`, `/o/:token` | Speisekarte, Bezahlen, Live-Status |
| **Barkeeper** | `/staff` → `/staff/board` | PIN-Login, 3-Spalten-Board (Neu / In Arbeit / Fertig), Bestellstopp |
| **Betreiber** | `/admin` | Standorte, Speisekarte, QR-Codes, Umsatz-Auswertung, Stripe & Abo |

## Zwei Betriebsmodi (pro Standort)

| Modus | Ablauf | Benachrichtigung |
|---|---|---|
| **PICKUP** | Gast bestellt → holt am Tresen ab | Live-Statusseite (SSE) + optional Web Push bei „Abholbereit" |
| **SERVICE** | Tisch-QR (`?t=12`) → Kellner serviert | Keine – Tischnummer erscheint auf dem Board |

## Geschäftsmodell (eingebaut)

- **2 % Plattform-Fee pro Transaktion** über Stripe Connect Destination Charges
  (`application_fee_amount`, Geld fließt direkt an das Stripe-Konto der Bar, nie über die Plattform)
- **Monatliche Grundgebühr** über Stripe Billing (Checkout + Customer Portal)
- Fee-Prozentsatz konfigurierbar über `PLATFORM_FEE_PERCENT`
- **Trinkgeld ist Fee-frei**: Gäste wählen beim Bestellen 5/10/15 % – der Betrag fließt ungekürzt an die Bar

## Features für den Betrieb

- **Trinkgeld beim Checkout** – ein Tap, ohne Kleingeld, komplett für die Bar
- **Bestellstopp** – Barkeeper pausiert neue Bestellungen direkt vom Board (und öffnet wieder), der Betreiber sieht es im Admin und kann gegensteuern
- **Umsatz-Auswertung** (`/admin/stats`) – Tagesumsatz, Trinkgeld, Ø Bonwert, 7/14/30-Tage-Verlauf, Top-Drinks, Umsatz je Standort
- **Name für den Aufruf** – Gast kann im Abhol-Modus optional seinen Namen angeben, erscheint auf dem Board

## Stack

| Ebene | Technologie |
|---|---|
| Server | Node 20+ / Express 4 / TypeScript strict / Prisma 5 / PostgreSQL |
| Client | React 18 / Vite 6 / Tailwind 3 / Zustand / React Query |
| Zahlungen | Stripe Connect Express + Payment Element + Billing |
| Realtime | Server-Sent Events (Board-Feed + Gast-Status) |
| Push | Web Push (VAPID), optionales Opt-in |

## Lokal starten

```bash
# 1. Dependencies
cd server && npm install
cd ../client && npm install

# 2. Datenbank + Env
cp server/.env.example server/.env   # Werte eintragen
cd server && npx prisma migrate dev  # legt Tabellen an
npm run prisma:seed                  # Demo-Daten (optional)

# 3. Entwicklung (2 Terminals)
cd server && npm run dev             # API auf :3000
cd client && npm run dev             # Vite auf :5173 (Proxy → :3000)
```

**Demo-Zugänge nach Seed:** Admin `demo@prego.app` / `prego2026!` · Staff-PIN `4711` · Gast `/l/sommerfest`

**Client-Env:** `VITE_STRIPE_PUBLISHABLE_KEY` in `client/.env` setzen (Publishable Key des Platform-Accounts).

## Production Build

```bash
npm run build   # im Root: baut Client → Server → kopiert dist nach server/public
```

Der Server liefert das Client-Build dann selbst aus (SPA-Fallback inklusive) – eine einzige Node-App.

Details zum Plesk-Deployment: siehe `DEPLOYMENT.md`.
