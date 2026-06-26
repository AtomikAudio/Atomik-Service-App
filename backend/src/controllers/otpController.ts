import { Request, Response, NextFunction } from 'express';
import { OtpVerification } from '../models/OtpVerification';
import { User } from '../models/User';
import {
  generateOtpCode,
  hashOtpCode,
  sendOtpSms,
} from '../services/twilioSms';
import {
  appwriteSendPhoneToken,
  appwriteVerifyPhoneOtp,
  isAppwriteConfigured,
  OtpPurpose,
} from '../services/appwriteAuth';
import { normalizePhone, toE164, phonesMatch } from '../utils/phone';

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 30_000;

async function findUserByPhone(phoneRaw: string) {
  const e164 = toE164(phoneRaw);
  const normalized = normalizePhone(phoneRaw);
  const phoneUsers = await User.find({
    $or: [
      { phone: phoneRaw },
      { phone: e164 },
      { phone: `+91${normalized}` },
    ],
  });
  return phoneUsers.find((u) => u.phone && phonesMatch(u.phone, phoneRaw)) ?? null;
}

function parsePurpose(raw: unknown): OtpPurpose {
  const value = String(raw || 'signup');
  if (
    value === 'login' ||
    value === 'technician_signup' ||
    value === 'technician_login' ||
    value === 'forgot_password'
  ) {
    return value;
  }
  return 'signup';
}

export const sendSignupOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const phoneRaw = String(req.body.phone || '').trim();
    const purpose = parsePurpose(req.body.purpose);

    if (!phoneRaw) {
      res.status(400).json({ success: false, message: 'Phone number is required' });
      return;
    }

    const normalized = normalizePhone(phoneRaw);
    if (normalized.length < 10) {
      res.status(400).json({ success: false, message: 'Enter a valid 10-digit phone number' });
      return;
    }

    const e164 = toE164(phoneRaw);
    const existingUser = await findUserByPhone(phoneRaw);

    if (purpose === 'signup' || purpose === 'technician_signup') {
      if (existingUser) {
        res.status(409).json({ success: false, message: 'Phone number already registered' });
        return;
      }
    }

    if (
      purpose === 'login' ||
      purpose === 'technician_login' ||
      purpose === 'forgot_password'
    ) {
      if (!existingUser) {
        res.status(404).json({ success: false, message: 'No account found for this phone number' });
        return;
      }
      if (purpose === 'technician_login' && existingUser.role !== 'technician') {
        res.status(403).json({
          success: false,
          message: 'This number is not registered as a technician account',
        });
        return;
      }
    }

    await OtpVerification.deleteMany({
      phone: e164,
      $or: [{ smsSentAt: { $exists: false } }, { expiresAt: { $lte: new Date() } }],
    });

    const recent = await OtpVerification.findOne({
      phone: e164,
      smsSentAt: { $exists: true },
      expiresAt: { $gt: new Date() },
    }).sort({ smsSentAt: -1 });

    if (recent?.smsSentAt) {
      const elapsed = Date.now() - recent.smsSentAt.getTime();
      if (elapsed < RESEND_COOLDOWN_MS) {
        const retryAfter = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        res.status(429).json({
          success: false,
          message: `Please wait ${retryAfter}s before requesting another code`,
          retryAfter,
        });
        return;
      }
    }

    if (isAppwriteConfigured()) {
      const { userId } = await appwriteSendPhoneToken(e164);
      await OtpVerification.deleteMany({ phone: e164 });
      await OtpVerification.create({
        phone: e164,
        appwriteUserId: userId,
        purpose,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        attempts: 0,
        smsSentAt: new Date(),
      });
    } else {
      const code = generateOtpCode(6);
      await sendOtpSms(phoneRaw, code);
      await OtpVerification.deleteMany({ phone: e164 });
      await OtpVerification.create({
        phone: e164,
        codeHash: hashOtpCode(code),
        purpose,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        attempts: 0,
        smsSentAt: new Date(),
      });
    }

    res.status(200).json({
      success: true,
      message: 'Verification code sent',
      provider: isAppwriteConfigured() ? 'appwrite' : 'twilio',
      expiresIn: OTP_TTL_MS / 1000,
      phone: e164,
      resendAfter: RESEND_COOLDOWN_MS / 1000,
    });
  } catch (err) {
    next(err);
  }
};

export type VerifyPhoneOtpOptions = {
  /** When false, marks OTP verified but keeps record for final register/login */
  consume?: boolean;
};

export async function verifyPhoneOtp(
  phoneRaw: string,
  otp: string,
  expectedPurpose?: OtpPurpose,
  options?: VerifyPhoneOtpOptions
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const consume = options?.consume !== false;
  const e164 = toE164(phoneRaw);
  const record = await OtpVerification.findOne({ phone: e164 }).sort({ createdAt: -1 });

  if (!record) {
    return { ok: false, status: 400, message: 'Request a verification code first' };
  }

  if (expectedPurpose && record.purpose && record.purpose !== expectedPurpose) {
    return { ok: false, status: 400, message: 'OTP was requested for a different action' };
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await OtpVerification.deleteOne({ _id: record._id });
    return { ok: false, status: 400, message: 'Verification code expired. Request a new one.' };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await OtpVerification.deleteOne({ _id: record._id });
    return { ok: false, status: 429, message: 'Too many attempts. Request a new code.' };
  }

  if (record.appwriteUserId && isAppwriteConfigured()) {
    try {
      await appwriteVerifyPhoneOtp(record.appwriteUserId, otp);
    } catch {
      record.attempts += 1;
      await record.save();
      return { ok: false, status: 400, message: 'Invalid verification code' };
    }
  } else {
    if (!record.codeHash) {
      return { ok: false, status: 400, message: 'Request a verification code first' };
    }
    const matches = hashOtpCode(String(otp).trim()) === record.codeHash;
    if (!matches) {
      record.attempts += 1;
      await record.save();
      return { ok: false, status: 400, message: 'Invalid verification code' };
    }
  }

  if (!consume) {
    record.verifiedAt = new Date();
    await record.save();
    return { ok: true };
  }

  await OtpVerification.deleteOne({ _id: record._id });
  return { ok: true };
}

export const confirmPhoneOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const phoneRaw = String(req.body.phone || '').trim();
    const otp = String(req.body.otp || '').trim();
    const purpose = parsePurpose(req.body.purpose);

    if (!phoneRaw || !otp) {
      res.status(400).json({ success: false, message: 'Phone and verification code are required' });
      return;
    }

    const result = await verifyPhoneOtp(phoneRaw, otp, purpose, { consume: false });
    if (!result.ok) {
      res.status(result.status).json({ success: false, message: result.message });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Phone number verified',
      phone: toE164(phoneRaw),
      verified: true,
    });
  } catch (err) {
    next(err);
  }
};

/** @deprecated use verifyPhoneOtp */
export async function verifySignupOtp(
  phoneRaw: string,
  otp: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  return verifyPhoneOtp(phoneRaw, otp, 'signup');
}
