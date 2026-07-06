import { Router } from 'express';
import bcrypt from 'bcryptjs';
import type { OrderStatus } from '@prisma/client';
import type { PushSubscription } from 'web-push';
import { prisma } from '../lib/prisma';
import { signStaffToken } from '../lib/jwt';
import { requireStaff } from '../middleware/auth';
import { ApiError, asyncHandler } from '../middleware/error';
import { staffLoginSchema, staffStatusSchema } from '../schemas';
import { emitLocationEvent, emitOrderEvent, subscribeSse } from '../lib/events';
import { sendPush } from '../lib/push';
import { config } from '../config';

export const staffRouter = Router();

const boardOrderSelect = {
  id: true,
  number: true,
  mode: true,
  status: true,
  tableLabel: true,
  guestName: true,
  subtotalCents: true,
  createdAt: true,
  items: { select: { id: true, name: true, quantity: true, note: true } },
} as const;

/** PIN-Login pro Standort – kein Account-Gefrickel am Tresen. */
staffRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = staffLoginSchema.parse(req.body);
    const location = await prisma.location.findUnique({ where: { slug: body.locationSlug } });
    if (!location || !(await bcrypt.compare(body.pin, location.staffPinHash))) {
      throw new ApiError(401, 'PIN falsch.');
    }
    res.json({
      token: signStaffToken(location.tenantId, location.id),
      location: { id: location.id, name: location.name, slug: location.slug, mode: location.mode },
    });
  })
);

/** Aktive Bestellungen fürs Board (bezahlt, nicht abgeschlossen). */
staffRouter.get(
  '/orders',
  requireStaff,
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { locationId: req.staff!.locationId, status: { in: ['NEW', 'IN_PROGRESS', 'READY'] } },
      orderBy: { createdAt: 'asc' },
      select: boardOrderSelect,
    });
    res.json(orders);
  })
);

const allowedTransitions: Record<string, OrderStatus[]> = {
  NEW: ['IN_PROGRESS', 'READY', 'CANCELLED'],
  IN_PROGRESS: ['READY', 'CANCELLED'],
  READY: ['COMPLETED'],
};

/** Status weiterschieben: Neu → In Arbeit → Fertig → Abgeholt/Serviert. */
staffRouter.patch(
  '/orders/:id/status',
  requireStaff,
  asyncHandler(async (req, res) => {
    const body = staffStatusSchema.parse(req.body);
    const order = await prisma.order.findFirst({
      where: { id: req.params.id as string, locationId: req.staff!.locationId },
    });
    if (!order) throw new ApiError(404, 'Bestellung nicht gefunden.');

    const allowed = allowedTransitions[order.status] ?? [];
    if (!allowed.includes(body.status)) {
      throw new ApiError(409, `Wechsel von ${order.status} zu ${body.status} nicht möglich.`);
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: body.status },
      select: boardOrderSelect,
    });

    emitLocationEvent(order.locationId, { type: 'order.updated', order: updated });
    emitOrderEvent(order.id, { type: 'status', status: updated.status });

    // Push nur im Abhol-Modus und nur bei "Abholbereit" – im Service-Modus wird einfach serviert.
    if (updated.status === 'READY' && order.mode === 'PICKUP' && order.pushSubscription) {
      void sendPush(order.pushSubscription as unknown as PushSubscription, {
        title: 'Deine Bestellung ist fertig! 🍹',
        body: `Bestellung #${order.number} ist abholbereit – guten Durst!`,
        url: `${config.APP_URL}/o/${order.publicToken}`,
      });
    }

    res.json(updated);
  })
);

/** Live-Feed fürs Board (neue Bestellungen + Statuswechsel). Token via ?token= für EventSource. */
staffRouter.get(
  '/stream',
  requireStaff,
  asyncHandler(async (req, res) => {
    subscribeSse(res, `location:${req.staff!.locationId}`);
  })
);
