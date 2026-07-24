import mongoose, { Document, Schema } from 'mongoose';

export interface IReview extends Document {
  bookingId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  technicianId: mongoose.Types.ObjectId;
  rating: number;
  comment?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    technicianId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: String,
    tags: [{ type: String, enum: ['punctual', 'professional', 'thorough', 'skilled', 'clean'] }],
  },
  { timestamps: true }
);

export const Review = mongoose.model<IReview>('Review', reviewSchema);
