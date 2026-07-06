import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { authRouter } from './routes/auth';
import { adminRouter } from './routes/admin';
import { publicRouter } from './routes/public';
import { staffRouter } from './routes/staff';
import { stripeRouter, stripeWebhookHandler } from './routes/stripe';
import { errorHandler } from './middleware/error';

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(cors());

  // Webhook VOR express.json() – Stripe braucht den Raw-Body für die Signatur.
  app.post('/api/stripe/webhook', ...stripeWebhookHandler);

  app.use(express.json({ limit: '1mb' }));

  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/staff', staffRouter);
  app.use('/api/stripe', stripeRouter);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'prego', time: new Date().toISOString() });
  });

  // Statisches Client-Build + SPA-Fallback
  const publicDir = path.join(__dirname, '..', 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(publicDir, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
