import type { Order } from '@prisma/client';
import { prisma } from './prisma';
import { stripe } from './stripe';
import { emitLocationEvent, emitOrderEvent } from './events';
import { ApiError } from '../middleware/error';

/**
 * Bezahlte Bestellung stornieren und automatisch über Stripe erstatten.
 * Destination Charge → Transfer an die Bar und Plattform-Fee werden mit zurückgeholt.
 * Schlägt der Refund fehl, wird NICHT storniert – der Gast darf nicht ohne Geld dastehen.
 */
export async function cancelOrderWithRefund(order: Order): Promise<{ refunded: boolean }> {
  let refunded = false;
  if (order.paymentIntentId) {
    try {
      const intent = await stripe.paymentIntents.retrieve(order.paymentIntentId);
      if (intent.status === 'succeeded') {
        await stripe.refunds.create({
          payment_intent: order.paymentIntentId,
          reverse_transfer: true,
          refund_application_fee: true,
        });
        refunded = true;
      }
    } catch {
      throw new ApiError(502, 'Rückerstattung über Stripe fehlgeschlagen – Bestellung wurde NICHT storniert. Bitte erneut versuchen.');
    }
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { status: 'CANCELLED', refundedAt: refunded ? new Date() : null },
  });

  emitLocationEvent(order.locationId, { type: 'order.updated', orderId: order.id });
  emitOrderEvent(order.id, { type: 'status', status: 'CANCELLED' });
  return { refunded };
}
