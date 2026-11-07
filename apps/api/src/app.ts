import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { AppConfig } from './config';
import { errorHandler, notFoundHandler } from './http/errors';
import { healthRouter } from './routes/health';

export function createApp(config: AppConfig) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN }));
  app.use(
    pinoHttp({
      genReqId: () => `req_${randomUUID()}`,
      enabled: config.NODE_ENV !== 'test',
      // Never log tokens or bodies (may contain synthetic-but-sensitive text).
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  const v1 = express.Router();
  v1.use(healthRouter);
  app.use('/api/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
