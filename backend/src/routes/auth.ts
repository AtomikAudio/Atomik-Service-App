import { Router } from 'express';
import {
  register,
  registerTechnician,
  login,
  loginWithPhone,
  listTechnicians,
  listTechnicianAvailability,
  getMe,
  forgotPassword,
  resetPassword,
  resetPasswordWithPhone,
  updateFcmToken,
  clearFcmToken,
  updateProfile,
  uploadAvatar,
  deleteAccount,
} from '../controllers/authController';
import { avatarUpload } from '../middleware/uploadAvatar';
import { sendSignupOtp, confirmPhoneOtp } from '../controllers/otpController';
import { authenticate, authorize } from '../middleware/auth';
import {
  publicAuthLimiter,
  passwordResetLimiter,
  otpSendLimiter,
} from '../middleware/security';
import {
  registerRules,
  loginRules,
  updateProfileRules,
  sendOtpRules,
  verifyOtpRules,
  technicianRegisterRules,
  phoneLoginRules,
  forgotPasswordRules,
  resetPasswordRules,
  resetPasswordPhoneRules,
  fcmTokenRules,
  validate,
} from '../middleware/validators';

const router = Router();

router.post('/send-otp', otpSendLimiter, sendOtpRules, validate, sendSignupOtp);
router.post('/verify-otp', publicAuthLimiter, verifyOtpRules, validate, confirmPhoneOtp);
router.post('/register', publicAuthLimiter, registerRules, validate, register);
router.post(
  '/register/technician',
  publicAuthLimiter,
  technicianRegisterRules,
  validate,
  registerTechnician
);
router.post('/login', publicAuthLimiter, loginRules, validate, login);
router.post('/login/phone', publicAuthLimiter, phoneLoginRules, validate, loginWithPhone);
router.post(
  '/forgot-password',
  passwordResetLimiter,
  forgotPasswordRules,
  validate,
  forgotPassword
);
router.post(
  '/reset-password',
  passwordResetLimiter,
  resetPasswordRules,
  validate,
  resetPassword
);
router.post(
  '/reset-password-phone',
  passwordResetLimiter,
  resetPasswordPhoneRules,
  validate,
  resetPasswordWithPhone
);

router.get('/me', authenticate, getMe);
router.get(
  '/technicians',
  authenticate,
  authorize('master_technician', 'admin'),
  listTechnicians
);
router.get(
  '/technicians/availability',
  authenticate,
  authorize('master_technician', 'admin'),
  listTechnicianAvailability
);
router.patch('/profile', authenticate, updateProfileRules, validate, updateProfile);
router.post(
  '/profile/avatar',
  authenticate,
  (req, res, next) => {
    avatarUpload(req, res, (err) => {
      if (err) {
        res.status(400).json({
          success: false,
          message: err instanceof Error ? err.message : 'Upload failed',
        });
        return;
      }
      next();
    });
  },
  uploadAvatar
);
router.patch('/fcm-token', authenticate, fcmTokenRules, validate, updateFcmToken);
router.delete('/fcm-token', authenticate, clearFcmToken);
router.delete('/account', authenticate, deleteAccount);

export default router;
