import { Response, NextFunction } from 'express';
import { User } from '../models/User';
import { Booking } from '../models/Booking';
import { Invoice } from '../models/Invoice';
import { Technician } from '../models/Technician';
import { Review } from '../models/Review';
import { AuthRequest } from '../middleware/auth';
import { parsePagination, parseRole, parseSearch, toObjectId } from '../utils/mongoQuery';
import { logAdminAction } from '../utils/auditLog';

/** Arithmetic mean of 1–5 star reviews, rounded to 2 decimals. */
function averageRating(sum: number, count: number): number {
  if (count <= 0) return 0;
  return Math.round((sum / count) * 100) / 100;
}

export const getDashboardStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const [
      totalBookings,
      pendingBookings,
      ongoingBookings,
      completedBookings,
      totalRevenue,
      totalClients,
      totalTechnicians,
    ] = await Promise.all([
      Booking.countDocuments({ status: { $ne: 'cancelled' } }),
      Booking.countDocuments({ status: { $in: ['pending', 'confirmed'] } }),
      Booking.countDocuments({
        status: {
          $in: ['technician_assigned', 'en_route', 'arrived', 'in_progress'],
        },
      }),
      Booking.countDocuments({ status: 'completed' }),
      Invoice.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      User.countDocuments({ role: 'client', isActive: true }),
      User.countDocuments({ role: 'technician', isActive: true }),
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalBookings,
        pendingBookings,
        ongoingBookings,
        completedBookings,
        totalRevenue: totalRevenue[0]?.total || 0,
        totalClients,
        totalTechnicians,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getAllUsers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const role = parseRole(req.query.role);
    const search = parseSearch(req.query.search);
    const filter: Record<string, unknown> = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await User.countDocuments(filter);

    const techIds = users
      .filter(
        (u) => u.role === 'technician' || u.role === 'master_technician'
      )
      .map((u) => u._id);

    const ratingByTech = new Map<
      string,
      { rating: number; ratingCount: number }
    >();

    if (techIds.length > 0) {
      const rows = await Review.aggregate<{
        _id: (typeof techIds)[number];
        ratingCount: number;
        ratingSum: number;
      }>([
        { $match: { technicianId: { $in: techIds } } },
        {
          $group: {
            _id: '$technicianId',
            ratingCount: { $sum: 1 },
            ratingSum: { $sum: '$rating' },
          },
        },
      ]);

      for (const row of rows) {
        const ratingCount = row.ratingCount ?? 0;
        const rating = averageRating(row.ratingSum ?? 0, ratingCount);
        ratingByTech.set(String(row._id), { rating, ratingCount });

        // Keep Technician profile cache aligned with live aggregate.
        void Technician.updateOne(
          { userId: row._id },
          { $set: { rating, ratingCount } }
        ).catch(() => undefined);
      }
    }

    const enriched = users.map((u) => {
      const stats = ratingByTech.get(String(u._id));
      const isTech =
        u.role === 'technician' || u.role === 'master_technician';
      return {
        ...u,
        rating: isTech ? stats?.rating ?? 0 : undefined,
        ratingCount: isTech ? stats?.ratingCount ?? 0 : undefined,
      };
    });

    res.status(200).json({
      success: true,
      users: enriched,
      total,
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
};

export const toggleUserStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(toObjectId(req.params.id));
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    user.isActive = !user.isActive;
    await user.save();
    await logAdminAction({
      adminId: req.user!.id,
      action: user.isActive ? 'user.activate' : 'user.deactivate',
      targetType: 'user',
      targetId: user._id.toString(),
      metadata: { role: user.role },
    });
    res.status(200).json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'}`,
    });
  } catch (err) {
    next(err);
  }
};

export const getAnalytics = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [bookingsByType, revenueByMonth, bookingsByStatus] = await Promise.all([
      Booking.aggregate([
        { $group: { _id: '$serviceType', count: { $sum: 1 } } },
      ]),
      Invoice.aggregate([
        { $match: { status: 'paid', createdAt: { $gte: last30Days } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$totalAmount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Booking.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      analytics: { bookingsByType, revenueByMonth, bookingsByStatus },
    });
  } catch (err) {
    next(err);
  }
};
