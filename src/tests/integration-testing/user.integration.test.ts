import 'reflect-metadata'; // Must be the first import
import request, { SuperAgentTest } from 'supertest';
import { Pool } from 'pg';
import { container } from 'tsyringe';
import { App } from '../../app';
import { StreamService } from '../../services/stream.service';
import { getKafkaProducer } from '../../kafka/producer';
import { Server } from 'http';

// Mock dependencies before they are used by the application
jest.mock('../kafka/producer');
jest.mock('../services/stream.service');

// Type assertion for our mocked Kafka producer
const mockedGetKafkaProducer = getKafkaProducer as jest.Mock;
const mockKafkaSend = jest.fn();
mockedGetKafkaProducer.mockResolvedValue({ send: mockKafkaSend });

const JWT_SECRET_FOR_TESTS = process.env.TEST_JWT_SECRET || 'a-secure-secret-for-testing';
process.env.JWT_SECRET = JWT_SECRET_FOR_TESTS;
process.env.USER_LIFECYCLE_TOPIC = 'user_lifecycle_events_test';
process.env.STREAM_API_KEY = "dummy-key-for-ci";
process.env.STREAM_PRIVATE_API_KEY = "dummy-secret-for-ci";
process.env.NODE_ENV = 'test';

describe('User Service Integration Tests', () => {
  let app: App;
  let server: Server;
  let agent: SuperAgentTest;
  let dbPool: Pool;
  
  // Mock implementations for services
  let streamServiceMock: jest.SpyInstance;

  beforeAll(async () => {
    container.clearInstances();
    
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

    const streamServiceInstance = container.resolve(StreamService);
    streamServiceMock = jest.spyOn(streamServiceInstance, 'createUserInStream').mockResolvedValue(undefined);
    jest.spyOn(streamServiceInstance, 'createStreamToken').mockReturnValue('mock-stream-token');
  });

  beforeEach(async () => {
    await dbPool.query('DELETE FROM users;');
    jest.clearAllMocks();
  });

  afterAll((done) => {
    dbPool.end();
    server.close(done);
  });

  // ... (the rest of your tests are unchanged)
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
      expect(res.body.username).toBe(testUserPayload.username);
      expect(streamServiceMock).toHaveBeenCalledTimes(1);
      expect(mockKafkaSend).toHaveBeenCalledTimes(1);
      const kafkaPayload = JSON.parse(mockKafkaSend.mock.calls[0][0].messages[0].value);
      expect(kafkaPayload.eventType).toBe('UserCreated');
    });

    it('POST /auth/login - should log in an existing user and return tokens', async () => {
      await agent.post('/auth/register').send(testUserPayload);
      
      const res = await agent.post('/auth/login').send({
        email: testUserPayload.email,
        password: testUserPayload.passwordhash,
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('streamToken', 'mock-stream-token');
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
      expect(res.body.username).toBe(mainUser.username);
    });

    it('PUT /users/:id - should allow a user to update their own username', async () => {
      const res = await agent
        .put(`/users/${mainUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ username: 'mainUserUpdated' });
      
      expect(res.status).toBe(200);
      expect(res.body.username).toBe('mainUserUpdated');
    });

    it('PUT /users/:id - should return 403 Forbidden when trying to update another user', async () => {
      const res = await agent
        .put(`/users/${otherUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ username: 'hacker' });
      
      expect(res.status).toBe(403);
    });

    it('DELETE /users/:id - should allow a user to delete their own account', async () => {
      const res = await agent
        .delete(`/users/${mainUserId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(204);
    });

    it('DELETE /users/:id - should return 403 Forbidden when trying to delete another user', async () => {
      const res = await agent
        .delete(`/users/${otherUserId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(403);
    });
  });
});