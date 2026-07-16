import { Router } from 'express';
import {
  createPaymentOrder,
  // createDevTestPaymentOrder, // ₹1 dev test — disabled; re-enable with route below
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
// ₹1 dev test payment — disabled. Re-enable import + controller in paymentController.ts.
// router.post('/dev-test-order', authorize('client'), createDevTestPaymentOrder);
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
