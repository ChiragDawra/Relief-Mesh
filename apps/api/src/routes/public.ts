import { Router } from 'express';
import { ApiError } from '../http/errors';
import type { CaseService } from '../services/caseService';

const PUBLIC_REF = /^RM-DEMO-\d{4,}$/;

/** Unauthenticated, allowlisted transparency receipts. */
export function publicRouter(service: CaseService): Router {
  const router = Router();

  router.get('/public/cases/:publicRef', async (req, res) => {
    const publicRef = req.params['publicRef'] ?? '';
    if (!PUBLIC_REF.test(publicRef)) throw new ApiError('NOT_FOUND', 'Case not found.');
    res.json(await service.getPublicCase(publicRef));
  });

  return router;
}
