import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import {
  BOOKING_STATUS_VALUES,
  INPUT_LIMITS,
  SERVICE_TYPE_VALUES,
} from '../config/inputLimits';
import { BOOKING_TIME_SLOTS } from '../config/timeSlots';

export const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: errors.array()[0]?.msg || 'Validation failed',
      errors: errors.array().map((e) => ({
        field: 'path' in e ? e.path : undefined,
        message: e.msg,
      })),
    });
    return;
  }
  next();
};

const passwordRules = body('password')
  .isLength({ min: 8, max: INPUT_LIMITS.password })
  .withMessage('Password must be 8–128 characters')
  .matches(/[A-Za-z]/)
  .withMessage('Password must include a letter')
  .matches(/[0-9]/)
  .withMessage('Password must include a number');

const mongoIdBody = (field: string) =>
  body(field)
    .trim()
    .notEmpty()
    .withMessage(`${field} is required`)
    .isMongoId()
    .withMessage(`Invalid ${field}`);

export const registerRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: INPUT_LIMITS.name }),
  body('email')
    .optional({ values: 'falsy' })
    .isEmail()
    .withMessage('Valid email is required')
    .isLength({ max: INPUT_LIMITS.email })
    .normalizeEmail(),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .isLength({ max: INPUT_LIMITS.phone })
    .matches(/^[\d\s+()-]+$/)
    .withMessage('Invalid phone number format'),
  passwordRules,
  body('otp')
    .trim()
    .isLength({ min: INPUT_LIMITS.otp, max: INPUT_LIMITS.otp })
    .isNumeric()
    .withMessage('Enter the 6-digit code'),
];

export const forgotPasswordRules = [
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .isLength({ max: INPUT_LIMITS.email })
    .normalizeEmail(),
];

export const resetPasswordRules = [
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .isLength({ max: INPUT_LIMITS.email })
    .normalizeEmail(),
  body('token')
    .trim()
    .notEmpty()
    .withMessage('Reset token is required')
    .isLength({ max: INPUT_LIMITS.token }),
  passwordRules,
];

export const loginRules = [
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ max: INPUT_LIMITS.password }),
  body().custom((_, { req }) => {
    const identifier = String(
      req.body?.identifier || req.body?.email || req.body?.phone || ''
    ).trim();
    if (!identifier) {
      throw new Error('Email or phone number is required');
    }
    if (identifier.length > INPUT_LIMITS.identifier) {
      throw new Error('Identifier is too long');
    }
    return true;
  }),
];

export const fcmTokenRules = [
  body('fcmToken')
    .trim()
    .notEmpty()
    .isLength({ max: INPUT_LIMITS.fcmToken })
    .withMessage('Invalid FCM token'),
];

export const updateProfileRules = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .isLength({ max: INPUT_LIMITS.name }),
  body('phone')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Phone cannot be empty')
    .isLength({ max: INPUT_LIMITS.phone })
    .matches(/^[\d\s+()-]+$/)
    .withMessage('Invalid phone number format'),
  body('avatar')
    .optional()
    .isString()
    .isLength({ max: 2048 })
    .withMessage('Invalid avatar URL'),
];

export const sendOtpRules = [
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone is required')
    .isLength({ max: INPUT_LIMITS.phone })
    .matches(/^[\d\s+()-]+$/)
    .withMessage('Invalid phone number format'),
  body('purpose')
    .optional()
    .isIn([
      'signup',
      'login',
      'technician_signup',
      'technician_login',
      'forgot_password',
    ])
    .withMessage('Invalid OTP purpose'),
];

export const technicianRegisterRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: INPUT_LIMITS.name }),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone is required')
    .isLength({ max: INPUT_LIMITS.phone }),
  body('otp')
    .trim()
    .isLength({ min: INPUT_LIMITS.otp, max: INPUT_LIMITS.otp })
    .isNumeric()
    .withMessage('Enter the 6-digit code'),
  body('email')
    .optional({ values: 'falsy' })
    .isEmail()
    .withMessage('Valid email is required')
    .isLength({ max: INPUT_LIMITS.email }),
];

export const masterAssignRules = [mongoIdBody('technicianId')];

export const assignTechnicianRules = [mongoIdBody('technicianId')];

export const phoneLoginRules = [
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone is required')
    .isLength({ max: INPUT_LIMITS.phone }),
  body('otp')
    .trim()
    .isLength({ min: INPUT_LIMITS.otp, max: INPUT_LIMITS.otp })
    .isNumeric()
    .withMessage('Enter the 6-digit code'),
  body('role').optional().isIn(['client', 'technician']).withMessage('Invalid role'),
];

export const verifyOtpRules = [
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone is required')
    .isLength({ max: INPUT_LIMITS.phone }),
  body('otp')
    .trim()
    .isLength({ min: INPUT_LIMITS.otp, max: INPUT_LIMITS.otp })
    .isNumeric()
    .withMessage('Enter the 6-digit code'),
  body('purpose')
    .optional()
    .isIn([
      'signup',
      'login',
      'technician_signup',
      'technician_login',
      'forgot_password',
    ])
    .withMessage('Invalid OTP purpose'),
];

export const resetPasswordPhoneRules = [
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone is required')
    .isLength({ max: INPUT_LIMITS.phone })
    .matches(/^[\d\s+()-]+$/)
    .withMessage('Invalid phone number format'),
  body('otp')
    .trim()
    .isLength({ min: INPUT_LIMITS.otp, max: INPUT_LIMITS.otp })
    .isNumeric()
    .withMessage('Enter the 6-digit code'),
  passwordRules,
];

export const slotAvailabilityQueryRules = [
  query('date')
    .trim()
    .notEmpty()
    .withMessage('date query parameter is required')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Invalid date (use YYYY-MM-DD)'),
  query('excludeBookingId')
    .optional()
    .isMongoId()
    .withMessage('Invalid excludeBookingId'),
];

const scheduledTimeSlotRule = body('scheduledTime')
  .trim()
  .notEmpty()
  .withMessage('Scheduled time is required')
  .custom((value) => {
    const cleaned = String(value).replace(/\s*IST\s*$/i, '').trim();
    if (!(BOOKING_TIME_SLOTS as readonly string[]).includes(cleaned)) {
      throw new Error('Invalid time slot');
    }
    return true;
  });

export const holdSlotRules = [
  body('scheduledDate')
    .trim()
    .notEmpty()
    .withMessage('Scheduled date is required')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Invalid scheduled date (use YYYY-MM-DD)'),
  body('scheduledTime')
    .trim()
    .notEmpty()
    .withMessage('Scheduled time is required')
    .custom((value) => {
      const cleaned = String(value).replace(/\s*IST\s*$/i, '').trim();
      if (!(BOOKING_TIME_SLOTS as readonly string[]).includes(cleaned)) {
        throw new Error('Invalid time slot');
      }
      return true;
    }),
];

export const createBookingRules = [
  body('serviceType')
    .trim()
    .notEmpty()
    .withMessage('Service type is required')
    .isIn([...SERVICE_TYPE_VALUES])
    .withMessage('Invalid service type'),
  mongoIdBody('venueId'),
  body('scheduledDate')
    .trim()
    .notEmpty()
    .withMessage('Scheduled date is required')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Invalid scheduled date (use YYYY-MM-DD)'),
  body('scheduledTime')
    .optional()
    .isString()
    .isLength({ max: 32 })
    .withMessage('Invalid scheduled time'),
  body('notes')
    .optional()
    .isString()
    .isLength({ max: INPUT_LIMITS.notes })
    .withMessage('Notes are too long'),
];

export const updateBookingStatusRules = [
  body('status')
    .trim()
    .notEmpty()
    .isIn([...BOOKING_STATUS_VALUES])
    .withMessage('Invalid booking status'),
  body('notes')
    .optional()
    .isString()
    .isLength({ max: INPUT_LIMITS.notes }),
  body('technicianNotes')
    .optional()
    .isString()
    .isLength({ max: INPUT_LIMITS.technicianNotes }),
  body('spareParts')
    .optional()
    .isArray({ max: INPUT_LIMITS.sparePartsMaxItems })
    .withMessage('Too many spare part lines'),
  body('spareParts.*.name')
    .optional()
    .isString()
    .trim()
    .isLength({ max: INPUT_LIMITS.sparePartName }),
  body('spareParts.*.quantity')
    .optional()
    .isInt({ min: 1, max: 999 })
    .toInt(),
  body('spareParts.*.unitCost')
    .optional()
    .isFloat({ min: 0, max: 10_000_000 })
    .toFloat(),
];

export const cancelBookingRules = [
  body('reason')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Cancellation reason is too long'),
];

export const createVenueRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Venue name is required')
    .isLength({ max: INPUT_LIMITS.venueName }),
  body('address')
    .trim()
    .notEmpty()
    .withMessage('Address is required')
    .isLength({ max: INPUT_LIMITS.addressLine }),
  body('area')
    .trim()
    .notEmpty()
    .withMessage('Area is required')
    .isLength({ max: INPUT_LIMITS.area }),
  body('city')
    .trim()
    .notEmpty()
    .withMessage('City is required')
    .isLength({ max: INPUT_LIMITS.city }),
  body('state')
    .trim()
    .notEmpty()
    .withMessage('State is required')
    .isLength({ max: INPUT_LIMITS.state }),
  body('pincode')
    .trim()
    .matches(/^\d{6}$/)
    .withMessage('Enter a valid 6-digit PIN code'),
];

export const updateVenueRules = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Venue name cannot be empty')
    .isLength({ max: INPUT_LIMITS.venueName }),
  body('address')
    .optional()
    .trim()
    .notEmpty()
    .isLength({ max: INPUT_LIMITS.addressLine }),
  body('area').optional().trim().notEmpty().isLength({ max: INPUT_LIMITS.area }),
  body('city').optional().trim().notEmpty().isLength({ max: INPUT_LIMITS.city }),
  body('state').optional().trim().notEmpty().isLength({ max: INPUT_LIMITS.state }),
  body('pincode')
    .optional()
    .trim()
    .matches(/^\d{6}$/)
    .withMessage('Enter a valid 6-digit PIN code'),
];

export const createOrderRules = [
  mongoIdBody('invoiceId'),
  body('payFor')
    .optional()
    .isIn(['full', 'extra_parts'])
    .withMessage('Invalid payFor value'),
  body('couponCode')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 32 })
    .withMessage('Invalid coupon code'),
];

export const verifyPaymentRules = [
  body('razorpay_order_id')
    .trim()
    .notEmpty()
    .isLength({ max: INPUT_LIMITS.razorpayId }),
  body('razorpay_payment_id')
    .trim()
    .notEmpty()
    .isLength({ max: INPUT_LIMITS.razorpayId }),
  body('razorpay_signature')
    .trim()
    .notEmpty()
    .isLength({ max: INPUT_LIMITS.razorpaySignature }),
  mongoIdBody('invoiceId'),
];

export const mongoIdParamRules = (paramName = 'id') => [
  param(paramName).isMongoId().withMessage(`Invalid ${paramName}`),
];

export const rescheduleProposeRules = [
  ...mongoIdParamRules('id'),
  body('scheduledDate')
    .trim()
    .notEmpty()
    .withMessage('Scheduled date is required')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Invalid scheduled date (use YYYY-MM-DD)'),
  scheduledTimeSlotRule,
  body('note')
    .optional()
    .isString()
    .isLength({ max: INPUT_LIMITS.notes })
    .withMessage('Note is too long'),
];

export const rescheduleRespondRules = [
  ...mongoIdParamRules('id'),
  body('action')
    .trim()
    .notEmpty()
    .withMessage('action is required')
    .isIn(['accept', 'counter'])
    .withMessage('action must be accept or counter'),
  body('scheduledDate')
    .optional()
    .trim()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Invalid scheduled date (use YYYY-MM-DD)'),
  body('scheduledTime')
    .optional()
    .trim()
    .custom((value, { req }) => {
      if (req.body.action !== 'counter') return true;
      if (!value) throw new Error('Scheduled time is required to counter-propose');
      const cleaned = String(value).replace(/\s*IST\s*$/i, '').trim();
      if (!(BOOKING_TIME_SLOTS as readonly string[]).includes(cleaned)) {
        throw new Error('Invalid time slot');
      }
      return true;
    }),
  body('note')
    .optional()
    .isString()
    .isLength({ max: INPUT_LIMITS.notes })
    .withMessage('Note is too long'),
  body().custom((_, { req }) => {
    if (req.body.action !== 'counter') return true;
    if (!req.body.scheduledDate?.trim()) {
      throw new Error('scheduledDate is required to counter-propose');
    }
    return true;
  }),
];
