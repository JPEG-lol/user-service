import { Sequelize } from 'sequelize';
import { singleton, inject } from 'tsyringe';
import { Logger } from 'winston';
import { IAppConfig } from './config';

@singleton()
export class Database {
  public readonly sequelize: Sequelize;

  constructor(
    @inject('Config') private config: IAppConfig,
    @inject('Logger') private logger: Logger
  ) {
    this.sequelize = new Sequelize(
      config.db.name,
      config.db.user,
      config.db.password,
      {
        host: config.db.host,
        port: config.db.port,
        dialect: 'postgres',
        logging: (msg) => this.logger.debug(msg, { type: 'DBLog.Sequelize' }),
      }
    );
  }

  public async connect(): Promise<void> {
    try {
      await this.sequelize.authenticate();
    } catch (error) {
      this.logger.error('Unable to connect to the database:', { error });
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.sequelize.close();
      this.logger.info('Database connection closed.');
    } catch (error) {
      this.logger.error('Error closing the database connection:', { error });
    }
  }
}