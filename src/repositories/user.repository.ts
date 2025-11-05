import { DataTypes, Model, Optional, UniqueConstraintError, ModelCtor } from 'sequelize';
import { singleton, inject } from 'tsyringe';
import { Logger } from 'winston';
import { User, UserCreationAttributes, UserUpdateAttributes } from '../models/user.model';
import { Database } from '../database';
import { config } from '../config';

interface InternalUserAttributes {
  id: number;
  username: string;
  email: string;
  passwordhash: string;
  createdAt: Date;
  updatedAt: Date;
}

interface InternalUserCreationAttributes extends Optional<InternalUserAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class UserModel extends Model<InternalUserAttributes, InternalUserCreationAttributes> implements InternalUserAttributes {
  public id!: number;
  public username!: string;
  public email!: string;
  public passwordhash!: string;
  public createdAt!: Date;
  public updatedAt!: Date;
}

const initUserModel = (database: Database): typeof UserModel => {
    UserModel.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      username: { type: DataTypes.STRING, allowNull: false },
      email: { type: DataTypes.STRING, allowNull: false, unique: 'users_email_key' },
      passwordhash: { type: DataTypes.STRING, allowNull: false, field: 'passwordhash' },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' }
    },
    {
      sequelize: database.sequelize,
      tableName: 'users',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );
  return UserModel;
};

// Initialize the model once and use it for injection
const databaseInstance = new Database(config, logger);
initUserModel(databaseInstance);

@singleton()
export class UserRepository {
  constructor(
    @inject('UserModel') private userModel: ModelCtor<UserModel>,
    @inject('Logger') private logger: Logger
  ) {}

  private toExternalUser(user: UserModel): User {
    const json = user.toJSON();
    return { ...json, id: json.id.toString() };
  }

  private logQuery(queryDesc: string, values: any, correlationId?: string, operation?: string) {
    this.logger.debug(`UserRepository: Executing DB operation`, {
        correlationId,
        operation: operation || 'UnknownUserDBOperation',
        details: queryDesc,
        params: config.nodeEnv !== 'production' ? values : '[values_hidden_in_prod]',
        type: 'DBLog.UserQuery'
    });
  }

  async createUser(user: UserCreationAttributes, correlationId?: string): Promise<User> {
    const operation = 'createUser';
    this.logger.info(`UserRepository: ${operation} initiated`, { correlationId, email: user.email, type: `DBLog.${operation}` });
    try {
      this.logQuery(`UserModel.create`, user, correlationId, operation);
      const newUser = await this.userModel.create(user);
      return this.toExternalUser(newUser);
    } catch (error: any) {
      this.logger.error(`UserRepository: Error in ${operation}`, { correlationId, email: user.email, error: error.message, stack: error.stack, type: `DBError.${operation}` });
      if (error instanceof UniqueConstraintError) {
        throw new Error('Email already in use');
      }
      throw new Error('Database error during user creation.');
    }
  }

  async findUserById(id: string, correlationId?: string): Promise<User | undefined> {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) return undefined;
    
    const user = await this.userModel.findByPk(numericId);
    return user ? this.toExternalUser(user) : undefined;
  }

  async findUserByEmail(email: string, correlationId?: string): Promise<User | undefined> {
    const user = await this.userModel.findOne({ where: { email } });
    return user ? this.toExternalUser(user) : undefined;
  }

  async updateUser(id: string, updatedUser: UserUpdateAttributes, correlationId?: string): Promise<User | undefined> {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) return undefined;

    const [numberOfAffectedRows] = await this.userModel.update(updatedUser, { where: { id: numericId } });
    
    if (numberOfAffectedRows > 0) {
      const user = await this.userModel.findByPk(numericId);
      return user ? this.toExternalUser(user) : undefined;
    }
    return undefined;
  }

  async deleteUser(id: string, correlationId?: string): Promise<boolean> {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) return false;

    const deletedRows = await this.userModel.destroy({ where: { id: numericId } });
    return deletedRows > 0;
  }

  async findAllUsers(correlationId?: string): Promise<User[]> {
    const users = await this.userModel.findAll();
    return users.map(this.toExternalUser);
  }
}