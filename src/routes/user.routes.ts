import express from 'express';
import { container } from 'tsyringe';
import { UserController } from '../controllers/user.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { updateUserSchema, updateUserPasswordSchema } from '../utils/validationSchemas';

const router = express.Router();

export const setupUserRoutes = () => {
  const userController = container.resolve(UserController);
  const auth = container.resolve(authMiddleware).execute;

  router.get('/users', auth, (req, res, next) => userController.getAllUsers(req, res, next));
  router.get('/users/me', auth, (req, res, next) => userController.getMe(req, res, next));
  router.put('/users/me/password', auth, validateRequest({ body: updateUserPasswordSchema }), (req, res, next) => userController.updateUserPassword(req, res, next));
  
  router.get('/users/:id', auth, (req, res, next) => userController.getUserById(req, res, next));
  router.put('/users/:id', auth, validateRequest({ body: updateUserSchema }), (req, res, next) => userController.updateUser(req, res, next));
  router.delete('/users/:id', auth, (req, res, next) => userController.deleteUser(req, res, next));

  return router;
};