import mongoSanitize from 'express-mongo-sanitize';
import helmet from 'helmet';
import hpp from 'hpp';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import xss from 'xss-clean';
import { Express, Request, Response, NextFunction } from 'express';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
/** Per-category limit (auth, OTP, password reset, payment verify, webhook). */
const RATE_LIMIT_MAX = Number(process.env.API_RATE_LIMIT_MAX) || 300;
/** Overall `/api/*` cap (per IP / 15 min). Override with API_GLOBAL_RATE_LIMIT_MAX. */
const GLOBAL_RATE_LIMIT_MAX =
  Number(process.env.API_GLOBAL_RATE_LIMIT_MAX) || 15000;

function skipRateLimitInTests(): boolean {
  return process.env.NODE_ENV === 'test';
}

function createLimiter(options: {
  windowMs: number;
  max: number;
  message: string;
  skip?: (req: Request) => boolean;
}): RateLimitRequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => skipRateLimitInTests() || (options.skip?.(req) ?? false),
    handler: (_req: Request, res: Response, _next: NextFunction) => {
      res.status(429).json({
        success: false,
        message: options.message,
        retryAfter: Math.max(1, Math.ceil(options.windowMs / 1000)),
      });
    },
  });
}

export const applySecurityMiddleware = (app: Express): void => {
  app.use(helmet());
  app.use(hpp());
  app.use(xss());
  app.use(
    mongoSanitize({
      replaceWith: '_',
    })
  );
};

/** All `/api/*` routes (per IP). Razorpay webhook is registered before this middleware. */
export const globalApiLimiter = createLimiter({
  windowMs: FIFTEEN_MINUTES_MS,
  max: GLOBAL_RATE_LIMIT_MAX,
  message: 'Too many API requests. Please try again later.',
  // Local/dev traffic (Expo + hot reload + polling) should not trip the production guard.
  skip: () =>
    process.env.NODE_ENV !== 'production' &&
    process.env.ENABLE_API_RATE_LIMIT !== '1',
});

/** Unauthenticated auth POST endpoints: login, register, OTP verify, etc. */
export const publicAuthLimiter = createLimiter({
  windowMs: FIFTEEN_MINUTES_MS,
  max: RATE_LIMIT_MAX,
  message: 'Too many authentication attempts. Try again in 15 minutes.',
});

export const passwordResetLimiter = createLimiter({
  windowMs: FIFTEEN_MINUTES_MS,
  max: RATE_LIMIT_MAX,
  message: 'Too many password reset attempts. Try again in 15 minutes.',
});

export const otpSendLimiter = createLimiter({
  windowMs: FIFTEEN_MINUTES_MS,
  max: RATE_LIMIT_MAX,
  message: 'Too many OTP requests. Try again in 15 minutes.',
});

export const paymentVerifyLimiter = createLimiter({
  windowMs: FIFTEEN_MINUTES_MS,
  max: RATE_LIMIT_MAX,
  message: 'Too many payment verification attempts. Try again later.',
});

/** Razorpay webhook — separate from global limiter; still bounded per IP. */
export const webhookLimiter = createLimiter({
  windowMs: FIFTEEN_MINUTES_MS,
  max: RATE_LIMIT_MAX,
  message: 'Too many webhook requests. Try again later.',
});
