import { Router } from 'express';
import {
  createPaymentOrder,
  createDevTestPaymentOrder, // ₹1 dev test — TEMPORARY (remove after QA)
  verifyPayment,
  getMyInvoices,
} from '../controllers/paymentController';
import { authenticate, authorize } from '../middleware/auth';
import { paymentVerifyLimiter } from '../middleware/security';
import {
  createOrderRules,
  verifyPaymentRules,
  validate,
} from '../middleware/validators';

const router = Router();

router.use(authenticate);

router.post(
  '/create-order',
  authorize('client'),
  createOrderRules,
  validate,
  createPaymentOrder
);
// ₹1 dev test payment — TEMPORARY (remove after QA).
router.post('/dev-test-order', authorize('client'), createDevTestPaymentOrder);
router.post(
  '/verify',
  authorize('client'),
  paymentVerifyLimiter,
  verifyPaymentRules,
  validate,
  verifyPayment
);
router.get('/invoices', authorize('client'), getMyInvoices);

export default router;
