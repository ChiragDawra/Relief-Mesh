import type { z } from 'zod';
import {
  duplicateResponseSchema,
  intakeResponseSchema,
  type CaseCategory,
  type DuplicateResponse,
  type IntakeResponse,
  type RequestedItem,
} from '@reliefmesh/shared';

export class AiUnavailableError extends Error {}

export interface IntakeRequest {
  case_id: string;
  description: string;
  locality_label: string;
  submitted_at: string;
}

/** Minimized case data sent for duplicate ranking: no actors, notes, amounts or wallets. */
export interface CaseSummary {
  case_id: string;
  description: string;
  locality_label: string;
  category: CaseCategory;
  household_count: number | null;
  requested_items: RequestedItem[];
  submitted_at: string;
}

export interface DuplicateRequest {
  case: CaseSummary;
  candidates: CaseSummary[];
}

export interface AiClient {
  intake(input: IntakeRequest): Promise<IntakeResponse>;
  duplicates(input: DuplicateRequest): Promise<DuplicateResponse>;
}

export class HttpAiClient implements AiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly internalToken: string,
    private readonly timeoutMs = 15_000,
  ) {}

  intake(input: IntakeRequest): Promise<IntakeResponse> {
    return this.post('/v1/intake', input, intakeResponseSchema);
  }

  duplicates(input: DuplicateRequest): Promise<DuplicateResponse> {
    return this.post('/v1/duplicates', input, duplicateResponseSchema);
  }

  private async post<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-token': this.internalToken },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new AiUnavailableError('AI service unreachable');
    }
    if (!res.ok) throw new AiUnavailableError(`AI service returned ${res.status}`);
    const parsed = schema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) throw new AiUnavailableError('AI service returned an invalid response');
    return parsed.data;
  }
}
