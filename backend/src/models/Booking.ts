import mongoose, { Document, Schema } from 'mongoose';

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'technician_assigned'
  | 'en_route'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type RescheduleParty = 'technician' | 'client';
export type RescheduleStatus = 'pending_client' | 'pending_technician';

export interface IRescheduleHistoryEntry {
  proposedDate: Date;
  proposedTime: string;
  proposedBy: RescheduleParty;
  note?: string;
  at: Date;
}

export interface IBookingReschedule {
  status: RescheduleStatus;
  proposedDate: Date;
  proposedTime: string;
  proposedBy: RescheduleParty;
  note?: string;
  updatedAt: Date;
  history: IRescheduleHistoryEntry[];
}

export interface IBooking extends Document {
  bookingId: string;
  clientId: mongoose.Types.ObjectId;
  technicianId?: mongoose.Types.ObjectId;
  /** Set when a master technician assigns the job — technician cannot self-drop */
  assignedByMasterId?: mongoose.Types.ObjectId;
  /** @deprecated Legacy manual imports — use technicianId */
  assignedTechnicianId?: mongoose.Types.ObjectId;
  venueId: mongoose.Types.ObjectId;
  serviceType: 'general' | 'inspection' | 'installation' | 'emergency';
  scheduledDate: Date;
  scheduledTime: string;
  status: BookingStatus;
  rejectedBy: mongoose.Types.ObjectId[];
  statusHistory: {
    status: BookingStatus;
    timestamp: Date;
    notes?: string;
    updatedBy: mongoose.Types.ObjectId;
  }[];
  spareParts: {
    name: string;
    quantity: number;
    unitCost: number;
  }[];
  notes?: string;
  technicianNotes?: string;
  serviceImages: string[];
  completedAt?: Date;
  /** Client dismissed the in-app "Service completed" dialog. */
  clientCompletionAckAt?: Date;
  /** Client dismissed the rate-technician prompt without submitting a review. */
  clientRatingDismissedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  invoiceId?: mongoose.Types.ObjectId;
  reschedule?: IBookingReschedule;
}

const bookingSchema = new Schema<IBooking>(
  {
    bookingId: {
      type: String,
      unique: true,
      required: true,
    },
    clientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    technicianId: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedByMasterId: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedTechnicianId: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    venueId: { type: Schema.Types.ObjectId, ref: 'Venue', required: true },
    serviceType: {
      type: String,
      enum: ['general', 'inspection', 'installation', 'emergency'],
      required: true,
    },
    scheduledDate: { type: Date, required: true },
    scheduledTime: { type: String, required: true },
    status: {
      type: String,
      enum: [
        'pending', 'confirmed', 'technician_assigned',
        'en_route', 'arrived', 'in_progress', 'completed', 'cancelled',
      ],
      default: 'pending',
    },
    statusHistory: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
        notes: String,
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    spareParts: [
      {
        name: String,
        quantity: { type: Number, default: 1 },
        unitCost: Number,
      },
    ],
    notes: String,
    technicianNotes: String,
    serviceImages: [String],
    completedAt: Date,
    clientCompletionAckAt: Date,
    clientRatingDismissedAt: Date,
    cancelledAt: Date,
    cancellationReason: String,
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
    reschedule: {
      status: { type: String, enum: ['pending_client', 'pending_technician'] },
      proposedDate: Date,
      proposedTime: String,
      proposedBy: { type: String, enum: ['technician', 'client'] },
      note: String,
      updatedAt: Date,
      history: [
        {
          proposedDate: Date,
          proposedTime: String,
          proposedBy: { type: String, enum: ['technician', 'client'] },
          note: String,
          at: { type: Date, default: Date.now },
        },
      ],
    },
  },
  { timestamps: true }
);

bookingSchema.index({ clientId: 1, status: 1 });
bookingSchema.index({ technicianId: 1, status: 1 });
bookingSchema.index({ scheduledDate: 1 });
bookingSchema.index({ scheduledDate: 1, scheduledTime: 1, status: 1 });

export const Booking = mongoose.model<IBooking>('Booking', bookingSchema);
