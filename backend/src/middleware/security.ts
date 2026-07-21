import mongoSanitize from 'express-mongo-sanitize';
import helmet from 'helmet';
import hpp from 'hpp';
import rateLimit, {
  ipKeyGenerator,
  RateLimitRequestHandler,
} from 'express-rate-limit';
import xss from 'xss-clean';
import { Express, Request, Response, NextFunction } from 'express';

/**
 * Resolve the *real* client IP for rate-limit bucketing.
 *
 * The API sits behind Cloudflare → Render (multiple proxy hops), so Express's
 * `req.ip` can collapse to a single shared proxy address — which would make the
 * limiter a global bucket shared by every user on earth. Cloudflare sets
 * `cf-connecting-ip` to the true client, so we prefer that, then fall back to
 * the first `x-forwarded-for` entry, then `req.ip`. `ipKeyGenerator` keeps the
 * key IPv6-safe.
 */
function clientRateLimitKey(req: Request): string {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.trim()) {
    return ipKeyGenerator(cf.trim());
  }
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return ipKeyGenerator(xff.split(',')[0].trim());
  }
  return ipKeyGenerator(req.ip ?? 'unknown');
}

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;
/** Per-category limit (auth, OTP, password reset, payment verify, webhook). */
const RATE_LIMIT_MAX = Number(process.env.API_RATE_LIMIT_MAX) || 300;
/**
 * Overall `/api/*` cap — PER USER (keyed on the real client IP), PER MINUTE.
 * Default 1000 req/min/user, so 100k+ concurrent users each get generous
 * headroom. Override with API_GLOBAL_RATE_LIMIT_MAX.
 */
const GLOBAL_RATE_LIMIT_MAX =
  Number(process.env.API_GLOBAL_RATE_LIMIT_MAX) || 1000;
const GLOBAL_RATE_LIMIT_WINDOW_MS =
  Number(process.env.API_GLOBAL_RATE_LIMIT_WINDOW_MS) || ONE_MINUTE_MS;

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
    keyGenerator: clientRateLimitKey,
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
  windowMs: GLOBAL_RATE_LIMIT_WINDOW_MS,
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
