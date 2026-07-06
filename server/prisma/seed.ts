/**
 * Demo-Seed: Tenant "Bar Aperto" mit Standort "sommerfest" (PICKUP)
 * Admin-Login: demo@prego.app / prego2026!
 * Staff-PIN: 4711
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash('prego2026!', 12);
  const staffPinHash = await bcrypt.hash('4711', 10);

  const tenant = await prisma.tenant.upsert({
    where: { email: 'demo@prego.app' },
    update: {},
    create: { name: 'Bar Aperto', email: 'demo@prego.app', passwordHash },
  });

  const location = await prisma.location.upsert({
    where: { slug: 'sommerfest' },
    update: {},
    create: { tenantId: tenant.id, name: 'Sommerfest Düsseldorf', slug: 'sommerfest', mode: 'PICKUP', staffPinHash },
  });

  const existing = await prisma.menuCategory.count({ where: { locationId: location.id } });
  if (existing === 0) {
    const aperitivo = await prisma.menuCategory.create({
      data: { locationId: location.id, name: 'Aperitivo', sortOrder: 0 },
    });
    const alkoholfrei = await prisma.menuCategory.create({
      data: { locationId: location.id, name: 'Alkoholfrei', sortOrder: 1 },
    });
    await prisma.menuItem.createMany({
      data: [
        { categoryId: aperitivo.id, name: 'Aperol Spritz', description: 'Aperol, Prosecco, Soda, Orange', priceCents: 850, sortOrder: 0 },
        { categoryId: aperitivo.id, name: 'Limoncello Spritz', description: 'Limoncello, Prosecco, Minze', priceCents: 900, sortOrder: 1 },
        { categoryId: aperitivo.id, name: 'Negroni', description: 'Gin, Campari, roter Wermut', priceCents: 1100, sortOrder: 2 },
        { categoryId: alkoholfrei.id, name: 'Crodino Spritz', description: 'Alkoholfreier Aperitivo', priceCents: 650, sortOrder: 0 },
        { categoryId: alkoholfrei.id, name: 'San Pellegrino', description: 'Limonata oder Aranciata', priceCents: 400, sortOrder: 1 },
      ],
    });
  }

  console.log('[seed] Fertig. Admin: demo@prego.app / prego2026! · Staff-PIN: 4711 · Gast-URL: /l/sommerfest');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
