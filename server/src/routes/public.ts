import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import type { PushSubscription } from 'web-push';
import { prisma } from '../lib/prisma';
import { stripe, calcPlatformFeeCents } from '../lib/stripe';
import { emitLocationEvent, subscribeSse } from '../lib/events';
import { isPushEnabled, pushSubscriptionSchema } from '../lib/push';
import { ApiError, asyncHandler } from '../middleware/error';
import { orderCreateSchema } from '../schemas';
import { config } from '../config';

export const publicRouter = Router();

/** Branding-Felder des Tenants in die kompakte Client-Form bringen. */
function brandingOf(tenant: { logoDataUrl: string | null; brandAccent: string | null; brandBg: string | null }) {
  return { logoDataUrl: tenant.logoDataUrl, accent: tenant.brandAccent, bg: tenant.brandBg };
}

const orderPublicSelect = {
  id: true,
  publicToken: true,
  number: true,
  mode: true,
  status: true,
  tableLabel: true,
  guestName: true,
  subtotalCents: true,
  tipCents: true,
  currency: true,
  createdAt: true,
  refundedAt: true,
  items: { select: { id: true, name: true, priceCents: true, quantity: true, note: true } },
} satisfies Prisma.OrderSelect;

/** Öffentliche Speisekarte für die Gast-Ansicht (QR-Ziel). */
publicRouter.get(
  '/locations/:slug',
  asyncHandler(async (req, res) => {
    const location = await prisma.location.findUnique({
      where: { slug: req.params.slug as string },
      select: {
        id: true,
        name: true,
        slug: true,
        mode: true,
        active: true,
        acceptingOrders: true,
        currency: true,
        tenant: {
          select: { name: true, stripeChargesEnabled: true, logoDataUrl: true, brandAccent: true, brandBg: true },
        },
        categories: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            items: {
              where: { available: true },
              orderBy: { sortOrder: 'asc' },
              select: { id: true, name: true, description: true, priceCents: true },
            },
          },
        },
      },
    });
    if (!location || !location.active) throw new ApiError(404, 'Diese Bar ist gerade nicht aktiv.');
    const queueSize = await prisma.order.count({
      where: { locationId: location.id, status: { in: ['NEW', 'IN_PROGRESS'] } },
    });
    res.json({
      id: location.id,
      name: location.name,
      queueSize,
      slug: location.slug,
      mode: location.mode,
      acceptingOrders: location.acceptingOrders,
      currency: location.currency,
      barName: location.tenant.name,
      branding: brandingOf(location.tenant),
      paymentsReady: location.tenant.stripeChargesEnabled,
      pushAvailable: isPushEnabled(),
      vapidPublicKey: isPushEnabled() ? config.VAPID_PUBLIC_KEY : null,
      categories: location.categories.filter((c) => c.items.length > 0),
    });
  })
);

/** Bestellung anlegen + Stripe PaymentIntent (Destination Charge, 2 % Plattform-Fee). */
publicRouter.post(
  '/orders',
  asyncHandler(async (req, res) => {
    const body = orderCreateSchema.parse(req.body);
    const location = await prisma.location.findUnique({
      where: { slug: body.locationSlug },
      include: { tenant: true },
    });
    if (!location || !location.active) throw new ApiError(404, 'Diese Bar ist gerade nicht aktiv.');
    if (!location.acceptingOrders) {
      throw new ApiError(409, 'Bestellstopp – die Bar nimmt gerade keine neuen Bestellungen an. Bitte gleich nochmal versuchen.');
    }
    if (!location.tenant.stripeAccountId || !location.tenant.stripeChargesEnabled) {
      throw new ApiError(409, 'Diese Bar kann aktuell keine Zahlungen annehmen.');
    }

    const itemIds = body.items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: itemIds }, available: true, category: { locationId: location.id } },
    });
    const menuById = new Map(menuItems.map((m) => [m.id, m]));

    let subtotalCents = 0;
    const orderItems: { menuItemId: string; name: string; priceCents: number; quantity: number; note: string | null }[] = [];
    for (const line of body.items) {
      const menuItem = menuById.get(line.menuItemId);
      if (!menuItem) throw new ApiError(409, 'Ein Artikel ist nicht mehr verfügbar. Bitte Warenkorb prüfen.');
      subtotalCents += menuItem.priceCents * line.quantity;
      orderItems.push({
        menuItemId: menuItem.id,
        name: menuItem.name,
        priceCents: menuItem.priceCents,
        quantity: line.quantity,
        note: line.note ?? null,
      });
    }
    if (subtotalCents < 50) throw new ApiError(400, 'Mindestbestellwert ist 0,50 €.');

    // Trinkgeld geht zu 100 % an die Bar – die Plattform-Fee wird nur auf die Bestellsumme berechnet.
    const tipCents = Math.min(body.tipCents, subtotalCents);
    const totalCents = subtotalCents + tipCents;
    const feeCents = calcPlatformFeeCents(subtotalCents);

    const order = await prisma.$transaction(async (tx) => {
      const counted = await tx.location.update({
        where: { id: location.id },
        data: { orderCounter: { increment: 1 } },
        select: { orderCounter: true },
      });
      return tx.order.create({
        data: {
          locationId: location.id,
          number: counted.orderCounter,
          mode: location.mode,
          tableLabel: location.mode === 'SERVICE' ? (body.tableLabel ?? null) : null,
          guestName: body.guestName ?? null,
          subtotalCents,
          tipCents,
          feeCents,
          currency: location.currency,
          items: { create: orderItems },
        },
        select: { ...orderPublicSelect },
      });
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: location.currency,
      automatic_payment_methods: { enabled: true },
      application_fee_amount: feeCents,
      transfer_data: { destination: location.tenant.stripeAccountId },
      description: `prego #${order.number} – ${location.name}`,
      metadata: { orderId: order.id, locationId: location.id },
    });

    await prisma.order.update({ where: { id: order.id }, data: { paymentIntentId: paymentIntent.id } });

    res.status(201).json({
      order,
      clientSecret: paymentIntent.client_secret,
    });
  })
);

/** Bestellstatus für die Gast-Statusseite. */
publicRouter.get(
  '/orders/:token',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { publicToken: req.params.token as string },
      select: {
        ...orderPublicSelect,
        locationId: true,
        location: {
          select: {
            name: true,
            tenant: { select: { logoDataUrl: true, brandAccent: true, brandBg: true } },
          },
        },
      },
    });
    if (!order) throw new ApiError(404, 'Bestellung nicht gefunden.');
    // Warteschlange: ältere, noch offene Bestellungen desselben Standorts
    const queueAhead =
      order.status === 'NEW' || order.status === 'IN_PROGRESS'
        ? await prisma.order.count({
            where: {
              locationId: order.locationId,
              status: { in: ['NEW', 'IN_PROGRESS'] },
              createdAt: { lt: order.createdAt },
            },
          })
        : 0;
    const { location, locationId: _locationId, ...rest } = order;
    res.json({ ...rest, location: { name: location.name }, branding: brandingOf(location.tenant), queueAhead });
  })
);

/** Fallback: Zahlung clientseitig bestätigt, Webhook evtl. noch unterwegs → Status verifizieren. */
publicRouter.post(
  '/orders/:token/verify-payment',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { publicToken: req.params.token as string } });
    if (!order) throw new ApiError(404, 'Bestellung nicht gefunden.');
    if (order.status === 'PENDING_PAYMENT' && order.paymentIntentId) {
      const intent = await stripe.paymentIntents.retrieve(order.paymentIntentId);
      if (intent.status === 'succeeded') {
        const updated = await prisma.order.update({
          where: { id: order.id },
          data: { status: 'NEW' },
          select: orderPublicSelect,
        });
        emitLocationEvent(order.locationId, { type: 'order.new', orderId: order.id });
        res.json(updated);
        return;
      }
    }
    const fresh = await prisma.order.findUnique({ where: { id: order.id }, select: orderPublicSelect });
    res.json(fresh);
  })
);

/** Live-Status per SSE – Gast lässt den Tab einfach offen. */
publicRouter.get(
  '/orders/:token/stream',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { publicToken: req.params.token as string },
      select: { id: true },
    });
    if (!order) throw new ApiError(404, 'Bestellung nicht gefunden.');
    subscribeSse(res, `order:${order.id}`);
  })
);

/** Öffentlicher VAPID-Public-Key für das Push-Opt-in. */
publicRouter.get('/push/key', (_req, res) => {
  res.json({ enabled: isPushEnabled(), vapidPublicKey: isPushEnabled() ? config.VAPID_PUBLIC_KEY : null });
});

/** Optionales Web-Push-Opt-in für "Abholbereit". */
publicRouter.post(
  '/orders/:token/push',
  asyncHandler(async (req, res) => {
    if (!isPushEnabled()) throw new ApiError(409, 'Push ist auf diesem Server nicht konfiguriert.');
    const subscription: PushSubscription = pushSubscriptionSchema.parse(req.body);
    const order = await prisma.order.findUnique({ where: { publicToken: req.params.token as string } });
    if (!order) throw new ApiError(404, 'Bestellung nicht gefunden.');
    await prisma.order.update({
      where: { id: order.id },
      data: { pushSubscription: subscription as unknown as Prisma.InputJsonValue },
    });
    res.json({ ok: true });
  })
);
