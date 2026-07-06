import webPush, { type PushSubscription } from 'web-push';
import { z } from 'zod';
import { config } from '../config';

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const pushEnabled = config.VAPID_PUBLIC_KEY.length > 0 && config.VAPID_PRIVATE_KEY.length > 0;

if (pushEnabled) {
  webPush.setVapidDetails(config.VAPID_SUBJECT, config.VAPID_PUBLIC_KEY, config.VAPID_PRIVATE_KEY);
}

export function isPushEnabled(): boolean {
  return pushEnabled;
}

/** Sendet eine Web-Push-Nachricht; Fehler (abgelaufene Subscription etc.) werden geloggt, nie geworfen. */
export async function sendPush(
  subscription: PushSubscription,
  payload: { title: string; body: string; url: string }
): Promise<void> {
  if (!pushEnabled) return;
  try {
    await webPush.sendNotification(subscription, JSON.stringify(payload), { TTL: 60 * 60 });
  } catch (err) {
    console.error('[push] Zustellung fehlgeschlagen:', err instanceof Error ? err.message : err);
  }
}
