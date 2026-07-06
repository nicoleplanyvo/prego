import { EventEmitter } from 'node:events';
import type { Response } from 'express';

/** Zentraler In-Memory-Event-Bus für SSE (Board-Feed + Gast-Status). */
const bus = new EventEmitter();
bus.setMaxListeners(0);

export type OrderEventPayload = Record<string, unknown>;

export function emitLocationEvent(locationId: string, payload: OrderEventPayload): void {
  bus.emit(`location:${locationId}`, payload);
}

export function emitOrderEvent(orderId: string, payload: OrderEventPayload): void {
  bus.emit(`order:${orderId}`, payload);
}

/** Öffnet eine SSE-Verbindung auf `res` und abonniert den angegebenen Kanal. */
export function subscribeSse(res: Response, channel: string): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': connected\n\n');

  const listener = (payload: OrderEventPayload): void => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
  bus.on(channel, listener);

  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 25_000);

  res.on('close', () => {
    clearInterval(heartbeat);
    bus.off(channel, listener);
  });
}
