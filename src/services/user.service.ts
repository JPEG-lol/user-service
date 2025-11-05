import { singleton, inject } from 'tsyringe';
import bcrypt from 'bcrypt';
import { ProducerRecord, Message } from 'kafkajs';
import { Logger } from 'winston';
import { User, UserCreationAttributes, UserUpdateAttributes } from '../models/user.model';
import { UserRepository } from '../repositories/user.repository';
import { getKafkaProducer } from '../kafka/producer';
import { IAppConfig } from '../config';
import { BadRequestError, NotFoundError } from '../utils/errors';

interface UserLifecycleEvent {
  eventType: 'UserCreated' | 'UserDeleted' | 'UserUpdated';
  userId: string;
  username: string;
  email?: string;
  timestamp: string;
}

@singleton()
export class UserService {
  constructor(
    @inject(UserRepository) private userRepository: UserRepository,
    @inject('Config') private config: IAppConfig,
    @inject('Logger') private logger: Logger,
  ) {}

  private async sendUserEvent(event: UserLifecycleEvent, correlationId?: string): Promise<void> {
    const topic = this.config.kafka.userLifecycleTopic;
    this.logger.info(`UserService: Attempting to send ${event.eventType} event`, { correlationId, userId: event.userId, topic, type: 'KafkaProducerLog.AttemptSendUserEvent' });
    try {
      const producer = await getKafkaProducer(this.logger, correlationId);
      const messages: Message[] = [{
        value: JSON.stringify(event),
        headers: correlationId ? { 'X-Correlation-ID': correlationId } : undefined,
      }];
      const record: ProducerRecord = {
        topic,
        messages,
      };
      await producer.send(record);
      this.logger.info(`UserService: Sent ${event.eventType} event successfully`, { correlationId, userId: event.userId, topic, type: 'KafkaProducerLog.SentUserEventSuccess' });
    } catch (error: any) {
      this.logger.error(`UserService: Failed to send user event to Kafka`, { correlationId, userId: event.userId, topic, error: error.message, stack: error.stack, type: 'KafkaProducerLog.SendUserEventError' });
    }
  }

  async createUser(userData: UserCreationAttributes, correlationId?: string): Promise<User> {
    this.logger.info('UserService: createUser initiated', { correlationId, email: userData.email, type: 'ServiceLog.createUser' });
    const existingUser = await this.userRepository.findUserByEmail(userData.email, correlationId);
    if (existingUser) {
      this.logger.warn('UserService: createUser failed - Email already in use', { correlationId, email: userData.email });
      throw new BadRequestError('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(userData.passwordhash, 10);
    const newUser = await this.userRepository.createUser({ ...userData, passwordhash: hashedPassword }, correlationId);
    this.logger.info('UserService: User created in repository', { correlationId, userId: newUser.id, type: 'ServiceLog.createUserRepoSuccess' });

    if (newUser?.id) {
      await this.sendUserEvent({
        eventType: 'UserCreated',
        userId: newUser.id,
        username: newUser.username,
        email: newUser.email,
        timestamp: new Date().toISOString(),
      }, correlationId);
    }
    return newUser;
  }

  async findUserById(id: string, correlationId?: string): Promise<User> {
    this.logger.info('UserService: findUserById initiated', { correlationId, userId: id, type: 'ServiceLog.findUserById' });
    const user = await this.userRepository.findUserById(id, correlationId);
    if (!user) {
        this.logger.warn('UserService: findUserById - User not found', { correlationId, userId: id });
        throw new NotFoundError('User not found');
    }
    return user;
  }

  async findUserByEmail(email: string, correlationId?: string): Promise<User | undefined> {
    this.logger.info('UserService: findUserByEmail initiated', { correlationId, email, type: 'ServiceLog.findUserByEmail' });
    return this.userRepository.findUserByEmail(email, correlationId);
  }

  async findAllUsers(correlationId?: string): Promise<User[]> {
    this.logger.info('UserService: findAllUsers initiated', { correlationId, type: 'ServiceLog.findAllUsers' });
    return this.userRepository.findAllUsers(correlationId);
  }

  async updateUser(id: string, updatedUserData: UserUpdateAttributes, correlationId?: string): Promise<User> {
    this.logger.info('UserService: updateUser initiated', { correlationId, userId: id, data: updatedUserData, type: 'ServiceLog.updateUser' });
    const user = await this.userRepository.updateUser(id, updatedUserData, correlationId);
    if (!user) {
        this.logger.warn('UserService: updateUser - User not found or no changes made', { correlationId, userId: id });
        throw new NotFoundError('User not found or update failed');
    }

    if (user.id && user.username) {
        await this.sendUserEvent({
            eventType: 'UserUpdated',
            userId: user.id,
            username: user.username,
            email: user.email, 
            timestamp: new Date().toISOString(),
        }, correlationId);
    }
    return user;
  }

  async deleteUser(id: string, correlationId?: string): Promise<boolean> {
    this.logger.info('UserService: deleteUser initiated', { correlationId, userId: id, type: 'ServiceLog.deleteUser' });
    const userToDelete = await this.userRepository.findUserById(id, correlationId);
    if (!userToDelete) {
      this.logger.warn('UserService: deleteUser - User not found for deletion', { correlationId, userId: id });
      throw new NotFoundError('User not found');
    }
    const success = await this.userRepository.deleteUser(id, correlationId);
    if (success) {
      await this.sendUserEvent({
        eventType: 'UserDeleted',
        userId: id,
        username: userToDelete.username, 
        email: userToDelete.email, 
        timestamp: new Date().toISOString(),
      }, correlationId);
    }
    return success;
  }

  async updateUserPassword(id: string, newPassword: string, correlationId?: string): Promise<User> {
    this.logger.info('UserService: updateUserPassword initiated', { correlationId, userId: id, type: 'ServiceLog.updateUserPassword' });
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const user = await this.userRepository.updateUser(id, { passwordhash: hashedPassword }, correlationId);

    if (!user) {
        this.logger.warn('UserService: updateUserPassword - User not found for password update', { correlationId, userId: id });
        throw new NotFoundError('User not found');
    }

    if (user.id && user.username) {
        await this.sendUserEvent({
            eventType: 'UserUpdated',
            userId: user.id,
            username: user.username,
            email: user.email,
            timestamp: new Date().toISOString(),
        }, correlationId);
    }
    return user;
  }
}