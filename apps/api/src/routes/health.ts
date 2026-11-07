import { Router } from 'express';
import { SOLANA_NETWORK } from '@reliefmesh/shared';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'reliefmesh-api', network: SOLANA_NETWORK });
});
