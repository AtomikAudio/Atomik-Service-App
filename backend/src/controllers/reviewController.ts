import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { Booking } from '../models/Booking';
import { Review } from '../models/Review';
import { Technician } from '../models/Technician';
import { User } from '../models/User';
import { toObjectId } from '../utils/mongoQuery';

function resolveTechUserId(booking: {
  technicianId?: mongoose.Types.ObjectId | { _id?: mongoose.Types.ObjectId };
}): string | null {
  const tech = booking.technicianId;
  if (!tech) return null;
  if (typeof tech === 'object' && tech._id) return String(tech._id);
  return String(tech);
}

/** Client rates the assigned technician after a completed booking (one review per booking). */
export const createReview = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const bookingId = toObjectId(req.params.bookingId);
    const rating = Number(req.body.rating);
    const comment =
      typeof req.body.comment === 'string' ? req.body.comment.trim() : undefined;

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({
        success: false,
        message: 'Rating must be a whole number from 1 to 5',
      });
      return;
    }

    const booking = await Booking.findById(bookingId).populate(
      'technicianId',
      'name role'
    );
    if (!booking) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }

    const clientId = String(booking.clientId);
    if (clientId !== req.user!.id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    if (booking.status !== 'completed') {
      res.status(400).json({
        success: false,
        message: 'You can rate only after the service is completed',
      });
      return;
    }

    const techUserId = resolveTechUserId(booking);
    if (!techUserId) {
      res.status(400).json({
        success: false,
        message: 'No technician assigned to this booking',
      });
      return;
    }

    const techUser = await User.findById(techUserId).select('role name');
    if (
      !techUser ||
      (techUser.role !== 'technician' && techUser.role !== 'master_technician')
    ) {
      res.status(400).json({
        success: false,
        message: 'Only technicians can be rated',
      });
      return;
    }

    const existing = await Review.findOne({ bookingId });
    if (existing) {
      res.status(400).json({
        success: false,
        message: 'You have already rated this service',
        review: {
          rating: existing.rating,
          technicianName: techUser.name,
        },
      });
      return;
    }

    const review = await Review.create({
      bookingId,
      clientId: new mongoose.Types.ObjectId(req.user!.id),
      technicianId: new mongoose.Types.ObjectId(techUserId),
      rating,
      comment: comment || undefined,
      tags: [],
    });

    const profile = await Technician.findOne({ userId: techUserId });
    if (profile) {
      const prevCount = profile.ratingCount ?? 0;
      const prevAvg = profile.rating ?? 0;
      const nextCount = prevCount + 1;
      const nextAvg =
        Math.round(((prevAvg * prevCount + rating) / nextCount) * 100) / 100;
      profile.ratingCount = nextCount;
      profile.rating = nextAvg;
      await profile.save();
    }

    res.status(201).json({
      success: true,
      review: {
        id: review._id.toString(),
        bookingId: String(bookingId),
        rating: review.rating,
        technicianName: techUser.name,
      },
    });
  } catch (err) {
    next(err);
  }
};

/** Whether the client has already rated a booking. */
export const getReviewForBooking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const bookingId = toObjectId(req.params.bookingId);
    const booking = await Booking.findById(bookingId).select('clientId');
    if (!booking) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }
    if (String(booking.clientId) !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const review = await Review.findOne({ bookingId }).select('rating comment createdAt');
    res.status(200).json({
      success: true,
      reviewed: Boolean(review),
      review: review
        ? {
            rating: review.rating,
            comment: review.comment,
            createdAt: review.createdAt,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
};
