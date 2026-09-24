const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';

function randomCharFrom(pool: string): string {
  return pool[Math.floor(Math.random() * pool.length)] ?? '';
}

/**
 * Generates an ID from a format template.
 * - A–Z → random uppercase letter
 * - a–z → random lowercase letter
 * - 0–9 → random digit
 * - any other character → copied literally
 */
export function generateCampaignPublicIdFromFormat(format: string): string {
  let result = '';

  for (const char of format) {
    if (char >= 'A' && char <= 'Z') {
      result += randomCharFrom(UPPERCASE);
    } else if (char >= 'a' && char <= 'z') {
      result += randomCharFrom(LOWERCASE);
    } else if (char >= '0' && char <= '9') {
      result += randomCharFrom(DIGITS);
    } else {
      result += char;
    }
  }

  return result;
}

export function validateCampaignIdFormat(format: string): void {
  const trimmed = format.trim();

  if (!trimmed) {
    throw new Error('Format is required');
  }

  if (trimmed.length > 128) {
    throw new Error('Format must be at most 128 characters');
  }

  const hasRandomSlot = [...trimmed].some(
    (char) =>
      (char >= 'A' && char <= 'Z') ||
      (char >= 'a' && char <= 'z') ||
      (char >= '0' && char <= '9'),
  );

  if (!hasRandomSlot) {
    throw new Error(
      'Format must include at least one letter or digit placeholder',
    );
  }
}
