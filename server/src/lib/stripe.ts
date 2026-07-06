import Stripe from 'stripe';
import { config } from '../config';

export const stripe = new Stripe(config.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
});

/** Plattform-Anteil in Cent (Standard: 2 % der Bestellsumme, kaufmännisch gerundet). */
export function calcPlatformFeeCents(subtotalCents: number): number {
  return Math.round((subtotalCents * config.PLATFORM_FEE_PERCENT) / 100);
}
