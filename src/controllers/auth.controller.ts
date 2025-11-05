import { Request, Response, NextFunction } from 'express';
import { singleton, inject } from 'tsyringe';
import { AuthService } from '../services/auth.service';
import { RequestWithId } from '../utils/logger';
import { Logger } from 'winston';

@singleton()
export class AuthController {
  constructor(
    @inject(AuthService) private authService: AuthService,
    @inject('Logger') private logger: Logger
  ) {}

  public async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithId).id;
    this.logger.info('AuthController: register initiated', { correlationId, email: req.body.email, type: 'ControllerLog.register' });
    try {
      const user = await this.authService.register(req.body, correlationId);
      res.status(201).json({ id: user.id, username: user.username, email: user.email });
    } catch (error) {
      next(error);
    }
  }

  public async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    const correlationId = (req as RequestWithId).id;
    const { email, password } = req.body;
    this.logger.info('AuthController: login attempt', { correlationId, email, type: 'ControllerLog.loginAttempt' });
    try {
      const result = await this.authService.login(email, password, correlationId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  public async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    const typedReq = req as RequestWithId;
    this.logger.info('AuthController: logout processed', { correlationId: typedReq.id, authUserId: typedReq.userId, type: 'AuthLog.Logout' });
    res.status(204).send();
  }
}