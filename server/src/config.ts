import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICE_ID_MONTHLY: z.string().min(1),
  PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(100).default(2),
  VAPID_PUBLIC_KEY: z.string().optional().default(''),
  VAPID_PRIVATE_KEY: z.string().optional().default(''),
  VAPID_SUBJECT: z.string().optional().default('mailto:hallo@prego.app'),
});

export type AppConfig = z.infer<typeof envSchema>;

/** Validierte Umgebungs-Konfiguration – schlägt beim Start hart fehl statt zur Laufzeit. */
export const config: AppConfig = envSchema.parse(process.env);
