import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { requireAuth, type TokenVerifier } from './auth/middleware';
import type { AppConfig } from './config';
import { errorHandler, notFoundHandler } from './http/errors';
import type { Repository } from './repositories/repository';
import { casesRouter } from './routes/cases';
import { healthRouter } from './routes/health';
import { meRouter } from './routes/me';
import { publicRouter } from './routes/public';
import { CaseService } from './services/caseService';

export interface AppDeps {
  repo: Repository;
  verifier: TokenVerifier;
  now?: () => Date;
}

export function createApp(config: AppConfig, deps: AppDeps) {
  const caseService = new CaseService(deps.repo, deps.now);

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
  v1.use(publicRouter(caseService));
  v1.use(requireAuth(deps.verifier, deps.repo));
  v1.use(meRouter(caseService));
  v1.use(casesRouter(caseService));
  app.use('/api/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
