import { StreamChat } from 'stream-chat';
import { singleton, inject } from 'tsyringe';
import { Logger } from 'winston';
import { IAppConfig } from '../config';
import { AppError } from '../utils/errors';

@singleton()
export class StreamService {
  private readonly streamChat: StreamChat;

  constructor(
    @inject('Config') private config: IAppConfig,
    @inject('Logger') private logger: Logger
  ) {
    this.streamChat = new StreamChat(config.stream.apiKey, config.stream.apiSecret);
  }

  async createUserInStream(user: { id: string; name: string; image?: string }, correlationId?: string): Promise<void> {
    this.logger.info('StreamService: Creating user in Stream Chat', { correlationId, userId: user.id, type: 'StreamLog.createUser' });
    try {
      await this.streamChat.upsertUser({ id: user.id, name: user.name, image: user.image });
      this.logger.info('StreamService: User successfully created/updated in Stream Chat', { correlationId, userId: user.id, type: 'StreamLog.createUserSuccess' });
    } catch (error: any) {
      this.logger.error('StreamService: Failed to create user in Stream Chat', { correlationId, userId: user.id, error: error.message, type: 'StreamError.createUser' });
      throw new AppError('Failed to provision user in chat service.', 500);
    }
  }

  createStreamToken(userId: string, correlationId?: string): string {
    this.logger.info('StreamService: Creating Stream token', { correlationId, userId, type: 'StreamLog.createToken' });
    return this.streamChat.createToken(userId);
  }
}