/**
 * Contracts for the internal AI service (ADR-015). The API validates every AI response with these
 * schemas: model output is untrusted even when it comes from our own service.
 */
import { z } from 'zod';
import type { AiStatus } from './enums';
import { categorySchema, requestedItemSchema, urgencySchema } from './schemas';

export const intakeResultSchema = z
  .object({
    category: categorySchema,
    requested_items: z.array(requestedItemSchema).max(20),
    household_count: z.number().int().positive().max(10_000).nullable(),
    locality_label: z.string(),
    urgency_suggestion: urgencySchema.nullable(),
    urgency_reasons: z.array(z.string()).max(10),
    missing_fields: z.array(z.string()).max(10),
    confidence: z.number().min(0).max(1),
    uncertainties: z.array(z.string()).max(10),
    summary: z.string().max(300),
  })
  .strict();
export type IntakeResult = z.infer<typeof intakeResultSchema>;

export const intakeResponseSchema = z
  .object({
    result: intakeResultSchema,
    provider: z.string(),
    model_version: z.string(),
    needs_review: z.boolean(),
    human_review_required: z.literal(true),
  })
  .strict();
export type IntakeResponse = z.infer<typeof intakeResponseSchema>;

export const duplicateCandidateSchema = z
  .object({
    case_id: z.string(),
    similarity_score: z.number().min(0).max(1),
    reasons: z.array(z.string()),
    differences: z.array(z.string()),
    review_recommendation: z.literal('compare_records'),
  })
  .strict();
export type DuplicateCandidate = z.infer<typeof duplicateCandidateSchema>;

export const duplicateResponseSchema = z
  .object({
    candidates: z.array(duplicateCandidateSchema).max(3),
    disclaimer: z.string(),
    method: z.string(),
    min_score: z.number(),
  })
  .strict();
export type DuplicateResponse = z.infer<typeof duplicateResponseSchema>;

export const evidenceResponseSchema = z
  .object({
    findings: z.array(
      z
        .object({
          kind: z.enum([
            'total_matches',
            'total_mismatch',
            'total_missing',
            'item_missing',
            'item_quantity_differs',
            'item_not_requested',
          ]),
          message: z.string(),
        })
        .strict(),
    ),
    discrepancy_detected: z.boolean(),
    disclaimer: z.string(),
    human_review_required: z.literal(true),
  })
  .strict();
export type EvidenceResponse = z.infer<typeof evidenceResponseSchema>;

export interface DuplicateCandidateView extends DuplicateCandidate {
  public_ref: string | null;
}

/** AI section of the staff case detail. Every value is a suggestion for human review. */
export interface CaseAiPanel {
  ai_status: AiStatus;
  intake: {
    assessment_id: string;
    provider: string;
    model_version: string;
    needs_review: boolean;
    result: IntakeResult;
    created_at: string;
  } | null;
  duplicates: {
    assessment_id: string;
    candidates: DuplicateCandidateView[];
    disclaimer: string;
    method: string;
    created_at: string;
  } | null;
}

export interface TriageResponse {
  ai_status: AiStatus;
  human_review_required: true;
  intake_assessment_id: string | null;
  duplicate_assessment_id: string | null;
  ai: CaseAiPanel;
}
