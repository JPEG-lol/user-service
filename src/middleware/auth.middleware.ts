import { Response, NextFunction } from 'express';
import { singleton, inject } from 'tsyringe';
import { AuthService } from '../services/auth.service';
import { RequestWithId } from '../utils/logger';
import { UnauthorizedError } from '../utils/errors';
import { Logger } from 'winston';

@singleton()
export class authMiddleware {
  constructor(
    private authService: AuthService,
    @inject('Logger') private logger: Logger
  ) {}

  public execute = async (req: RequestWithId, res: Response, next: NextFunction): Promise<void> => {
    const correlationId = req.id;
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedError('Missing or malformed Bearer token.');
      }

      const token = authHeader.split(' ')[1];
      const decoded = await this.authService.verifyToken(token, correlationId);

      if (!decoded || !decoded.userId) {
        throw new UnauthorizedError('Invalid or expired token.');
      }

      req.userId = decoded.userId;
      this.logger.info('AuthMiddleware: Authorized successfully', { correlationId, authUserId: req.userId, url: req.originalUrl, type: 'AuthMiddleware.Success' });
      next();
    } catch (error) {
      this.logger.warn('AuthMiddleware: Unauthorized request', { correlationId, url: req.originalUrl, error: (error as Error).message, type: 'AuthMiddleware.Fail' });
      next(error instanceof UnauthorizedError ? error : new UnauthorizedError());
    }
  };
}