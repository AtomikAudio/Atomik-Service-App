/** Known promotional coupons (test / launch codes). */
export const COUPONS: Record<
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

export function resolveCoupon(raw?: string | null): {
  code: string;
  percent: number;
  label: string;
} | null {
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
  const discountAmount = roundMoney(
    (originalAmount * coupon.percent) / 100
  );
  const chargeAmount = roundMoney(
    Math.max(0, originalAmount - discountAmount)
  );

  return {
    originalAmount,
    discountPercent: coupon.percent,
    discountAmount,
    chargeAmount,
    couponCode: coupon.code,
    label: coupon.label,
  };
}
