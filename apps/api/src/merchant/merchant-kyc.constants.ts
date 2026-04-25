import { BusinessType } from '@prisma/client';

/**
 * Submitted on verification documents; must be a subset of this list.
 */
export const KYC_DOCUMENT_TYPES = [
  'id_front',
  'id_back',
  'proof_of_address',
  'business_proof_of_address',
  'cac_certificate',
  'cac_status_report',
] as const;

export type KycDocumentType = (typeof KYC_DOCUMENT_TYPES)[number];

export const REQUIRED_DOCS_BASE: KycDocumentType[] = [
  'id_front',
  'proof_of_address',
  'business_proof_of_address',
];

export const REQUIRED_DOCS_REGISTERED_EXTRA: KycDocumentType[] = [
  'cac_certificate',
  'cac_status_report',
];

export function requiredDocumentSet(
  businessType: BusinessType,
): Set<KycDocumentType> {
  const set = new Set<KycDocumentType>([...REQUIRED_DOCS_BASE]);
  if (businessType === 'REGISTERED_BUSINESS') {
    for (const t of REQUIRED_DOCS_REGISTERED_EXTRA) {
      set.add(t);
    }
  }
  return set;
}

export function normalizeMatchName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\u00C0-\u024F\u1E00-\u1EFF\s]/gi, '')
    .trim();
}

/**
 * Payout / settlement name must match business or owner legal name.
 */
export function settlementNameMatchesPayout(
  payoutAccountName: string,
  businessName: string,
  firstName: string,
  lastName: string,
  businessType: BusinessType,
): boolean {
  const p = normalizeMatchName(payoutAccountName);
  if (!p) return false;
  const payoutTokens = p.split(' ').filter(Boolean);
  const b = normalizeMatchName(businessName);
  const businessTokens = b.split(' ').filter(Boolean);
  if (b && p === b) {
    return true;
  }
  if (
    businessTokens.length >= 2 &&
    payoutTokens.length >= 2 &&
    payoutTokens.every((token) => businessTokens.includes(token))
  ) {
    return true;
  }
  if (businessType === 'INDIVIDUAL') {
    const ownerTokens = normalizeMatchName(`${firstName} ${lastName}`)
      .split(' ')
      .filter(Boolean);
    const full = ownerTokens.join(' ');
    if (full && p === full) {
      return true;
    }
    if (ownerTokens.length >= 2 && payoutTokens.length >= 2) {
      const subset = payoutTokens.every((token) => ownerTokens.includes(token));
      const reverseSubset = ownerTokens.every((token) =>
        payoutTokens.includes(token),
      );
      if (subset || reverseSubset) {
        return true;
      }
    }
    const first = normalizeMatchName(firstName);
    const last = normalizeMatchName(lastName);
    if (first && last && p === `${first}${last}`) {
      return true;
    }
  }
  if (b && (p.startsWith(b) || b.startsWith(p))) {
    return true;
  }
  return false;
}
