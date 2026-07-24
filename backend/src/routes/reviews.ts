import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import { mongoIdParamRules, validate } from '../middleware/validators';
import {
  createReview,
  getReviewForBooking,
} from '../controllers/reviewController';

const router = Router();

router.use(authenticate);

router.get(
  '/booking/:bookingId',
  authorize('client', 'admin'),
  ...mongoIdParamRules('bookingId'),
  validate,
  getReviewForBooking
);

router.post(
  '/booking/:bookingId',
  authorize('client'),
  ...mongoIdParamRules('bookingId'),
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional().isString().isLength({ max: 500 }),
  validate,
  createReview
);

export default router;
