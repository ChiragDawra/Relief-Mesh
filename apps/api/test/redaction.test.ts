import { describe, expect, it } from 'vitest';
import { redactContactDetails } from '../src/services/redaction';

describe('redactContactDetails', () => {
  it('masks phone numbers and emails', () => {
    expect(redactContactDetails('Call +1 (555) 010-9999 or mail demo.person@example.org')).toBe(
      'Call [redacted phone] or mail [redacted email]',
    );
  });

  it('keeps quantities, amounts and dates readable', () => {
    const text = 'Request 25 litres for 5 households by 2026-11-08, budget 25000000 base units';
    expect(redactContactDetails(text)).toBe(text);
  });
});
