import express, { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/auth.controller';
import { validateRequest } from '../middleware/validation.middleware';
import { registerSchema, loginSchema } from '../utils/validationSchemas';

const router = express.Router();

export const setupAuthRoutes = () => {
  const authController = container.resolve(AuthController);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
  });

  const noOpMiddleware = (req: Request, res: Response, next: NextFunction) => next();
  const limiter = process.env.NODE_ENV === 'test' ? noOpMiddleware : authLimiter;

  router.post('/register', limiter, validateRequest({ body: registerSchema }), (req, res, next) => authController.register(req, res, next));
  router.post('/login', limiter, validateRequest({ body: loginSchema }), (req, res, next) => authController.login(req, res, next));
  router.post('/logout', (req, res, next) => authController.logout(req, res, next));

  return router;
};