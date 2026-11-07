import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPLICATION_STATUSES } from '../src/enums';
import { ALLOWED_TRANSITIONS, canTransition } from '../src/lifecycle';

const migration = readFileSync(
  new URL('../../../supabase/migrations/0002_workflow.sql', import.meta.url),
  'utf8',
);

function sqlTransitions(): string[] {
  const start = migration.indexOf('function public.case_transition_allowed');
  const body = migration.slice(start, migration.indexOf('$$;', start));
  return [...body.matchAll(/\('([a-z_]+)', '([a-z_]+)'\)/g)].map((m) => `${m[1]}->${m[2]}`).sort();
}

describe('case lifecycle', () => {
  it('matches the database transition guard exactly', () => {
    const ts = Object.entries(ALLOWED_TRANSITIONS)
      .flatMap(([from, tos]) => tos.map((to) => `${from}->${to}`))
      .sort();
    expect(ts).toEqual(sqlTransitions());
  });

  it('covers every status', () => {
    expect(Object.keys(ALLOWED_TRANSITIONS).sort()).toEqual([...APPLICATION_STATUSES].sort());
  });

  it('only completes a case after delivery verification', () => {
    expect(canTransition('delivery_verified', 'completed')).toBe(true);
    expect(canTransition('funded', 'completed')).toBe(false);
    expect(canTransition('delivery_submitted', 'completed')).toBe(false);
  });

  it('keeps terminal statuses terminal', () => {
    for (const status of ['completed', 'flagged', 'cancelled', 'expired', 'rejected'] as const) {
      expect(ALLOWED_TRANSITIONS[status]).toEqual([]);
    }
  });
});
