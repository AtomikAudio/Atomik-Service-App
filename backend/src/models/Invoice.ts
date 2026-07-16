import mongoose, { Document, Schema } from 'mongoose';

export type InvoicePaymentType = 'base_service' | 'extra_parts' | 'full';

export interface IInvoicePaymentEntry {
  amount: number;
  type: InvoicePaymentType;
  paidAt: Date;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
}

export interface IInvoice extends Document {
  invoiceNumber: string;
  bookingId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  serviceCharges: number;
  technicianCharges: number;
  spareParts: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  /** Cumulative amount settled; used when extra parts increase total after partial/full pay */
  amountPaid: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  dueDate: Date;
  paidAt?: Date;
  paymentId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  /** Applied promo coupon for the pending / settled charge */
  couponCode?: string;
  discountPercent?: number;
  discountAmount?: number;
  paymentHistory: IInvoicePaymentEntry[];
}

const invoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, unique: true, required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    serviceCharges: { type: Number, required: true, default: 0 },
    technicianCharges: { type: Number, required: true, default: 0 },
    spareParts: { type: Number, required: true, default: 0 },
    taxRate: { type: Number, default: 0.18 },
    taxAmount: { type: Number, required: true, default: 0 },
    totalAmount: { type: Number, required: true },
    amountPaid: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'paid', 'overdue', 'cancelled'],
      default: 'pending',
    },
    dueDate: { type: Date, required: true },
    paidAt: Date,
    paymentId: String,
    razorpayOrderId: String,
    razorpayPaymentId: String,
    couponCode: String,
    discountPercent: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    paymentHistory: [
      {
        amount: { type: Number, required: true },
        type: {
          type: String,
          enum: ['base_service', 'extra_parts', 'full'],
          required: true,
        },
        paidAt: { type: Date, required: true },
        razorpayOrderId: String,
        razorpayPaymentId: String,
      },
    ],
  },
  { timestamps: true }
);

invoiceSchema.index({ clientId: 1, status: 1 });

export const Invoice = mongoose.model<IInvoice>('Invoice', invoiceSchema);
