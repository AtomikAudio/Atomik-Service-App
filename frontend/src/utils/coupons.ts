interface LocalCoupon {
  code: string;
  label: string;
  /** Flat percentage discount (used when fixedFinalAmount is not set). */
  percent?: number;
  /** Forces the final payable amount (e.g. ₹1 test coupon). */
  fixedFinalAmount?: number;
}

/** Client-side test / launch coupons (must match backend/src/utils/coupons.ts). */
export const TEST_COUPONS: Record<string, LocalCoupon> = {
  SID123: {
    code: 'Sid123',
    fixedFinalAmount: 1,
    label: 'Pay only ₹1 (test)',
  },
};

export function normalizeCouponCode(raw?: string | null): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase();
}

export function resolveLocalCoupon(raw?: string | null): LocalCoupon | null {
  const key = normalizeCouponCode(raw);
  if (!key) return null;
  return TEST_COUPONS[key] ?? null;
}

const roundMoney = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

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

  const originalAmount = roundMoney(amount);

  let chargeAmount: number;
  let discountAmount: number;
  let discountPercent: number;

  if (typeof coupon.fixedFinalAmount === 'number') {
    // Fixed final amount (e.g. ₹1): charge that, derive the % for display.
    chargeAmount = roundMoney(Math.min(coupon.fixedFinalAmount, originalAmount));
    discountAmount = roundMoney(Math.max(0, originalAmount - chargeAmount));
    discountPercent =
      originalAmount > 0
        ? Math.floor((discountAmount / originalAmount) * 100)
        : 0;
  } else {
    discountPercent = coupon.percent ?? 0;
    discountAmount = roundMoney((originalAmount * discountPercent) / 100);
    chargeAmount = roundMoney(Math.max(0, originalAmount - discountAmount));
  }

  return {
    couponCode: coupon.code,
    discountPercent,
    discountAmount,
    originalAmount,
    chargeAmount,
    label: coupon.label,
  };
}
