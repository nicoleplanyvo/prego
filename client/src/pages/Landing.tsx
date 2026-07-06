import { Link } from 'react-router-dom';

const STEPS = [
  {
    step: '01',
    title: 'Scannen',
    text: 'Gast scannt den QR-Code am Tresen oder auf dem Tisch – keine App, kein Account, keine Wartezeit.',
  },
  {
    step: '02',
    title: 'Bestellen & bezahlen',
    text: 'Karte durchstöbern, Drinks wählen, mit Apple Pay, Google Pay oder Karte zahlen. Trinkgeld inklusive – zu 100 % für die Bar.',
  },
  {
    step: '03',
    title: 'Abholen oder serviert bekommen',
    text: 'Live-Status auf dem Handy plus Push-Nachricht, sobald der Drink fertig ist. Im Service-Modus kommt er direkt an den Tisch.',
  },
];

const FEATURES = [
  {
    title: 'Live-Board für die Bar',
    text: 'Neu → In Arbeit → Fertig. Jede Bestellung landet in Echtzeit auf dem Board – mit Tischnummer, Name und Anmerkungen.',
  },
  {
    title: 'Trinkgeld eingebaut',
    text: 'Gäste geben mit einem Tap 5, 10 oder 15 % – ohne Kleingeld, ohne peinliche Pause. Geht ungekürzt an die Bar.',
  },
  {
    title: 'Bestellstopp per Knopfdruck',
    text: 'Ansturm an der Bar? Ein Tap auf dem Board pausiert neue Bestellungen, bis das Team wieder Luft hat.',
  },
  {
    title: 'QR-Codes in Sekunden',
    text: 'Standort-QR für den Tresen, nummerierte Tisch-QRs für den Service – direkt aus der Verwaltung, druckfertig.',
  },
  {
    title: 'Geld fließt direkt zu dir',
    text: 'Zahlungen laufen über dein eigenes Stripe-Konto – Auszahlungen kommen direkt von Stripe, nie über Umwege.',
  },
  {
    title: 'Umsatz auf einen Blick',
    text: 'Tagesumsatz, Trinkgeld, Top-Drinks und Verlauf – die Auswertung zeigt nach jedem Event, was gelaufen ist.',
  },
];

export default function Landing(): JSX.Element {
  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-champagne/10 blur-3xl"
        />
        <p className="text-[11px] font-semibold uppercase tracking-luxe text-champagne">
          Order Management für mobile Bars
        </p>
        <h1 className="mt-4 font-display text-7xl font-medium tracking-tight sm:text-8xl">
          prego<span className="text-champagne">.</span>
        </h1>
        <p className="mt-6 max-w-md text-lg font-light leading-relaxed text-ivory/60">
          Deine Gäste bestellen und bezahlen per QR-Code –<br className="hidden sm:block" />
          dein Team mixt, statt zu kassieren.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/admin/login"
            className="bg-ivory px-8 py-4 text-xs font-bold uppercase tracking-[0.2em] text-noir transition hover:bg-champagne focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
          >
            Kostenlos starten
          </Link>
          <Link
            to="/staff"
            className="border border-ivory/25 px-8 py-4 text-xs font-bold uppercase tracking-[0.2em] text-ivory transition hover:border-champagne hover:text-champagne focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
          >
            Barkeeper-Login
          </Link>
        </div>
        <p className="mt-8 text-[11px] uppercase tracking-[0.2em] text-ivory/30">
          Keine Hardware · keine App · in 10 Minuten startklar
        </p>
      </section>

      {/* So funktioniert's */}
      <section className="mx-auto max-w-4xl px-6 py-20">
        <div className="flex items-center gap-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-luxe text-champagne">So funktioniert&rsquo;s</h2>
          <span aria-hidden className="h-px flex-1 bg-ivory/10" />
        </div>
        <div className="mt-10 grid gap-10 sm:grid-cols-3">
          {STEPS.map((item) => (
            <div key={item.step}>
              <p className="font-display text-5xl font-light text-champagne/40">{item.step}</p>
              <h3 className="mt-3 text-lg font-medium text-ivory">{item.title}</h3>
              <p className="mt-2 text-sm font-light leading-relaxed text-ivory/50">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-ivory/10 bg-carta/60">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <div className="flex items-center gap-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-luxe text-champagne">
              Gemacht für den Abend, an dem alles gleichzeitig passiert
            </h2>
            <span aria-hidden className="h-px flex-1 bg-ivory/10" />
          </div>
          <div className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title}>
                <h3 className="text-[15px] font-medium text-ivory">{feature.title}</h3>
                <p className="mt-1.5 text-sm font-light leading-relaxed text-ivory/50">{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Preis */}
      <section className="mx-auto max-w-4xl px-6 py-20">
        <div className="flex items-center gap-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-luxe text-champagne">Faires Modell</h2>
          <span aria-hidden className="h-px flex-1 bg-ivory/10" />
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="border border-ivory/15 bg-carta p-7">
            <p className="font-display text-5xl font-light text-ivory">
              2<span className="text-champagne"> %</span>
            </p>
            <p className="mt-2 text-sm font-medium text-ivory">pro Transaktion</p>
            <p className="mt-2 text-sm font-light leading-relaxed text-ivory/50">
              Nur wenn du verkaufst. Trinkgeld ist ausgenommen – das gehört komplett deinem Team.
            </p>
          </div>
          <div className="border border-ivory/15 bg-carta p-7">
            <p className="font-display text-5xl font-light text-ivory">
              Abo<span className="text-champagne">.</span>
            </p>
            <p className="mt-2 text-sm font-medium text-ivory">monatliche Grundgebühr</p>
            <p className="mt-2 text-sm font-light leading-relaxed text-ivory/50">
              Beliebig viele Standorte, QR-Codes und Events. Monatlich kündbar, verwaltet über Stripe.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative border-t border-ivory/10 px-6 py-24 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-champagne/10 blur-3xl"
        />
        <h2 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">
          Die nächste Schicht läuft mit prego<span className="text-champagne">.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-sm font-light text-ivory/55">
          Konto anlegen, Karte pflegen, QR-Code drucken – fertig vor dem ersten Gast.
        </p>
        <Link
          to="/admin/login"
          className="mt-9 inline-block bg-ivory px-10 py-4 text-xs font-bold uppercase tracking-[0.2em] text-noir transition hover:bg-champagne focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
        >
          Kostenlos starten
        </Link>
        <p className="mt-16 text-[11px] uppercase tracking-[0.2em] text-ivory/25">
          prego. · Bestellen &amp; bezahlen per QR-Code · gemacht für mobile Bars mit Stil
        </p>
      </section>
    </div>
  );
}
