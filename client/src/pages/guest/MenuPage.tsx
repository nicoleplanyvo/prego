import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, euro } from '../../api';
import { useCart, cartTotalCents, cartItemCount } from '../../store/cart';
import type { PublicLocation, PublicOrder } from '../../types';

interface CreateOrderResponse {
  order: PublicOrder;
  clientSecret: string;
}

export default function MenuPage(): JSX.Element {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tableParam = searchParams.get('t');
  const cart = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) cart.setContext(slug, tableParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, tableParam]);

  const { data: location, isLoading, error: loadError } = useQuery({
    queryKey: ['location', slug],
    queryFn: () => api<PublicLocation>(`/api/public/locations/${slug}`),
    enabled: Boolean(slug),
  });

  const totalCents = useMemo(() => cartTotalCents(cart.lines), [cart.lines]);
  const itemCount = useMemo(() => cartItemCount(cart.lines), [cart.lines]);

  const createOrder = useMutation({
    mutationFn: () =>
      api<CreateOrderResponse>('/api/public/orders', {
        method: 'POST',
        body: {
          locationSlug: slug,
          tableLabel: cart.tableLabel ?? undefined,
          items: cart.lines.map((l) => ({
            menuItemId: l.menuItemId,
            quantity: l.quantity,
            note: l.note.trim() ? l.note.trim() : undefined,
          })),
        },
      }),
    onSuccess: (data) => {
      navigate('/checkout', {
        state: {
          clientSecret: data.clientSecret,
          publicToken: data.order.publicToken,
          orderNumber: data.order.number,
          amountCents: data.order.subtotalCents,
          locationName: location?.name ?? '',
        },
      });
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Bestellung fehlgeschlagen.'),
  });

  if (isLoading) {
    return <CenterMessage text="Karte wird geladen …" />;
  }
  if (loadError || !location) {
    return <CenterMessage text={loadError instanceof Error ? loadError.message : 'Bar nicht gefunden.'} />;
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg pb-36">
      <header className="sticky top-0 z-10 border-b border-ivory/10 bg-noir/90 px-6 pb-5 pt-7 backdrop-blur">
        <p className="text-[11px] font-semibold uppercase tracking-luxe text-champagne">{location.barName}</p>
        <h1 className="mt-1.5 font-display text-4xl font-medium tracking-tight">{location.name}</h1>
        {location.mode === 'SERVICE' && cart.tableLabel && (
          <p className="mt-2 text-sm font-light text-ivory/50">Tisch {cart.tableLabel} · wird an Ihren Platz serviert</p>
        )}
        {location.mode === 'PICKUP' && (
          <p className="mt-2 text-sm font-light text-ivory/50">Abholung an der Bar – wir geben Bescheid</p>
        )}
      </header>

      {!location.paymentsReady && (
        <p className="mx-6 mt-5 border border-champagne/30 bg-champagne/10 p-4 text-sm text-champagne">
          Online-Zahlung ist gerade nicht verfügbar. Bitte direkt an der Bar bestellen.
        </p>
      )}

      <main className="px-6">
        {location.categories.map((category) => (
          <section key={category.id} className="mt-9">
            <div className="flex items-center gap-4">
              <h2 className="text-[11px] font-semibold uppercase tracking-luxe text-champagne/90">{category.name}</h2>
              <span aria-hidden className="h-px flex-1 bg-ivory/10" />
            </div>
            <ul className="mt-1">
              {category.items.map((item) => {
                const line = cart.lines.find((l) => l.menuItemId === item.id);
                return (
                  <li key={item.id} className="flex items-center gap-4 border-b border-ivory/[0.07] py-4 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-[17px] font-medium text-ivory">{item.name}</p>
                      {item.description && (
                        <p className="mt-0.5 truncate text-sm font-light text-ivory/45">{item.description}</p>
                      )}
                      <p className="mt-1 font-display text-sm italic text-champagne">{euro(item.priceCents)}</p>
                    </div>
                    {line ? (
                      <QuantityControl
                        quantity={line.quantity}
                        onIncrement={() => cart.increment(item.id)}
                        onDecrement={() => cart.decrement(item.id)}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => cart.add({ menuItemId: item.id, name: item.name, priceCents: item.priceCents })}
                        disabled={!location.paymentsReady}
                        aria-label={`${item.name} hinzufügen`}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-ivory/25 text-xl font-light text-ivory transition hover:border-champagne hover:text-champagne disabled:opacity-30"
                      >
                        +
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>

      {itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-lg px-5 pb-6">
          {cartOpen && (
            <div className="mb-3 max-h-72 overflow-y-auto border border-ivory/15 bg-carta p-5 shadow-2xl shadow-black/60">
              {cart.lines.map((line) => (
                <div key={line.menuItemId} className="border-b border-ivory/[0.07] py-3.5 first:pt-1 last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{line.name}</p>
                    <QuantityControl
                      quantity={line.quantity}
                      onIncrement={() => cart.increment(line.menuItemId)}
                      onDecrement={() => cart.decrement(line.menuItemId)}
                      compact
                    />
                  </div>
                  <input
                    type="text"
                    value={line.note}
                    onChange={(e) => cart.setNote(line.menuItemId, e.target.value)}
                    placeholder="Anmerkung (z. B. ohne Eis)"
                    maxLength={120}
                    className="mt-2 w-full border-b border-ivory/15 bg-transparent px-0 py-1.5 text-sm font-light text-ivory placeholder:text-ivory/30 focus:border-champagne focus:outline-none"
                  />
                </div>
              ))}
            </div>
          )}
          {error && (
            <p className="mb-2 border border-red-400/40 bg-red-950/50 px-4 py-2.5 text-sm text-red-300">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCartOpen((v) => !v)}
              className="border border-ivory/25 bg-noir/85 px-5 text-xs font-bold uppercase tracking-[0.15em] text-ivory backdrop-blur transition hover:border-champagne hover:text-champagne"
              aria-expanded={cartOpen}
            >
              {cartOpen ? 'Schließen' : `${itemCount} Drinks`}
            </button>
            <button
              type="button"
              onClick={() => createOrder.mutate()}
              disabled={createOrder.isPending || !location.paymentsReady}
              className="h-14 flex-1 bg-ivory text-sm font-bold uppercase tracking-[0.2em] text-noir shadow-xl shadow-black/50 transition hover:bg-champagne disabled:opacity-50"
            >
              {createOrder.isPending ? 'Einen Moment …' : `Bezahlen · ${euro(totalCents)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function QuantityControl(props: {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  compact?: boolean;
}): JSX.Element {
  const size = props.compact ? 'h-9 w-9 text-base' : 'h-11 w-11 text-xl';
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <button
        type="button"
        onClick={props.onDecrement}
        aria-label="Menge verringern"
        className={`${size} grid place-items-center rounded-full border border-ivory/25 font-light text-ivory transition hover:border-champagne hover:text-champagne`}
      >
        −
      </button>
      <span className="w-6 text-center font-display text-lg text-champagne" aria-live="polite">
        {props.quantity}
      </span>
      <button
        type="button"
        onClick={props.onIncrement}
        aria-label="Menge erhöhen"
        className={`${size} grid place-items-center rounded-full border border-champagne bg-champagne/10 font-light text-champagne transition hover:bg-champagne hover:text-noir`}
      >
        +
      </button>
    </div>
  );
}

function CenterMessage(props: { text: string }): JSX.Element {
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <p className="text-lg font-light text-ivory/60">{props.text}</p>
    </main>
  );
}
