const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Digit runs with common phone separators; only masked when they hold 9+ digits,
// so quantities, amounts and dates stay readable.
const PHONE_LIKE = /\+?\d[\d\s().-]{6,}\d/g;

/**
 * Masks contact details before a description is stored or sent to the AI service.
 * Demo data must be synthetic anyway; this is defence in depth, not a PII guarantee.
 */
export function redactContactDetails(text: string): string {
  return text
    .replace(EMAIL, '[redacted email]')
    .replace(PHONE_LIKE, (match) => (match.replace(/\D/g, '').length >= 9 ? '[redacted phone]' : match));
}
