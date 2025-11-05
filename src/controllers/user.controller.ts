import { Request, Response, NextFunction } from 'express';
import { singleton, inject } from 'tsyringe';
import { UserService } from '../services/user.service';
import { RequestWithId } from '../utils/logger';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';
import { Logger } from 'winston';

@singleton()
export class UserController {
  constructor(
    @inject(UserService) private userService: UserService,
    @inject('Logger') private logger: Logger
  ) {}

  private checkPermissions(authUserId: string | undefined, targetUserId: string, correlationId?: string): void {
    if (!authUserId) {
        throw new UnauthorizedError();
    }
    if (authUserId !== targetUserId) {
      this.logger.warn('Authorization failed: User attempted to access forbidden resource', {
        correlationId,
        authUserId,
        targetUserId,
        type: 'AuthorizationError'
      });
      throw new ForbiddenError('You do not have permission to perform this action.');
    }
  }

  public async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { id: correlationId, userId: authUserId } = req as RequestWithId;
    const targetUserId = req.params.id;
    this.logger.info('UserController: getUserById initiated', { correlationId, targetUserId, authUserId, type: 'ControllerLog.getUserById' });
    try {
      const user = await this.userService.findUserById(targetUserId, correlationId);
      res.json(user);
    } catch (error) {
      next(error);
    }
  }

  public async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { id: correlationId, userId: authUserId } = req as RequestWithId;
    this.logger.info('UserController: getMe initiated', { correlationId, authUserId, type: 'ControllerLog.getMe' });
    try {
        if (!authUserId) {
            throw new UnauthorizedError('Authentication details missing.');
        }
      const user = await this.userService.findUserById(authUserId, correlationId);
      res.json(user);
    } catch (error) {
      next(error);
    }
  }

  public async getAllUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { id: correlationId, userId: authUserId } = req as RequestWithId;
    this.logger.info('UserController: getAllUsers initiated', { correlationId, authUserId, type: 'ControllerLog.getAllUsers' });
    try {
      const users = await this.userService.findAllUsers(correlationId);
      res.json(users);
    } catch (error) {
      next(error);
    }
  }

  public async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { id: correlationId, userId: authUserId } = req as RequestWithId;
    const targetUserId = req.params.id;
    this.logger.info('UserController: updateUser initiated', { correlationId, targetUserId, authUserId, body: req.body, type: 'ControllerLog.updateUser' });
    try {
      this.checkPermissions(authUserId, targetUserId, correlationId);
      const updatedUser = await this.userService.updateUser(targetUserId, req.body, correlationId);
      res.json(updatedUser);
    } catch (error) {
      next(error);
    }
  }

  public async updateUserPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { id: correlationId, userId: authUserId } = req as RequestWithId;
    this.logger.info('UserController: updateUserPassword initiated', { correlationId, authUserId, type: 'ControllerLog.updateUserPassword' });
    try {
      if (!authUserId) {
        throw new UnauthorizedError('Authentication details missing.');
      }
      const { newPassword } = req.body;
      await this.userService.updateUserPassword(authUserId, newPassword, correlationId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  public async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { id: correlationId, userId: authUserId } = req as RequestWithId;
    const targetUserId = req.params.id;
    this.logger.info('UserController: deleteUser initiated', { correlationId, targetUserId, authUserId, type: 'ControllerLog.deleteUser' });
    try {
      this.checkPermissions(authUserId, targetUserId, correlationId);
      await this.userService.deleteUser(targetUserId, correlationId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}