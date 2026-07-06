import { Router, raw } from 'express';
import type Stripe from 'stripe';
import { prisma } from '../lib/prisma';
import { stripe } from '../lib/stripe';
import { requireAdmin } from '../middleware/auth';
import { ApiError, asyncHandler } from '../middleware/error';
import { emitLocationEvent, emitOrderEvent } from '../lib/events';
import { config } from '../config';

export const stripeRouter = Router();

/** Stripe Connect Express Onboarding starten (oder fortsetzen). */
stripeRouter.post(
  '/connect/onboard',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.admin!.tenantId } });
    if (!tenant) throw new ApiError(404, 'Konto nicht gefunden.');

    let accountId = tenant.stripeAccountId;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: tenant.email,
        business_profile: { name: tenant.name, product_description: 'Getränkeverkauf mobile Bar' },
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      });
      accountId = account.id;
      await prisma.tenant.update({ where: { id: tenant.id }, data: { stripeAccountId: accountId } });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${config.APP_URL}/admin/stripe?refresh=1`,
      return_url: `${config.APP_URL}/admin/stripe?onboarded=1`,
      type: 'account_onboarding',
    });
    res.json({ url: link.url });
  })
);

/** Connect-Status aktualisieren (nach Rückkehr vom Onboarding). */
stripeRouter.get(
  '/connect/status',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.admin!.tenantId } });
    if (!tenant) throw new ApiError(404, 'Konto nicht gefunden.');
    if (!tenant.stripeAccountId) {
      res.json({ connected: false, chargesEnabled: false });
      return;
    }
    const account = await stripe.accounts.retrieve(tenant.stripeAccountId);
    const chargesEnabled = account.charges_enabled === true;
    if (chargesEnabled !== tenant.stripeChargesEnabled) {
      await prisma.tenant.update({ where: { id: tenant.id }, data: { stripeChargesEnabled: chargesEnabled } });
    }
    res.json({ connected: true, chargesEnabled });
  })
);

/** Monatliche prego-Gebühr: Stripe Billing Checkout auf Platform-Level. */
stripeRouter.post(
  '/billing/checkout',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.admin!.tenantId } });
    if (!tenant) throw new ApiError(404, 'Konto nicht gefunden.');

    let customerId = tenant.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: tenant.email,
        name: tenant.name,
        metadata: { tenantId: tenant.id },
      });
      customerId = customer.id;
      await prisma.tenant.update({ where: { id: tenant.id }, data: { stripeCustomerId: customerId } });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: config.STRIPE_PRICE_ID_MONTHLY, quantity: 1 }],
      success_url: `${config.APP_URL}/admin/stripe?subscribed=1`,
      cancel_url: `${config.APP_URL}/admin/stripe`,
      metadata: { tenantId: tenant.id },
    });
    if (!session.url) throw new ApiError(500, 'Checkout-Session konnte nicht erstellt werden.');
    res.json({ url: session.url });
  })
);

/** Stripe Customer Portal (Zahlungsmethode, Kündigung). */
stripeRouter.post(
  '/billing/portal',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.admin!.tenantId } });
    if (!tenant?.stripeCustomerId) throw new ApiError(409, 'Noch kein Abo vorhanden.');
    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${config.APP_URL}/admin/stripe`,
    });
    res.json({ url: session.url });
  })
);

/** Webhook – MUSS mit express.raw gemountet werden (Signatur-Verifikation). */
export const stripeWebhookHandler = [
  raw({ type: 'application/json' }),
  asyncHandler(async (req, res): Promise<void> => {
    const signature = req.headers['stripe-signature'];
    if (typeof signature !== 'string') throw new ApiError(400, 'Signatur fehlt.');

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body as Buffer, signature, config.STRIPE_WEBHOOK_SECRET);
    } catch {
      throw new ApiError(400, 'Ungültige Webhook-Signatur.');
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object;
        const orderId = intent.metadata.orderId;
        if (orderId) {
          const order = await prisma.order.findUnique({ where: { id: orderId } });
          if (order && order.status === 'PENDING_PAYMENT') {
            const updated = await prisma.order.update({
              where: { id: orderId },
              data: { status: 'NEW' },
              select: {
                id: true,
                number: true,
                mode: true,
                status: true,
                tableLabel: true,
                guestName: true,
                subtotalCents: true,
                createdAt: true,
                items: { select: { id: true, name: true, quantity: true, note: true } },
              },
            });
            emitLocationEvent(order.locationId, { type: 'order.new', order: updated });
            emitOrderEvent(orderId, { type: 'status', status: 'NEW' });
          }
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object;
        const orderId = intent.metadata.orderId;
        if (orderId) {
          emitOrderEvent(orderId, { type: 'payment_failed' });
        }
        break;
      }
      case 'account.updated': {
        const account = event.data.object;
        await prisma.tenant.updateMany({
          where: { stripeAccountId: account.id },
          data: { stripeChargesEnabled: account.charges_enabled === true },
        });
        break;
      }
      case 'checkout.session.completed': {
        const session = event.data.object;
        const tenantId = session.metadata?.tenantId;
        if (tenantId && session.mode === 'subscription' && typeof session.subscription === 'string') {
          await prisma.tenant.update({
            where: { id: tenantId },
            data: { stripeSubscriptionId: session.subscription, subscriptionStatus: 'active' },
          });
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await prisma.tenant.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: { subscriptionStatus: subscription.status },
        });
        break;
      }
      default:
        break;
    }

    res.json({ received: true });
  }),
];
