import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { signAdminToken } from '../lib/jwt';
import { ApiError, asyncHandler } from '../middleware/error';
import { loginSchema, registerSchema } from '../schemas';

export const authRouter = Router();

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const existing = await prisma.tenant.findUnique({ where: { email: body.email.toLowerCase() } });
    if (existing) throw new ApiError(409, 'E-Mail ist bereits registriert.');
    const passwordHash = await bcrypt.hash(body.password, 12);
    const tenant = await prisma.tenant.create({
      data: { name: body.name, email: body.email.toLowerCase(), passwordHash },
    });
    res.status(201).json({ token: signAdminToken(tenant.id), tenant: { id: tenant.id, name: tenant.name, email: tenant.email } });
  })
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const tenant = await prisma.tenant.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!tenant || !(await bcrypt.compare(body.password, tenant.passwordHash))) {
      throw new ApiError(401, 'E-Mail oder Passwort falsch.');
    }
    res.json({ token: signAdminToken(tenant.id), tenant: { id: tenant.id, name: tenant.name, email: tenant.email } });
  })
);
