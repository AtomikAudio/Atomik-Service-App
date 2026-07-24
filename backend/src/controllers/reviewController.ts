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

    // Mark prompts handled so they never reappear after re-login.
    await Booking.updateOne(
      { _id: bookingId },
      { $set: { clientCompletionAckAt: new Date() } }
    ).catch(() => undefined);

    // Recompute technician average from all reviews (source of truth).
    const agg = await Review.aggregate<{
      ratingCount: number;
      ratingSum: number;
    }>([
      { $match: { technicianId: new mongoose.Types.ObjectId(techUserId) } },
      {
        $group: {
          _id: null,
          ratingCount: { $sum: 1 },
          ratingSum: { $sum: '$rating' },
        },
      },
    ]);
    const ratingCount = agg[0]?.ratingCount ?? 0;
    const ratingSum = agg[0]?.ratingSum ?? 0;
    const nextAvg =
      ratingCount > 0
        ? Math.round((ratingSum / ratingCount) * 100) / 100
        : 0;
    await Technician.updateOne(
      { userId: techUserId },
      { $set: { rating: nextAvg, ratingCount } }
    ).catch(() => undefined);

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

/**
 * Logged-in technician's average client rating.
 * Formula: arithmetic mean of all 1–5 star reviews, rounded to 2 decimals.
 */
export const getMyRating = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const techId = req.user!.id;
    const rows = await Review.aggregate<{
      ratingCount: number;
      ratingSum: number;
    }>([
      { $match: { technicianId: new mongoose.Types.ObjectId(techId) } },
      {
        $group: {
          _id: null,
          ratingCount: { $sum: 1 },
          ratingSum: { $sum: '$rating' },
        },
      },
    ]);

    const ratingCount = rows[0]?.ratingCount ?? 0;
    const ratingSum = rows[0]?.ratingSum ?? 0;
    const average =
      ratingCount > 0
        ? Math.round((ratingSum / ratingCount) * 100) / 100
        : 0;

    // Keep Technician profile cache in sync with live aggregate.
    await Technician.updateOne(
      { userId: techId },
      { $set: { rating: average, ratingCount } }
    ).catch(() => undefined);

    res.status(200).json({
      success: true,
      rating: average,
      ratingCount,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin: all client ratings for one technician
 * (client name, venue, stars, booking ref).
 */
export const getTechnicianReviewsForAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const technicianId = toObjectId(req.params.technicianId);
    const tech = await User.findById(technicianId).select('name role email phone');
    if (!tech) {
      res.status(404).json({ success: false, message: 'Technician not found' });
      return;
    }
    if (
      tech.role !== 'technician' &&
      tech.role !== 'master_technician'
    ) {
      res.status(400).json({
        success: false,
        message: 'User is not a technician',
      });
      return;
    }

    const reviews = await Review.find({ technicianId })
      .sort({ createdAt: -1 })
      .populate('clientId', 'name phone email')
      .populate({
        path: 'bookingId',
        select: 'bookingId serviceType scheduledDate scheduledTime venueId',
        populate: { path: 'venueId', select: 'name area city' },
      })
      .lean();

    const ratingCount = reviews.length;
    const ratingSum = reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0);
    const average =
      ratingCount > 0
        ? Math.round((ratingSum / ratingCount) * 100) / 100
        : 0;

    res.status(200).json({
      success: true,
      technician: {
        id: tech._id.toString(),
        name: tech.name,
        email: tech.email ?? '',
        phone: tech.phone ?? '',
        role: tech.role,
      },
      rating: average,
      ratingCount,
      reviews: reviews.map((r) => {
        const client =
          r.clientId && typeof r.clientId === 'object'
            ? (r.clientId as { name?: string; phone?: string; email?: string })
            : null;
        const booking =
          r.bookingId && typeof r.bookingId === 'object'
            ? (r.bookingId as {
                bookingId?: string;
                serviceType?: string;
                scheduledDate?: Date;
                scheduledTime?: string;
                venueId?:
                  | { name?: string; area?: string; city?: string }
                  | string;
              })
            : null;
        const venue =
          booking?.venueId && typeof booking.venueId === 'object'
            ? booking.venueId
            : null;
        const venueLabel = venue
          ? [venue.name, venue.area || venue.city].filter(Boolean).join(' · ')
          : 'Venue unavailable';

        return {
          id: String(r._id),
          rating: r.rating,
          comment: r.comment ?? null,
          createdAt: r.createdAt,
          clientName: client?.name?.trim() || 'Client',
          clientPhone: client?.phone ?? null,
          venueName: venueLabel,
          bookingCode: booking?.bookingId ?? null,
          serviceType: booking?.serviceType ?? null,
          bookingId:
            booking && (booking as { _id?: unknown })._id != null
              ? String((booking as { _id: unknown })._id)
              : String(r.bookingId),
        };
      }),
    });
  } catch (err) {
    next(err);
  }
};
