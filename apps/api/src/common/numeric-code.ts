import crypto from 'crypto';

export function buildNumericCode(length = 10): string {
  const safeLength = Math.max(6, Math.min(18, Math.trunc(length)));
  const digits: string[] = [];
  while (digits.length < safeLength) {
    const chunk = crypto.randomBytes(8).toString('hex').replace(/\D/g, '');
    if (!chunk) continue;
    for (const char of chunk) {
      digits.push(char);
      if (digits.length >= safeLength) break;
    }
  }
  if (digits[0] === '0') {
    digits[0] = String((Number(digits[1] ?? '1') % 9) + 1);
  }
  return digits.join('');
}

export function normalizeNumericCode(
  input?: string | null,
): string | undefined {
  if (!input) return undefined;
  const digits = input.replace(/\D/g, '');
  return digits.length > 0 ? digits : undefined;
}
