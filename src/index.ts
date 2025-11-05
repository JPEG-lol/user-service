import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { container } from 'tsyringe';
import { App } from './app';
import { logger } from './utils/logger';
import { config } from './config';
import { getKafkaProducer, disconnectProducer, initializeKafkaProducerLogger } from './kafka/producer';
import { Database } from './database';
import { initializeUserModel } from './repositories/user.repository';

class Server {
  public static async start(): Promise<void> {
    logger.info('User Service starting...', { type: 'StartupLog.Init' });
    try {
      this.initializeDependencies();
      await this.connectServices();

      const app = container.resolve(App);
      const server = app.listen();

      const shutdown = this.createShutdownHandler(server);
      this.registerProcessEvents(shutdown);

    } catch (error: any) {
      logger.error('Failed to start User Service.', { error: error.message, stack: error.stack, type: 'StartupLog.FatalError' });
      await disconnectProducer().catch(e => logger.error("Error stopping producer during failed startup", { error: (e as Error).message }));
      process.exit(1);
    }
  }

  private static initializeDependencies(): void {
    container.register('Logger', { useValue: logger });
    container.register('Config', { useValue: config });
    container.register('Database', { useClass: Database });

    const database = container.resolve(Database);
    const userModel = initializeUserModel(database);
    container.register('UserModel', { useValue: userModel });
  }

  private static async connectServices(): Promise<void> {
    const database = container.resolve(Database);
    await database.connect();
    logger.info('Database connected successfully.', { type: 'StartupLog.DatabaseReady' });
    
    initializeKafkaProducerLogger(logger);
    await getKafkaProducer(logger);
    logger.info('Kafka producer initialized successfully.', { type: 'StartupLog.KafkaProducerReady' });
  }
  
  private static createShutdownHandler(server: import('http').Server): (signal: string) => void {
    return (signal: string) => {
      logger.info(`${signal} received. Shutting down gracefully.`, { signal, type: 'ShutdownLog.SignalReceived' });

      const shutdownTimeout = setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down', { timeout: 10000 });
        process.exit(1);
      }, 10000);

      server.close(async (err?: Error) => {
        if (err) {
          logger.error('Error during HTTP server close:', { error: err.message });
        } else {
          logger.info('HTTP server closed.');
        }

        await disconnectProducer();
        const database = container.resolve(Database);
        await database.disconnect();
        
        clearTimeout(shutdownTimeout);
        process.exit(err ? 1 : 0);
      });
    };
  }

  private static registerProcessEvents(shutdownHandler: (signal: string) => void): void {
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
      disconnectProducer().finally(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Rejection:', { reason });
    });
  }
}

Server.start();