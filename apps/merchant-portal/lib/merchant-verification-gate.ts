export type MerchantVerificationGate = "approved" | "awaiting_approval" | "needs_verification";

export function merchantVerificationGateFromProfile(profile: {
  verificationStatus?: "PENDING" | "APPROVED" | "REJECTED";
  verifications?: unknown[] | null;
} | null): MerchantVerificationGate {
  if (!profile) return "needs_verification";
  if (profile.verificationStatus === "APPROVED") return "approved";
  const hasSubmitted =
    Array.isArray(profile.verifications) && profile.verifications.length > 0;
  if (profile.verificationStatus === "PENDING" && hasSubmitted) {
    return "awaiting_approval";
  }
  return "needs_verification";
}
