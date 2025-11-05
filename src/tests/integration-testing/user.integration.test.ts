import 'reflect-metadata';
import request from 'supertest';
import { Pool } from 'pg';
import { container } from 'tsyringe';
import { App } from '../../app';
import { StreamService } from '../../services/stream.service';
import { getKafkaProducer } from '../../kafka/producer';
import { Server } from 'http';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { Database } from '../../database';
import { initializeUserModel } from '../../repositories/user.repository';

jest.mock('../../kafka/producer');
jest.mock('../../services/stream.service');

const mockedGetKafkaProducer = getKafkaProducer as jest.Mock;
const mockKafkaSend = jest.fn();
mockedGetKafkaProducer.mockResolvedValue({ send: mockKafkaSend });

process.env.NODE_ENV = 'test';

describe('User Service Integration Tests', () => {
  let app: App;
  let server: Server;
  let agent: any;
  let dbPool: Pool;
  let streamServiceMock: jest.SpyInstance;

  beforeAll(async () => {
    container.register('Logger', { useValue: logger });
    container.register('Config', { useValue: config });
    container.register('Database', { useClass: Database });

    const database = container.resolve(Database);
    const userModel = initializeUserModel(database);
    container.register('UserModel', { useValue: userModel });

    app = container.resolve(App);
    server = app.listen(0);
    agent = request.agent(server);

    dbPool = new Pool({
      host: process.env.DB_HOST_TEST || 'localhost',
      port: parseInt(process.env.DB_PORT_TEST || '5432', 10),
      user: process.env.DB_USER_TEST || 'postgres',
      password: process.env.DB_PASSWORD_TEST || 'password',
      database: process.env.DB_NAME_TEST || 'users',
    });
    try {
      await dbPool.query('SELECT 1');
    } catch (e) {
      console.error('Could not connect to the test database. Is it running?', e);
      throw e;
    }

    const streamServiceInstance = container.resolve(StreamService);
    streamServiceMock = jest.spyOn(streamServiceInstance, 'createUserInStream').mockResolvedValue(undefined);
    jest.spyOn(streamServiceInstance, 'createStreamToken').mockReturnValue('mock-stream-token');
  });

  beforeEach(async () => {
    await dbPool.query('DELETE FROM users;');
    jest.clearAllMocks();
  });

  afterAll(async () => {
    const database = container.resolve(Database);
    await database.disconnect();
    await dbPool.end();
    
    await new Promise<void>((resolve, reject) => {
        server.close((err) => {
            if (err) return reject(err);
            resolve();
        });
    });
  });

  describe('Auth Endpoints: /auth', () => {
    const testUserPayload = {
      username: 'tester',
      email: 'tester@test.com',
      passwordhash: 'password12345',
    };

    it('POST /auth/register - should register a new user successfully', async () => {
      const res = await agent.post('/auth/register').send(testUserPayload);
      
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
    });

    it('POST /auth/login - should log in an existing user and return tokens', async () => {
      await agent.post('/auth/register').send(testUserPayload);
      
      const res = await agent.post('/auth/login').send({
        email: testUserPayload.email,
        password: testUserPayload.passwordhash,
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
    });
  });

  describe('User Endpoints: /users (Protected)', () => {
    let authToken: string;
    let mainUserId: string;
    let otherUserId: string;

    const mainUser = { username: 'mainUser', email: 'main@test.com', passwordhash: 'password12345' };
    const otherUser = { username: 'otherUser', email: 'other@test.com', passwordhash: 'password12345' };

    beforeEach(async () => {
      const mainUserRes = await agent.post('/auth/register').send(mainUser);
      mainUserId = mainUserRes.body.id;

      const otherUserRes = await agent.post('/auth/register').send(otherUser);
      otherUserId = otherUserRes.body.id;

      const loginRes = await agent.post('/auth/login').send({ email: mainUser.email, password: mainUser.passwordhash });
      authToken = loginRes.body.token;
    });

    it('GET /users/me - should return details of the authenticated user', async () => {
      const res = await agent.get('/users/me').set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(mainUserId);
    });

    it('PUT /users/:id - should return 403 Forbidden when trying to update another user', async () => {
      const res = await agent
        .put(`/users/${otherUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ username: 'hacker' });
      
      expect(res.status).toBe(403);
    });

    it('DELETE /users/:id - should return 403 Forbidden when trying to delete another user', async () => {
      const res = await agent
        .delete(`/users/${otherUserId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(403);
    });
  });
});