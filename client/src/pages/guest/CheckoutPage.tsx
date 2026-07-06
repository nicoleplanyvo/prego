import { useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { api, euro } from '../../api';
import { useCart } from '../../store/cart';
import type { PublicOrder } from '../../types';

interface CheckoutState {
  clientSecret: string;
  publicToken: string;
  orderNumber: number;
  amountCents: number;
  tipCents: number;
  locationName: string;
}

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

export default function CheckoutPage(): JSX.Element {
  const routerLocation = useLocation();
  const state = routerLocation.state as CheckoutState | null;

  if (!state?.clientSecret || !state.publicToken) {
    return <Navigate to="/" replace />;
  }
  if (!stripePromise) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <p className="text-lg font-light text-ivory/60">
          Stripe ist nicht konfiguriert (VITE_STRIPE_PUBLISHABLE_KEY fehlt).
        </p>
      </main>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: state.clientSecret,
        locale: 'de',
        appearance: {
          theme: 'night',
          variables: {
            colorPrimary: '#C9A96A',
            colorBackground: '#161410',
            colorText: '#F2EDE3',
            borderRadius: '2px',
            fontFamily: 'Manrope, system-ui, sans-serif',
          },
        },
      }}
    >
      <CheckoutForm state={state} />
    </Elements>
  );
}

function CheckoutForm(props: { state: CheckoutState }): JSX.Element {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const clearCart = useCart((s) => s.clear);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusUrl = useMemo(() => `/o/${props.state.publicToken}`, [props.state.publicToken]);

  const handlePay = async (): Promise<void> => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${statusUrl}`,
      },
      redirect: 'if_required',
    });

    if (result.error) {
      setError(result.error.message ?? 'Zahlung fehlgeschlagen. Bitte erneut versuchen.');
      setSubmitting(false);
      return;
    }

    // Webhook kann ein paar Sekunden brauchen → serverseitig verifizieren
    try {
      await api<PublicOrder>(`/api/public/orders/${props.state.publicToken}/verify-payment`, { method: 'POST' });
    } catch {
      /* Statusseite pollt/streamt ohnehin */
    }
    clearCart();
    navigate(statusUrl, { replace: true });
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col px-6 py-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-luxe text-champagne">{props.state.locationName}</p>
        <h1 className="mt-1.5 font-display text-4xl font-medium tracking-tight">
          Bestellung <span className="text-champagne">№ {props.state.orderNumber}</span>
        </h1>
        <p className="mt-2 font-light text-ivory/50">
          Gesamt <span className="font-display italic text-ivory">{euro(props.state.amountCents)}</span>
          {props.state.tipCents > 0 && (
            <span className="ml-2 text-sm text-ivory/40">inkl. {euro(props.state.tipCents)} Trinkgeld</span>
          )}
        </p>
      </header>

      <div className="mt-8 border border-ivory/15 bg-carta p-5">
        <PaymentElement />
      </div>

      {error && <p className="mt-3 border border-red-400/40 bg-red-950/50 px-4 py-3 text-sm text-red-300">{error}</p>}

      <button
        type="button"
        onClick={() => void handlePay()}
        disabled={!stripe || submitting}
        className="mt-8 h-14 bg-ivory text-sm font-bold uppercase tracking-[0.2em] text-noir transition hover:bg-champagne disabled:opacity-50"
      >
        {submitting ? 'Zahlung läuft …' : `${euro(props.state.amountCents)} bezahlen`}
      </button>
      <p className="mt-4 text-center text-[11px] uppercase tracking-[0.2em] text-ivory/30">Sichere Zahlung über Stripe</p>
    </main>
  );
}
