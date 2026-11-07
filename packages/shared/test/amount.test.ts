import { describe, expect, it } from 'vitest';
import { formatBaseUnits, parseDisplayAmount } from '../src/amount';

describe('formatBaseUnits', () => {
  it('formats base units with mint decimals', () => {
    expect(formatBaseUnits('25000000', 6)).toBe('25');
    expect(formatBaseUnits('25500000', 6)).toBe('25.5');
    expect(formatBaseUnits('1', 6)).toBe('0.000001');
    expect(formatBaseUnits(1234567890000n, 6)).toBe('1,234,567.89');
    expect(formatBaseUnits('42', 0)).toBe('42');
  });

  it('is exact for the full u64 range', () => {
    expect(formatBaseUnits('18446744073709551615', 6)).toBe('18,446,744,073,709.551615');
  });
});

describe('parseDisplayAmount', () => {
  it('converts display amounts to base-unit strings', () => {
    expect(parseDisplayAmount('25', 6)).toBe('25000000');
    expect(parseDisplayAmount(' 0.1 ', 6)).toBe('100000');
    expect(parseDisplayAmount('0.000001', 6)).toBe('1');
  });

  it('rejects malformed or over-precise input', () => {
    expect(parseDisplayAmount('0.0000001', 6)).toBeNull();
    expect(parseDisplayAmount('-1', 6)).toBeNull();
    expect(parseDisplayAmount('1e6', 6)).toBeNull();
    expect(parseDisplayAmount('', 6)).toBeNull();
  });

  it('round-trips without floating point loss', () => {
    expect(parseDisplayAmount('0.3', 6)).toBe('300000');
    expect(formatBaseUnits(parseDisplayAmount('0.1', 6)!, 6)).toBe('0.1');
  });
});
