import { DUPLICATE_DISCLAIMER, type DuplicateResponse, type IntakeResponse } from '@reliefmesh/shared';
import {
  AiUnavailableError,
  type AiClient,
  type DuplicateRequest,
  type IntakeRequest,
} from '../../src/ai/aiClient';

/** Deterministic AI double that records exactly what the API sent. */
export class FakeAiClient implements AiClient {
  available = true;
  readonly intakeCalls: IntakeRequest[] = [];
  readonly duplicateCalls: DuplicateRequest[] = [];

  async intake(input: IntakeRequest): Promise<IntakeResponse> {
    this.intakeCalls.push(input);
    if (!this.available) throw new AiUnavailableError('AI service unreachable');
    return {
      result: {
        category: 'water',
        requested_items: [{ name: 'drinking_water', quantity: 25, unit: 'litre' }],
        household_count: 5,
        locality_label: input.locality_label,
        urgency_suggestion: 'high',
        urgency_reasons: ['The request says "no safe drinking water".'],
        missing_fields: [],
        confidence: 0.88,
        uncertainties: [],
        summary: '5 households request drinking water.',
      },
      provider: 'mock',
      model_version: 'test-fixture',
      needs_review: false,
      human_review_required: true,
    };
  }

  async duplicates(input: DuplicateRequest): Promise<DuplicateResponse> {
    this.duplicateCalls.push(input);
    if (!this.available) throw new AiUnavailableError('AI service unreachable');
    return {
      candidates: input.candidates.slice(0, 1).map((c) => ({
        case_id: c.case_id,
        similarity_score: 0.8,
        reasons: ['Same demo locality'],
        differences: [],
        review_recommendation: 'compare_records',
      })),
      disclaimer: DUPLICATE_DISCLAIMER,
      method: 'test-fixture',
      min_score: 0.55,
    };
  }
}
