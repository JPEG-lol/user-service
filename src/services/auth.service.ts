import { singleton, inject } from 'tsyringe';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Logger } from 'winston';
import { User, UserCreationAttributes } from '../models/user.model';
import { UserService } from './user.service';
import { StreamService } from './stream.service';
import { IAppConfig } from '../config';
import { UnauthorizedError } from '../utils/errors';

@singleton()
export class AuthService {
  constructor(
    @inject(UserService) private userService: UserService,
    @inject(StreamService) private streamService: StreamService,
    @inject('Config') private config: IAppConfig,
    @inject('Logger') private logger: Logger
  ) {}

  public async register(userData: UserCreationAttributes, correlationId?: string): Promise<User> {
    this.logger.info('AuthService: register initiated', { correlationId, email: userData.email, type: 'ServiceLog.register' });
    
    const user = await this.userService.createUser(userData, correlationId);
    
    await this.streamService.createUserInStream({
      id: user.id!.toString(),
      name: user.username
    }, correlationId);

    this.logger.info('AuthService: register successful', { correlationId, userId: user.id, type: 'ServiceLog.registerSuccess' });
    return user;
  }

  public async login(email: string, password: string, correlationId?: string): Promise<{ token: string; userId: string; username: string; streamToken: string; }> {
    this.logger.info('AuthService: login attempt', { correlationId, email, type: 'ServiceLog.loginAttempt' });
    const user = await this.userService.findUserByEmail(email, correlationId);

    if (!user || !user.id) {
      this.logger.warn('AuthService: login failed - User not found', { correlationId, email, type: 'AuthLog.LoginFail.UserNotFound' });
      throw new UnauthorizedError('Invalid credentials.');
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordhash);
    if (!passwordMatch) {
      this.logger.warn('AuthService: login failed - Password mismatch', { correlationId, userId: user.id, type: 'AuthLog.LoginFail.PasswordMismatch' });
      throw new UnauthorizedError('Invalid credentials.');
    }

    const token = jwt.sign({ userId: user.id }, this.config.jwtSecret, { expiresIn: '1h' });
    const streamToken = this.streamService.createStreamToken(user.id, correlationId);
    
    this.logger.info('AuthService: login successful, tokens generated', { correlationId, userId: user.id, type: 'AuthLog.LoginSuccess.TokensGenerated' });
    
    return { token, userId: user.id, username: user.username, streamToken };
  }

  public async verifyToken(token: string, correlationId?: string): Promise<{ userId: string } | null> {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as { userId: string };
      return decoded;
    } catch (error) {
      this.logger.warn('JWT verification failed', { correlationId, error: (error as Error).message, type: 'AuthLog.JWTVerifyFail' });
      return null;
    }
  }
}