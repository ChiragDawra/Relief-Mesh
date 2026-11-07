import { Router } from 'express';
import { z } from 'zod';
import {
  createCaseSchema,
  listCasesQuerySchema,
  reviewCaseSchema,
  updateCaseSchema,
} from '@reliefmesh/shared';
import { getAuth } from '../auth/middleware';
import { ApiError } from '../http/errors';
import type { CaseService, MutationResult } from '../services/caseService';
import { staffCaseView } from '../services/views';

const caseIdParam = z.object({ caseId: z.uuid() });

function caseId(params: unknown): string {
  const parsed = caseIdParam.safeParse(params);
  if (!parsed.success) throw new ApiError('NOT_FOUND', 'Case not found.');
  return parsed.data.caseId;
}

function idempotencyKey(header: string | undefined): string | undefined {
  if (header === undefined) return undefined;
  const parsed = z.uuid().safeParse(header);
  if (!parsed.success) throw new ApiError('INVALID_INPUT', 'Idempotency-Key must be a UUID.');
  return parsed.data;
}

function mutationBody(result: MutationResult) {
  return { case: staffCaseView(result.caseRecord), audit_event_id: result.eventId };
}

export function casesRouter(service: CaseService): Router {
  const router = Router();

  router.post('/cases', async (req, res) => {
    const input = createCaseSchema.parse(req.body);
    const result = await service.createCase(getAuth(req), input, idempotencyKey(req.header('idempotency-key')));
    res.status(result.created ? 201 : 200).json(mutationBody(result));
  });

  router.get('/cases', async (req, res) => {
    const query = listCasesQuerySchema.parse(req.query);
    res.json({ cases: await service.listCases(getAuth(req), query) });
  });

  router.get('/cases/:caseId', async (req, res) => {
    res.json(await service.getCaseDetail(getAuth(req), caseId(req.params)));
  });

  router.patch('/cases/:caseId', async (req, res) => {
    const patch = updateCaseSchema.parse(req.body);
    res.json(mutationBody(await service.updateCase(getAuth(req), caseId(req.params), patch)));
  });

  router.post('/cases/:caseId/submit', async (req, res) => {
    res.json(mutationBody(await service.submitForReview(getAuth(req), caseId(req.params))));
  });

  router.post('/cases/:caseId/review', async (req, res) => {
    const input = reviewCaseSchema.parse(req.body);
    res.json(mutationBody(await service.reviewCase(getAuth(req), caseId(req.params), input)));
  });

  router.get('/cases/:caseId/timeline', async (req, res) => {
    res.json({ timeline: await service.getTimeline(getAuth(req), caseId(req.params)) });
  });

  return router;
}
