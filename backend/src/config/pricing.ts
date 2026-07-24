/**
 * Canonical service pricing (pre-GST). Invoice totals always add GST_RATE.
 * general  → General Service package
 * inspection → General Visit
 */
export const GST_RATE = 0.18;

export type PricedServiceType =
  | 'general'
  | 'inspection'
  | 'installation'
  | 'emergency';

/** Pre-tax package amounts charged on booking create. */
export const SERVICE_PACKAGE_PRETAX: Record<PricedServiceType, number> = {
  general: 15_000,
  inspection: 3_500,
  installation: 15_000,
  emergency: 15_000,
};

export function resolveInvoiceCharges(serviceType: string): {
  serviceCharges: number;
  technicianCharges: number;
  spareParts: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
} {
  const key = (
    ['general', 'inspection', 'installation', 'emergency'] as const
  ).includes(serviceType as PricedServiceType)
    ? (serviceType as PricedServiceType)
    : 'general';

  const serviceCharges = SERVICE_PACKAGE_PRETAX[key];
  const technicianCharges = 0;
  const spareParts = 0;
  const taxRate = GST_RATE;
  const subtotal = serviceCharges + technicianCharges + spareParts;
  const taxAmount = Math.round(subtotal * taxRate);
  const totalAmount = subtotal + taxAmount;

  return {
    serviceCharges,
    technicianCharges,
    spareParts,
    taxRate,
    taxAmount,
    totalAmount,
  };
}
