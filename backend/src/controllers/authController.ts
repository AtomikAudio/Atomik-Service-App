import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Booking } from '../models/Booking';
import { generateToken } from '../utils/jwt';
import { AuthRequest } from '../middleware/auth';
import { toE164 } from '../utils/phone';
import { findUserByLoginIdentifier } from '../utils/userLookup';
import { verifyPhoneOtp } from './otpController';
import crypto from 'crypto';
import cloudinary from '../config/cloudinary';
import { Readable } from 'stream';
import { normalizeScheduledTime } from '../utils/schedule';

const formatUser = (user: {
  _id: { toString(): string };
  name: string;
  email?: string;
  phone?: string;
  role: string;
  avatar?: string;
}) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email ?? '',
  phone: user.phone,
  role: user.role,
  avatar: user.avatar,
});

const CLOUDINARY_AVATAR_PATTERN =
  /^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/image\/upload\/.+/i;

const sendTokenResponse = (user: any, statusCode: number, res: Response): void => {
  const token = generateToken({
    id: user._id.toString(),
    role: user.role,
    tokenVersion: user.tokenVersion ?? 0,
  });
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      avatar: user.avatar,
    },
  });
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, phone, password, otp } = req.body;
    const emailRaw = String(email || '').trim();
    const phoneRaw = String(phone || '').trim();
    const normalizedEmail = emailRaw ? emailRaw.toLowerCase() : undefined;

    if (!phoneRaw) {
      res.status(400).json({
        success: false,
        message: 'Phone number is required',
      });
      return;
    }

    if (!otp) {
      res.status(400).json({
        success: false,
        message: 'Verify your phone number with OTP before signing up',
      });
      return;
    }

    const otpCheck = await verifyPhoneOtp(phoneRaw, String(otp), 'signup');
    if (!otpCheck.ok) {
      res.status(otpCheck.status).json({ success: false, message: otpCheck.message });
      return;
    }

    if (normalizedEmail) {
      const existingEmail = await User.findOne({ email: normalizedEmail });
      if (existingEmail) {
        res.status(409).json({ success: false, message: 'Email already registered' });
        return;
      }
    }

    const formattedPhone = toE164(phoneRaw);
    const existingPhone = await User.findOne({ phone: formattedPhone });
    if (existingPhone) {
      res.status(409).json({ success: false, message: 'Phone number already registered' });
      return;
    }

    const user = await User.create({
      name,
      email: normalizedEmail,
      phone: formattedPhone,
      password,
      role: 'client',
      phoneVerified: true,
    });

    sendTokenResponse(user, 201, res);
  } catch (err) {
    next(err);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const identifier = String(req.body.identifier || req.body.email || req.body.phone || '').trim();
    const { password } = req.body;

    if (!identifier || !password) {
      res.status(400).json({
        success: false,
        message: 'Email or phone and password are required',
      });
      return;
    }

    const user = await findUserByLoginIdentifier(identifier);
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ success: false, message: 'Account is suspended' });
      return;
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    next(err);
  }
};

export const listTechnicians = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const technicians = await User.find({
      role: 'technician',
      isActive: true,
    })
      .select('name email phone avatar')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      technicians: technicians.map((t) => ({
        id: t._id.toString(),
        name: t.name,
        email: t.email ?? '',
        phone: t.phone ?? '',
        avatar: t.avatar,
      })),
    });
  } catch (err) {
    next(err);
  }
};

const TECH_BUSY_STATUSES = [
  'technician_assigned',
  'en_route',
  'arrived',
  'in_progress',
] as const;

/**
 * Per-technician free/busy for assign UIs.
 * When scheduledDate (+ optional time) is provided, busy = conflict on that slot.
 * Otherwise busy = any active assignment.
 */
export const listTechnicianAvailability = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const scheduledDateRaw = String(req.query.scheduledDate ?? '').trim();
    const scheduledTimeRaw = String(req.query.scheduledTime ?? '').trim();
    const excludeBookingId = String(req.query.excludeBookingId ?? '').trim();

    const technicians = await User.find({
      role: 'technician',
      isActive: true,
    })
      .select('name phone')
      .sort({ name: 1 });

    const techIds = technicians.map((t) => t._id);

    const filter: Record<string, unknown> = {
      technicianId: { $in: techIds },
      status: { $in: [...TECH_BUSY_STATUSES] },
    };
    if (excludeBookingId && mongoose.Types.ObjectId.isValid(excludeBookingId)) {
      filter._id = { $ne: new mongoose.Types.ObjectId(excludeBookingId) };
    }

    const dateOnly = scheduledDateRaw.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
      filter.scheduledDate = {
        $gte: new Date(`${dateOnly}T00:00:00+05:30`),
        $lte: new Date(`${dateOnly}T23:59:59.999+05:30`),
      };
      if (scheduledTimeRaw) {
        filter.scheduledTime = normalizeScheduledTime(scheduledTimeRaw);
      }
    }

    const busyBookings = await Booking.find(filter)
      .select('technicianId scheduledDate scheduledTime status bookingId')
      .lean();

    const busyByTech = new Map<string, number>();
    for (const b of busyBookings) {
      const tid = String(b.technicianId ?? '');
      if (!tid) continue;
      busyByTech.set(tid, (busyByTech.get(tid) ?? 0) + 1);
    }

    res.status(200).json({
      success: true,
      technicians: technicians.map((t) => {
        const id = t._id.toString();
        const busyCount = busyByTech.get(id) ?? 0;
        return {
          id,
          name: t.name,
          phone: t.phone ?? '',
          free: busyCount === 0,
          busyCount,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
};

export const registerTechnician = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  res.status(403).json({
    success: false,
    message:
      'Technician accounts are provisioned by Atomik. Sign in with your email or phone and password.',
  });
};

export const loginWithPhone = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { phone, otp, role } = req.body;
    const purpose =
      role === 'technician' ? 'technician_login' : ('login' as const);

    const otpCheck = await verifyPhoneOtp(String(phone), String(otp), purpose);
    if (!otpCheck.ok) {
      res.status(otpCheck.status).json({ success: false, message: otpCheck.message });
      return;
    }

    const formattedPhone = toE164(String(phone));
    const user = await User.findOne({ phone: formattedPhone });
    if (!user) {
      res.status(404).json({ success: false, message: 'Account not found' });
      return;
    }

    if (role === 'technician' && user.role !== 'technician') {
      res.status(403).json({
        success: false,
        message: 'This phone number is not a technician account',
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ success: false, message: 'Account is suspended' });
      return;
    }

    user.phoneVerified = true;
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(user, 200, res);
  } catch (err) {
    next(err);
  }
};

export const getMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.status(200).json({ success: true, user: formatUser(user) });
  } catch (err) {
    next(err);
  }
};

export const uploadAvatar = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: 'No image uploaded' });
      return;
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME === 'your_cloud_name') {
      res.status(503).json({
        success: false,
        message: 'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME in backend .env',
      });
      return;
    }

    const uploadResult = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'atomik/avatars',
          resource_type: 'image',
          transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
        },
        (error, result) => {
          if (error || !result?.secure_url) {
            reject(error ?? new Error('Cloudinary upload failed'));
            return;
          }
          resolve({ secure_url: result.secure_url });
        }
      );
      Readable.from(file.buffer).pipe(stream);
    });

    const user = await User.findByIdAndUpdate(
      req.user!.id,
      { avatar: uploadResult.secure_url },
      { new: true }
    );
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(200).json({
      success: true,
      user: formatUser(user),
    });
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Email delivery has been removed, so no reset link can be sent.
    // Always return a generic response to avoid account enumeration.
    res.status(200).json({
      success: true,
      message: 'If that email exists, a reset link has been sent',
    });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const token = String(req.body.token ?? '');
    const password = String(req.body.password ?? '');

    if (!email || !token || password.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Email, token, and password (min 8 characters) are required',
      });
      return;
    }

    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      email,
      passwordResetToken: hashed,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires +password');

    if (!user) {
      res.status(400).json({
        success: false,
        message: 'Invalid or expired reset link',
      });
      return;
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (err) {
    next(err);
  }
};

export const resetPasswordWithPhone = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const phoneRaw = String(req.body.phone ?? '').trim();
    const otp = String(req.body.otp ?? '').trim();
    const password = String(req.body.password ?? '');

    if (!phoneRaw || !otp) {
      res.status(400).json({
        success: false,
        message: 'Phone number and verification code are required',
      });
      return;
    }

    const otpCheck = await verifyPhoneOtp(phoneRaw, otp, 'forgot_password');
    if (!otpCheck.ok) {
      res.status(otpCheck.status).json({ success: false, message: otpCheck.message });
      return;
    }

    const formattedPhone = toE164(phoneRaw);
    const user = await User.findOne({ phone: formattedPhone }).select('+password');
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'No account found for this phone number',
      });
      return;
    }

    user.password = password;
    user.phoneVerified = true;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, phone, avatar } = req.body;
    const updates: Record<string, string> = {};
    if (name?.trim()) updates.name = name.trim();
    if (phone?.trim()) updates.phone = phone.trim();
    if (typeof avatar === 'string' && avatar.trim()) {
      const url = avatar.trim();
      if (!CLOUDINARY_AVATAR_PATTERN.test(url)) {
        res.status(400).json({
          success: false,
          message: 'Avatar must be uploaded via the profile photo endpoint',
        });
        return;
      }
      updates.avatar = url;
    }

    const user = await User.findByIdAndUpdate(req.user!.id, updates, {
      new: true,
    });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.status(200).json({
      success: true,
      user: formatUser(user),
    });
  } catch (err) {
    next(err);
  }
};

export const updateFcmToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = String(req.body.fcmToken ?? '').trim();
    if (!token || token.length > 512) {
      res.status(400).json({ success: false, message: 'Invalid FCM token' });
      return;
    }
    // One device token → one user. Clear it from anyone else first so a shared
    // phone / account switch does not keep delivering to the previous login.
    await User.updateMany(
      { fcmToken: token, _id: { $ne: req.user!.id } },
      { $unset: { fcmToken: '' } }
    );
    await User.findByIdAndUpdate(req.user!.id, { fcmToken: token });
    res.status(200).json({ success: true, message: 'FCM token updated' });
  } catch (err) {
    next(err);
  }
};

/** Clear the current user's push token (call on logout so pushes stop). */
export const clearFcmToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await User.findByIdAndUpdate(req.user!.id, { $unset: { fcmToken: '' } });
    res.status(200).json({ success: true, message: 'FCM token cleared' });
  } catch (err) {
    next(err);
  }
};

/**
 * Soft-delete the authenticated account (App Store account-deletion requirement).
 * Anonymizes PII, deactivates login, invalidates tokens, cancels open client bookings.
 */
export const deleteAccount = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.user!.id).select('+password');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (!user.isActive) {
      res.status(400).json({ success: false, message: 'Account is already deleted' });
      return;
    }

    const userId = user._id.toString();
    const now = new Date();

    // Cancel open bookings owned by this client so techs aren't stuck with dead jobs.
    if (user.role === 'client') {
      const { Booking } = await import('../models/Booking');
      await Booking.updateMany(
        {
          clientId: user._id,
          status: { $nin: ['completed', 'cancelled'] },
        },
        {
          $set: {
            status: 'cancelled',
            cancelledAt: now,
            cancellationReason: 'Account deleted by user',
          },
          $push: {
            statusHistory: {
              status: 'cancelled',
              timestamp: now,
              notes: 'Cancelled — account deleted',
              updatedBy: user._id,
            },
          },
        }
      );
    }

    if (user.phone) {
      const { OtpVerification } = await import('../models/OtpVerification');
      await OtpVerification.deleteMany({ phone: user.phone }).catch(() => undefined);
    }

    const tombstoneEmail = `deleted_${userId}@deleted.local`;
    const tombstonePhone = `deleted_${userId}`;

    await User.findByIdAndUpdate(user._id, {
      $set: {
        name: 'Deleted Account',
        email: tombstoneEmail,
        phone: tombstonePhone,
        isActive: false,
        phoneVerified: false,
        password: crypto.randomBytes(32).toString('hex'),
        tokenVersion: (user.tokenVersion ?? 0) + 1,
      },
      $unset: {
        avatar: 1,
        fcmToken: 1,
        appwriteUserId: 1,
        passwordResetToken: 1,
        passwordResetExpires: 1,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (err) {
    next(err);
  }
};
