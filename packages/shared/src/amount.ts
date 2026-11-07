/**
 * Integer-only conversions between base units and display amounts.
 * No binary floating point is ever used for token accounting.
 */

export function formatBaseUnits(value: string | bigint, decimals: number): string {
  const amount = BigInt(value);
  const negative = amount < 0n;
  const digits = (negative ? -amount : amount).toString().padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = digits.slice(digits.length - decimals).replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

/** Parses a user-typed amount like "25" or "25.5" into base units; null if invalid. */
export function parseDisplayAmount(input: string, decimals: number): string | null {
  const match = /^(\d{1,20})(?:\.(\d+))?$/.exec(input.trim());
  if (!match) return null;
  const whole = match[1]!;
  const fraction = match[2] ?? '';
  if (fraction.length > decimals) return null;
  return BigInt(whole + fraction.padEnd(decimals, '0')).toString();
}
