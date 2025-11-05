import { z } from 'zod';
import * as dotenv from 'dotenv';
dotenv.config();

const configSchema = z.object({
  port: z.coerce.number().default(3000),
  nodeEnv: z.string().default('development'),
  logLevel: z.string().default('info'),
  jwtSecret: z.string().min(1, 'JWT_SECRET is a required environment variable'),
  db: z.object({
    name: z.string().min(1),
    user: z.string().min(1),
    password: z.string().min(1),
    host: z.string().min(1),
    port: z.coerce.number(),
  }),
  kafka: z.object({
    broker: z.string().min(1),
    clientId: z.string().min(1),
    userLifecycleTopic: z.string().min(1),
  }),
  stream: z.object({
    apiKey: z.string().min(1),
    apiSecret: z.string().min(1),
  }),
  allowedOrigins: z.preprocess(
    (val) => (typeof val === 'string' ? val.split(',') : val),
    z.array(z.string()).default([
      'https://jpegapp.lol',
      'https://www.jpegapp.lol',
      'http://localhost:5173'
    ])
  ),
});

const configValues = {
  port: process.env.PORT,
  nodeEnv: process.env.NODE_ENV,
  logLevel: process.env.LOG_LEVEL,
  jwtSecret: process.env.JWT_SECRET,
  db: {
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
  },
  kafka: {
    broker: process.env.KAFKA_BROKER,
    clientId: process.env.KAFKA_CLIENT_ID_USER,
    userLifecycleTopic: process.env.USER_LIFECYCLE_TOPIC,
  },
  stream: {
    apiKey: process.env.STREAM_API_KEY,
    apiSecret: process.env.STREAM_PRIVATE_API_KEY,
  },
  allowedOrigins: process.env.ALLOWED_ORIGINS,
};

const result = configSchema.safeParse(configValues);

if (!result.success) {
  console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = result.data;
export type IAppConfig = typeof config;