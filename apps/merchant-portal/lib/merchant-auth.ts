export const MERCHANT_TOKEN_KEY = "sm_merchant_access_token";

export function getMerchantToken(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return localStorage.getItem(MERCHANT_TOKEN_KEY) ?? "";
}
export const MERCHANT_NAME_KEY = "sm_merchant_business_name";
export const MERCHANT_TOKEN_COOKIE = "sm_merchant_access_token";
