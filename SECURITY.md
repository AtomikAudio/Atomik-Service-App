# ATOMIK — API Security

This document describes security controls on the ATOMIK backend API (`backend/`).

---

## Rate limiting

All `/api/*` requests are rate-limited **per client IP** using [`express-rate-limit`](https://github.com/express-rate-limit/express-rate-limit). Limits use a **15-minute sliding window** unless noted otherwise.

When a limit is exceeded, the API responds with **HTTP 429** and a JSON body:

```json
{
  "success": false,
  "message": "Too many authentication attempts. Try again in 15 minutes.",
  "retryAfter": 900
}
```

`retryAfter` is seconds until the client may retry. Standard `RateLimit-*` response headers are also sent when supported.

Rate limiting is **disabled in `NODE_ENV=test`** so automated tests are not affected.

### Global API limit

| Scope | Window | Max requests | Notes |
|-------|--------|--------------|--------|
| All `/api/*` routes | 15 minutes | **15000** per IP (or `API_GLOBAL_RATE_LIMIT_MAX`) | Skipped in non-production unless `ENABLE_API_RATE_LIMIT=1` |

**Excluded from global limiter:** `POST /api/payments/webhook` (uses dedicated `webhookLimiter` + HMAC verification instead).

**Excluded:** `GET /health` (outside `/api`).

### Authentication & account recovery

| Route(s) | Window | Max attempts | Middleware |
|------------|--------|--------------|------------|
| `POST /api/auth/login` | 15 min | **300** | `publicAuthLimiter` |
| `POST /api/auth/login/phone` | 15 min | **300** | `publicAuthLimiter` |
| `POST /api/auth/register` | 15 min | **300** | `publicAuthLimiter` |
| `POST /api/auth/register/technician` | 15 min | **300** | `publicAuthLimiter` |
| `POST /api/auth/verify-otp` | 15 min | **300** | `publicAuthLimiter` |
| `POST /api/auth/send-otp` | 15 min | **300** | `otpSendLimiter` |
| `POST /api/auth/forgot-password` | 15 min | **300** | `passwordResetLimiter` |
| `POST /api/auth/reset-password` | 15 min | **300** | `passwordResetLimiter` |

Auth routes are subject to **both** the global API limit and their category limit (whichever is hit first blocks the request).

### Payments

| Route | Window | Max attempts | Middleware |
|-------|--------|--------------|------------|
| `POST /api/payments/verify` | 15 min | **300** | `paymentVerifyLimiter` |

Other payment routes (`create-order`, `invoices`) rely on JWT authentication and the global API limit.

### Webhook

| Route | Window | Max requests | Body limit |
|-------|--------|--------------|------------|
| `POST /api/payments/webhook` | 15 min | **300** per IP | **64 KB** raw body |

### Implementation

- Configuration: `backend/src/middleware/security.ts`
- Global mount: `backend/src/server.ts` → `app.use('/api', globalApiLimiter)`
- Auth route wiring: `backend/src/routes/auth.ts`
- Payment verify wiring: `backend/src/routes/payments.ts`

---

## Other security middleware

| Control | Purpose |
|---------|---------|
| **Helmet** | Secure HTTP headers |
| **HPP** | HTTP parameter pollution protection |
| **express-mongo-sanitize** | NoSQL injection mitigation on user input |
| **CORS** | Restricts browser origins in production (`CLIENT_URL`) |
| **JWT + `tokenVersion`** | Session invalidation on password reset |
| **Role-based `authorize()`** | Route-level access by `client`, `technician`, `master_technician`, `admin` |
| **Razorpay webhook HMAC** | Verifies `payment.captured` events before settlement |
| **Production env validation** | Blocks startup if required secrets are missing |

---

## Operational notes

- Behind a reverse proxy (nginx, Cloudflare, etc.), ensure the client IP is forwarded correctly so rate limits apply per real user, not per proxy.
- For distributed deployments, consider a shared store (e.g. Redis) for `express-rate-limit`; the default in-memory store is per server instance.
- Adjust limits via `backend/src/middleware/security.ts` if your traffic profile changes.

---

## Secrets & credential hygiene (codebase audit)

A full scan of application source (excluding `node_modules`) was performed for hardcoded API keys, tokens, and passwords. Summary below.

### Where secrets belong

| Location | Gitignored | Purpose |
|----------|------------|---------|
| `backend/.env` | Yes (`.gitignore`) | All server secrets — see `backend/.env.example` |
| `frontend/.env` | Yes | Public Expo vars only (`EXPO_PUBLIC_*`) |
| `backend/.env.example` / `frontend/.env.example` | No (safe) | Placeholders only — no real credentials |

**Never commit** `backend/.env`, `frontend/.env`, or `backend/dist/` (compiled output may echo seed values). Use `.env.example` files as templates.

### Backend — loaded from environment (correct pattern)

These are **not** hardcoded in source; they are read at runtime from `backend/.env`:

| Variable | Used in |
|----------|---------|
| `MONGODB_URI` | `config/database.ts`, seed scripts |
| `JWT_SECRET` | `utils/jwt.ts` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | `utils/razorpay.ts`, payments |
| `RAZORPAY_WEBHOOK_SECRET` | `middleware/razorpayWebhook.ts` |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | `services/twilioSms.ts`, seed |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | `services/emailService.ts` |
| `CLOUDINARY_*` | `config/cloudinary.ts` |
| `APPWRITE_*` (optional) | `services/appwriteAuth.ts` |
| `DEMO_USER_PASSWORD` | `scripts/seed.ts` (local seed only) |
| `JSON_BODY_LIMIT` | `server.ts` (default `512kb`) |

Production startup validates `JWT_SECRET`, Razorpay keys, webhook secret, and `CLIENT_URL` (`config/envValidation.ts`).

### Backend — placeholders only (safe)

| File | Content |
|------|---------|
| `utils/razorpay.ts` | `rzp_test_your_key_here`, `your_razorpay_secret_here` — rejected by `isRazorpayConfigured()` |
| `__tests__/paymentSecurity.test.ts` | `test_secret` for webhook unit tests only |

### Backend — demo credentials (env only, not in source)

| File | What | Mitigation |
|------|------|------------|
| `scripts/seed.ts` | Demo users use **`DEMO_USER_PASSWORD`** from `.env` | **Required** to run seed; no password hardcoded in code |
| `scripts/seed.ts` | Twilio metadata | Only `TWILIO_*` env; seed skips if unset |

### Frontend — publishable vs secret

| Variable | Safe in app bundle? | Notes |
|----------|---------------------|-------|
| `EXPO_PUBLIC_API_URL` | Yes | API base URL |
| `EXPO_PUBLIC_RAZORPAY_KEY_ID` | Yes | Razorpay **public** key id only (checkout) |
| `EXPO_PUBLIC_GOOGLE_MAPS_KEY` | Yes* | Restrict key by app bundle / HTTP referrer in Google Cloud |
| `EXPO_PUBLIC_DEMO_PASSWORD` | Dev only | Offline demo login in `auth.ts`; `__DEV__` builds only |

**Never** put `RAZORPAY_KEY_SECRET`, `JWT_SECRET`, Twilio Auth Token, or `RESEND_API_KEY` in the Expo app.

| File | What | Risk | Mitigation |
|------|------|------|------------|
| `services/auth.ts` | `EXPO_PUBLIC_DEMO_PASSWORD` only (no hardcoded fallback) | Offline demo | Gated by `isDemoAuthEnabled()`; uses `demo-token-*` (not a real JWT) |
| `services/tokenStore.ts` | `demo-token-` prefix | Not a server secret | Rejected for API calls except demo paths |

### Documentation with demo passwords (expected)

| File | Notes |
|------|-------|
| `DEMO_CREDENTIALS.md` | Documents **local demo** accounts and shared password for developers |
| `TWILIO_AUTH_SETUP.md`, `APPWRITE_AUTH_SETUP.md` | Setup guides with placeholder examples only |

### Audit findings & remediations

| Finding | Severity | Action taken |
|---------|----------|--------------|
| Twilio Account SID and From number hardcoded in `seed.ts` | **High** | Removed; seed uses `TWILIO_ACCOUNT_SID` / `TWILIO_FROM_NUMBER` from `.env` |
| Demo password in source code | **Medium** (dev) | **Removed**; only `DEMO_USER_PASSWORD` / `EXPO_PUBLIC_DEMO_PASSWORD` env vars |
| No automated secret scan | **Low** | Added `npm run check-secrets` in backend |
| Real secrets in local `backend/.env` | **Critical** if committed | Confirmed `.gitignore` covers `.env`; rotate any key ever pushed to git |
| `backend/dist/` may contain compiled seed strings | **Medium** if committed | Added `backend/dist/` to `.gitignore` |

### Rotation checklist (if a secret was exposed)

1. **MongoDB Atlas** — change database user password; update `MONGODB_URI`
2. **JWT** — new `JWT_SECRET` (invalidates all sessions)
3. **Razorpay** — regenerate test/live keys in dashboard
4. **Twilio** — rotate Auth Token in Console
5. **Resend** — revoke and create new API key
6. **Cloudinary** — rotate API secret
7. Re-run `npm run seed` only on **local** dev after password changes

### Pre-release checklist

- [ ] Run `cd backend && npm run check-secrets` (must pass)
- [ ] No real keys in `backend/src` or `frontend/src` (only placeholders)
- [ ] `backend/.env` and `frontend/.env` not tracked by git
- [ ] `EXPO_PUBLIC_*` contains only client-safe values
- [ ] Production `JWT_SECRET` ≥ 32 random characters
- [ ] Razorpay **live** keys only on production API host
- [ ] Google Maps key restricted to your app / domains

### Git & CI

| Control | Details |
|---------|---------|
| `.gitignore` | Ignores `.env`, `.env.local`, `backend/dist/` |
| `npm run check-secrets` | Fails on MongoDB URIs with credentials, Twilio SIDs, Resend keys, `Atomik@123`, private keys in `backend/src` |
| `.env.example` | Placeholder values only — copy to `.env` locally |

---

## Input validation & payload hardening

All mutating API routes validate and bound user input before controllers run.

### Middleware stack (order)

1. **`express.json` / `urlencoded`** — max body size `JSON_BODY_LIMIT` (default **512kb**); oversize → **413**
2. **`helmet`**, **`hpp`**, **`xss-clean`**, **`express-mongo-sanitize`** — headers, pollution, XSS, NoSQL injection
3. **`guardRequestBodyShape`** — JSON must be an object; max **60 keys**, depth **8**, arrays **100** items
4. **`express-validator`** per route — type, format, and max-length rules
5. **`validateObjectId` / `mongoIdParamRules`** — reject malformed MongoDB ids on `:id` params

Malformed JSON → **400** (`Malformed JSON body`).

### Field limits (`config/inputLimits.ts`)

| Field | Max length / rule |
|-------|-------------------|
| Name | 120 chars |
| Email | 254 chars, normalized |
| Phone | 20 chars, `+` / digits only |
| Password | 8–128 chars, letter + number |
| OTP | 6 digits |
| Notes / technician notes | 4000 chars |
| Venue address fields | 80–300 chars |
| PIN code | 6 digits |
| FCM token | 512 chars |
| Razorpay ids / signature | 128 / 256 chars |
| Spare parts array | 50 items max |

### Routes with explicit validation

| Area | Rules |
|------|--------|
| Auth | `registerRules`, `loginRules`, `sendOtpRules`, `verifyOtpRules`, `resetPasswordRules`, … |
| Bookings | `createBookingRules`, `updateBookingStatusRules`, `cancelBookingRules`, `masterAssignRules` |
| Venues | `createVenueRules`, `updateVenueRules` |
| Payments | `createOrderRules`, `verifyPaymentRules` |
| Admin / notifications | `mongoIdParamRules` on `:id` |

### Upload limits

| Endpoint | Limit |
|----------|--------|
| `POST /api/auth/profile/avatar` | 5 MB, images only (`uploadAvatar.ts`) |

### Implementation files

- `backend/src/config/inputLimits.ts`
- `backend/src/middleware/validators.ts`
- `backend/src/middleware/requestGuards.ts`
- `backend/src/middleware/security.ts`
- `backend/src/middleware/errorHandler.ts` (413 / malformed JSON)

---

## Security audit (June 2026)

Full codebase audit performed on backend API, frontend bundle, secrets hygiene, auth, payments, and dependencies.

### Audit results summary

| Area | Result |
|------|--------|
| `npm run check-secrets` | Passed (61 backend source files) |
| Backend `npm audit` | 0 vulnerabilities |
| Frontend `npm audit` | 14 moderate (Expo toolchain — dev/build-time; upgrade to Expo 56 when feasible) |
| Hardcoded credentials in source | None found |

### Remediations applied

| Finding | Severity | Fix |
|---------|----------|-----|
| Admin `assign` accepted any user ID as technician | **High** | `assignTechnician` validates `role: technician` and `isActive` |
| Master/admin could assign completed/cancelled jobs | **High** | `isBookingAssignable()` blocks `completed` and `cancelled` |
| Demo payment bypass on network-exposed dev API | **High** | Demo payments limited to **localhost** unless `ALLOW_DEMO_PAYMENTS=true` |
| Technician IDOR on `GET /api/bookings/:id` | **Medium** | Technicians may only view assigned jobs or open-pool jobs; pool view redacts client phone/email and full venue address |
| Razorpay webhook unbounded body / no rate limit | **Medium** | 64 KB body cap; `webhookLimiter` (300 req / 15 min per IP) |
| Demo password in production app bundle | **Medium** | Offline demo auth gated to `__DEV__` only (removed `EXPO_PUBLIC_ENABLE_DEMO_AUTH`) |
| Rate limits wrong behind reverse proxy | **Medium** | `trust proxy` enabled in production |
| `deleteVenue` returned 200 for non-owned venues | **Low** | Returns **404** when venue not found or not owned |

### Remaining accepted risks / backlog

| Item | Severity | Notes |
|------|----------|-------|
| Phone enumeration via OTP endpoints | Medium | `send-otp` returns different codes for registered vs unregistered phones; mitigated by rate limits |
| Technician spare-parts pricing | Medium | Assigned techs can set `unitCost` up to ₹10M; consider admin approval threshold |
| JWT 7-day expiry, no refresh rotation | Low | Stolen token window; `tokenVersion` invalidates on password reset |
| Avatar upload trusts MIME type only | Low | Cloudinary may reject invalid images |
| `check-secrets` scope | Low | Scans `backend/src` + `scripts` only |
| Example password in `DEMO_CREDENTIALS.md` | Low | Documentation example only — not in source |

### Authorization model (bookings)

| Role | `GET /api/bookings/:id` |
|------|-------------------------|
| **Client** | Own bookings only |
| **Technician** | Assigned jobs (full detail) or open-pool jobs (redacted PII) |
| **Master technician** | All non-cancelled jobs (supervisor) |
| **Admin** | All bookings |

| Role | `PATCH …/assign` |
|------|------------------|
| **Admin** | Active technician only; not `completed` / `cancelled` |
| **Master** | Active technician only; not `completed` / `cancelled` |

### Demo payments (non-production)

| Condition | Demo checkout allowed? |
|-----------|------------------------|
| `NODE_ENV=production` | Never |
| Request from `127.0.0.1` / `::1` | Yes (if Razorpay not configured or `RAZORPAY_FORCE_DEMO=true`) |
| LAN / phone testing | Set `ALLOW_DEMO_PAYMENTS=true` in `backend/.env` |

### Pre-release checklist (extended)

- [ ] Run `cd backend && npm run check-secrets`
- [ ] No `EXPO_PUBLIC_DEMO_PASSWORD` in production EAS build env
- [ ] `ALLOW_DEMO_PAYMENTS` unset (or `false`) on any shared/staging host
- [ ] `CLIENT_URL` set to real app origin(s) in production
- [ ] Rotate secrets if `.env` was ever committed or shared
