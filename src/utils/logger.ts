import winston from 'winston';
import { NextFunction, Request as ExpressRequest, Response } from 'express';
import addRequestId from 'express-request-id';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

export interface RequestWithId extends ExpressRequest {
  id?: string;
  userId?: string; 
}

export const assignRequestId = addRequestId({
    setHeader: true,
    headerName: 'X-Correlation-ID'
});

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const consoleLogFormat = printf(({ level, message, timestamp, service, correlationId, stack, type, userId, ...metadata }) => {
  let log = `${timestamp} [${service}] ${level}`;
  if (correlationId) {
    log += ` [correlationId: ${correlationId}]`;
  }
  if (userId) {
    log += ` [userId: ${userId}]`;
  }
  if (type) {
    log += ` [type: ${type}]`;
  }
  log += `: ${message}`;
  const metaString = Object.keys(metadata).length > 0 ? ` ${JSON.stringify(metadata)}` : '';
  log += metaString;
  if (stack) {
    log += `\n${stack}`;
  }
  return log;
});

const serviceName = 'user-service';

export const logger = winston.createLogger({
  level: config.logLevel,
  format: combine(
    timestamp(),
    errors({ stack: true }),
    winston.format((info) => {
      info.service = serviceName;
      return info;
    })(),
  ),
  transports: [],
  defaultMeta: { service: serviceName },
});

if (config.nodeEnv !== 'production') {
  logger.add(new winston.transports.Console({
    format: combine(
      colorize(),
      consoleLogFormat
    ),
  }));
} else {
  logger.add(new winston.transports.Console({
    format: combine(
        json()
    ),
  }));
}

export const requestLogger = (req: ExpressRequest, res: Response, next: NextFunction) => {
  const start = Date.now();
  const typedReq = req as RequestWithId;

  const correlationId = typedReq.id || req.headers['x-correlation-id']?.toString() || uuidv4();
  typedReq.id = correlationId;

  const commonLogData: any = {
    correlationId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  };
  if (typedReq.userId) {
    commonLogData.authUserId = typedReq.userId;
  }

  logger.info(`Incoming request`, { ...commonLogData, type: 'RequestLog.Start' });

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logFinishData: any = {
        ...commonLogData,
        status: res.statusCode,
        durationMs: duration,
        type: 'RequestLog.Finish',
    };
    if (typedReq.userId) { 
        logFinishData.authUserId = typedReq.userId;
    }
    logger.info(`Request finished`, logFinishData);
  });

  res.on('error', (err) => {
    logger.error(`Error in response stream`, {
        ...commonLogData,
        error: err.message,
        stack: err.stack,
        type: 'RequestErrorLog'
    });
  });

  next();
};