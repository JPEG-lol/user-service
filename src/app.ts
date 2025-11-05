import express, { Application, Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import { singleton, inject } from 'tsyringe';
import { IAppConfig } from './config';
import { Logger } from 'winston';
import { requestLogger, assignRequestId, RequestWithId } from './utils/logger';
import { setupAuthRoutes } from './routes/auth.routes';
import { setupUserRoutes } from './routes/user.routes';
import { AppError, NotFoundError } from './utils/errors';

@singleton()
export class App {
  private readonly app: Application;

  constructor(
    @inject('Config') private config: IAppConfig,
    @inject('Logger') private logger: Logger
  ) {
    this.app = express();
    this.configureMiddleware();
    this.configureRoutes();
    this.configureErrorHandling();
  }

  private configureMiddleware(): void {
    this.app.use(assignRequestId);
    this.app.use(helmet());
    
    const corsOptions: cors.CorsOptions = {
      origin: (origin, callback) => {
        if (!origin || this.config.allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          this.logger.warn('CORS blocked request', { origin, type: 'CorsErrorLog' });
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    };
    this.app.use(cors(corsOptions));
    this.app.options('*', cors(corsOptions));
    
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: false }));
    this.app.use(requestLogger);
  }

  private configureRoutes(): void {
    this.app.use('/auth', setupAuthRoutes());
    this.app.use('/', setupUserRoutes());
  }

  private configureErrorHandling(): void {
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      next(new NotFoundError('The requested route does not exist.'));
    });

    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      const typedReq = req as RequestWithId;
      const correlationId = typedReq.id;

      if (err instanceof AppError) {
        this.logger.warn(`Application error: ${err.message}`, {
          correlationId,
          statusCode: err.statusCode,
          error: err.name,
          type: 'AppWarningLog'
        });
        return res.status(err.statusCode).json({
          message: err.message,
          correlationId,
        });
      }

      this.logger.error('Unhandled internal server error', {
        correlationId,
        message: err.message,
        stack: err.stack,
        type: 'UnhandledErrorLog'
      });
      
      res.status(500).json({
        message: 'An internal server error occurred.',
        correlationId,
      });
    });
  }

  public listen(portOverride?: number): import('http').Server {
    const port = portOverride ?? this.config.port;
    return this.app.listen(port, () => {
      if (this.config.nodeEnv !== 'test') {
        this.logger.info(`User Service is running on port ${port}`, { port, type: 'StartupLog.HttpReady' });
      }
    });
  }
}