import { Router } from 'express';
import { getAuth } from '../auth/middleware';
import type { CaseService } from '../services/caseService';

export function meRouter(service: CaseService): Router {
  const router = Router();

  router.get('/me', async (req, res) => {
    res.json(await service.me(getAuth(req)));
  });

  router.get('/suppliers', async (req, res) => {
    res.json({ suppliers: await service.listSuppliers(getAuth(req)) });
  });

  return router;
}
