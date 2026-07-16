/** Client-side test / launch coupons (must match backend/src/utils/coupons.ts). */
export const TEST_COUPONS: Record<
  string,
  { code: string; percent: number; label: string }
> = {
  SID123: {
    code: 'Sid123',
    percent: 30,
    label: '30% flat discount',
  },
};

export function normalizeCouponCode(raw?: string | null): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase();
}

export function resolveLocalCoupon(raw?: string | null) {
  const key = normalizeCouponCode(raw);
  if (!key) return null;
  return TEST_COUPONS[key] ?? null;
}

export function applyLocalCoupon(
  amount: number,
  couponCode?: string | null
): {
  couponCode: string;
  discountPercent: number;
  discountAmount: number;
  originalAmount: number;
  chargeAmount: number;
  label: string;
} | null {
  const coupon = resolveLocalCoupon(couponCode);
  if (!coupon) return null;
  const originalAmount = Math.round((Number(amount) || 0) * 100) / 100;
  const discountAmount =
    Math.round(((originalAmount * coupon.percent) / 100) * 100) / 100;
  const chargeAmount =
    Math.round(Math.max(0, originalAmount - discountAmount) * 100) / 100;
  return {
    couponCode: coupon.code,
    discountPercent: coupon.percent,
    discountAmount,
    originalAmount,
    chargeAmount,
    label: coupon.label,
  };
}
