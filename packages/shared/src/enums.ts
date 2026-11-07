export const CASE_CATEGORIES = ['food', 'water', 'shelter', 'medical', 'transport', 'other'] as const;
export type CaseCategory = (typeof CASE_CATEGORIES)[number];

export const APPLICATION_STATUSES = [
  'submitted',
  'needs_information',
  'under_review',
  'approved',
  'funded',
  'delivery_submitted',
  'delivery_verified',
  'completed',
  'flagged',
  'cancelled',
  'expired',
  'rejected',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const AI_STATUSES = ['pending', 'completed', 'unavailable', 'needs_review', 'failed'] as const;
export type AiStatus = (typeof AI_STATUSES)[number];

export const CHAIN_STATUSES = ['created', 'funded', 'released', 'refunded', 'unknown'] as const;
export type ChainStatus = (typeof CHAIN_STATUSES)[number];

export const ROLES = ['field_worker', 'ngo_reviewer', 'supplier', 'donor', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const ORGANIZATION_TYPES = ['ngo', 'supplier', 'donor_group', 'admin'] as const;
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export const URGENCY_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type Urgency = (typeof URGENCY_LEVELS)[number];

export const REVIEW_DECISIONS = ['approve', 'needs_information', 'flag', 'reject'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export const REASON_CODES = [
  'complete_request',
  'missing_details',
  'possible_duplicate',
  'out_of_scope',
  'other',
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];
