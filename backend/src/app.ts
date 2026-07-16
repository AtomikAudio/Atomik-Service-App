import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import {
  applySecurityMiddleware,
  globalApiLimiter,
  webhookLimiter,
} from './middleware/security';
import { guardRequestBodyShape } from './middleware/requestGuards';
import {
  captureRazorpayWebhookBody,
  verifyRazorpayWebhookSignature,
} from './middleware/razorpayWebhook';
import { razorpayWebhook } from './controllers/paymentController';

import authRoutes from './routes/auth';
import bookingRoutes from './routes/bookings';
import paymentRoutes from './routes/payments';
import venueRoutes from './routes/venues';
import adminRoutes from './routes/admin';
import notificationRoutes from './routes/notifications';
import legalRoutes from './routes/legal';

export function createApp(): express.Application {
  const app = express();

  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  const corsOrigins = (): string | string[] | boolean => {
    const clientUrl = process.env.CLIENT_URL?.trim();
    if (process.env.NODE_ENV === 'production') {
      if (!clientUrl || clientUrl === '*') {
        return false;
      }
      return clientUrl.split(',').map((o) => o.trim());
    }
    if (clientUrl && clientUrl !== '*') {
      return clientUrl.split(',').map((o) => o.trim());
    }
    return true;
  };

  app.use(
    cors({
      origin: corsOrigins(),
      credentials: true,
    })
  );

  // Public legal/support pages (App Store requirement). Registered before the
  // security middleware so Helmet's CSP does not strip their inline styles.
  app.use(legalRoutes);

  app.post(
    '/api/payments/webhook',
    webhookLimiter,
    captureRazorpayWebhookBody,
    verifyRazorpayWebhookSignature,
    razorpayWebhook
  );

  const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT?.trim() || '512kb';

  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));
  applySecurityMiddleware(app);
  app.use('/api', guardRequestBodyShape);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'ATOMIK API', timestamp: new Date().toISOString() });
  });

  
  app.use('/api', globalApiLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/venues', venueRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/notifications', notificationRoutes);

  app.use('*', (_req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
  });

  app.use(errorHandler);

  return app;
}
