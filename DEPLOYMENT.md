# prego. – Deployment auf Plesk

## 1. Voraussetzungen

- Plesk mit Node.js-Extension (Node 20+)
- PostgreSQL-Datenbank (in Plesk anlegen: DB `prego`, eigener User)
- Subdomain, z. B. `prego.planyvo.com`
- Stripe-Account (Platform) mit aktiviertem **Connect**

## 2. Stripe vorbereiten (einmalig, im Stripe-Dashboard)

| Schritt | Wo | Ergebnis |
|---|---|---|
| Connect aktivieren | Einstellungen → Connect → Express | Bars können onboarden |
| Produkt + Preis anlegen | Produktkatalog → „prego Monatsabo" (recurring) | `STRIPE_PRICE_ID_MONTHLY` |
| Webhook anlegen | Entwickler → Webhooks → `https://prego.planyvo.com/api/stripe/webhook` | `STRIPE_WEBHOOK_SECRET` |

**Webhook-Events aktivieren:** `payment_intent.succeeded`, `payment_intent.payment_failed`,
`account.updated`, `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

## 3. VAPID-Keys für Web Push generieren (einmalig, lokal)

```bash
npx web-push generate-vapid-keys
```

Public + Private Key in die Server-Env übernehmen. Ohne Keys läuft alles – nur ohne Push (SSE-Status bleibt).

## 4. Build & Upload

```bash
# Lokal (oder CI):
cd client && echo "VITE_STRIPE_PUBLISHABLE_KEY=pk_live_..." > .env
npm run build                        # im Root-Verzeichnis
```

Hochladen (ohne node_modules): `server/` inkl. `dist/`, `public/`, `prisma/`, `app.js`, `package.json`.

## 5. Plesk Node.js-App einrichten

| Einstellung | Wert |
|---|---|
| Document Root | `/prego/server/public` |
| Application Root | `/prego/server` |
| Application Startup File | `app.js` |
| Node.js Version | 20+ |

**Umgebungsvariablen in Plesk setzen** (siehe `server/.env.example`):
`DATABASE_URL`, `APP_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_PRICE_ID_MONTHLY`, `PLATFORM_FEE_PERCENT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

Dann per SSH im Application Root:

```bash
npm install --production=false   # Prisma CLI wird gebraucht
npx prisma migrate deploy        # Tabellen anlegen
npx prisma generate
npm run prisma:seed              # optional: Demo-Daten
```

App in Plesk **neu starten** („Restart App").

## 6. Wichtig für SSE hinter Nginx/Plesk

Falls Statusseiten oder das Board keine Live-Updates zeigen, in Plesk unter
**Apache & nginx Einstellungen → Zusätzliche nginx-Anweisungen**:

```nginx
proxy_buffering off;
proxy_read_timeout 3600s;
```

(Der Server sendet zusätzlich alle 25 s Heartbeats und der Client hat einen 30-s-Refetch als Sicherheitsnetz.)

## 7. Go-Live-Checkliste

- [ ] `https://…/api/health` liefert `{"ok":true}`
- [ ] Admin-Konto registriert, Standort angelegt, PIN gesetzt
- [ ] Stripe Connect Onboarding durchlaufen → Status „Aktiv"
- [ ] Test-Bestellung mit Stripe-Testkarte `4242 4242 4242 4242` (im Testmodus)
- [ ] Webhook-Log in Stripe: Events kommen mit `200` an
- [ ] QR-Code gedruckt und gescannt – Ende-zu-Ende-Test mit zwei Geräten (Gast + Board)
