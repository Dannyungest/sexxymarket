import { buildNumericCode } from './numeric-code';

export function buildMerchantCode(): string {
  return buildNumericCode(10);
}
