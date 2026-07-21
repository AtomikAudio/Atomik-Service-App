interface CouponDef {
  code: string;
  label: string;
  /** Flat percentage discount (used when fixedFinalAmount is not set). */
  percent?: number;
  /**
   * Forces the final payable amount to this value (e.g. ₹1 test coupon).
   * The effective discount percentage is computed from the actual amount.
   */
  fixedFinalAmount?: number;
}

/** Known promotional coupons (test / launch codes). */
export const COUPONS: Record<string, CouponDef> = {
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

export function resolveCoupon(raw?: string | null): CouponDef | null {
  const key = normalizeCouponCode(raw);
  if (!key) return null;
  return COUPONS[key] ?? null;
}

/** Round to 2 decimal places (INR paise-safe). */
export function roundMoney(amount: number): number {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

/**
 * Apply a flat percent discount to a charge amount.
 * Returns null if the code is invalid.
 */
export function applyCouponToAmount(
  amount: number,
  couponCode?: string | null
): {
  originalAmount: number;
  discountPercent: number;
  discountAmount: number;
  chargeAmount: number;
  couponCode: string;
  label: string;
} | null {
  const coupon = resolveCoupon(couponCode);
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
    originalAmount,
    discountPercent,
    discountAmount,
    chargeAmount,
    couponCode: coupon.code,
    label: coupon.label,
  };
}
