# ATOMIK — Accounts & Services Setup

Who owns which account, what each service is for, and what else you still need to create or assign.

> **Do not put secrets in this file.** Store API keys only in `.env`, Render, or EAS — never commit them.

---

## Account ownership (current)

| Service | Login / owner email | Notes |
|---------|---------------------|--------|
| **MongoDB Atlas** | `intern1@atomikaudio.com` | Database clusters |
| **Expo / EAS** | `intern1@atomikaudio.com` | Builds, push project, Play submit |
| **Firebase** | `yttest379@gmail.com` | Android `google-services.json` (notifications) |

**Still need an owner assigned** (add the email next to each when you create/share access):

| Service | Owner email | Status |
|---------|-------------|--------|
| **Twilio** (SMS OTP) | _VASI SIR_ | Required for phone signup / login / forgot-password |
| **Razorpay** (payments) | _VASI SIR_ | Required for real checkout + webhooks |
| **Cloudinary** (images) | _intern1@atomikaudio.com_ | Required for avatars + booking photos |
| **Google Cloud** (Maps / Places) | _TBD_ | Required for map picker + address autofill in release |
| **Render** (API host) | _siddhant@atomikaudio.com_ | Production backend (`atomik-service-app.onrender.com`) |
| **Google Play Console** | _siddhant@atomikaudio.com_ | Store listing + AAB releases |
| **GitHub** (repo / keep-warm) | _siddhant@atomikaudio.com_ | Deploy + uptime ping workflow |
| **Domain / DNS** (`atomikaudio.com`) | _Atomik_ | Website, privacy URL, email if needed |

---

## Required vs optional

### Required to run locally (minimum)

| # | Service | Why |
|---|---------|-----|
| 1 | **MongoDB Atlas** | App database |
| 2 | **JWT secret** | Auth tokens (self-generated; no vendor account) |
| 3 | Backend + frontend running | `EXPO_PUBLIC_API_URL` → your LAN IP |

Seeded demo users can sign in without Twilio/Razorpay/Maps until you test those flows.

### Required for full product flows (local or prod)

| # | Service | Why |
|---|---------|-----|
| 4 | **Twilio** | SMS OTP (default provider) |
| 5 | **Razorpay** | Payments + webhook |
| 6 | **Cloudinary** | Image uploads |
| 7 | **Google Maps / Places** | Venue map + address autocomplete |

### Required for production API + Play Store

| # | Service | Why |
|---|---------|-----|
| 8 | **Render** (or equivalent host) | Public HTTPS API |
| 9 | **Expo / EAS** | Production / preview builds |
| 10 | **Firebase** + `google-services.json` | Android push via Expo |
| 11 | **Google Play Console** | Publish AAB |

### Optional / not wired yet

| Service | Status |
|---------|--------|
| **Appwrite** | Optional OTP alternative to Twilio — only if you set `APPWRITE_PROJECT_ID` |
| **Resend / SendGrid** | Listed in some deploy docs — **email sending is not implemented in code** |
| **Sentry** | Recommended for prod monitoring — **not integrated** |
| **Apple Developer** | Only if shipping iOS — **no iOS release docs yet** |
| **Apple / Google OAuth** | Not used (email+password + phone OTP only) |

---

## Per-service checklist

### 1. MongoDB Atlas — `intern1@atomikaudio.com`

- [ ] Atlas project + cluster (free M0 is fine for start)
- [ ] Database user + password
- [ ] Network Access (dev: often `0.0.0.0/0`; prod: prefer Render IPs)
- [ ] Connection string → backend `MONGODB_URI`
- [ ] DB name (e.g. `atomik`)

### 2. JWT (no account)

- [ ] Generate a long random secret (≥ 32 characters in production)
- [ ] Backend `JWT_SECRET`
- [ ] Optional: `JWT_EXPIRES_IN` (default `365d`)

### 3. Twilio — owner TBD

- [ ] Account + Account SID + Auth Token
- [ ] SMS-capable From number → `TWILIO_FROM_NUMBER`
- [ ] Env: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- [ ] Trial: verify recipient phone numbers
- [ ] Detail doc: `TWILIO_AUTH_SETUP.md`

### 4. Razorpay — owner TBD

- [ ] Account; create **Test** and **Live** Key ID + Secret
- [ ] Backend: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- [ ] Frontend / EAS: `EXPO_PUBLIC_RAZORPAY_KEY_ID` (public Key ID only — never the secret)
- [ ] Webhook URL: `https://<your-api>/api/payments/webhook` · event `payment.captured`
- [ ] Same Key ID on backend and app for the environment you are testing

### 5. Cloudinary — owner TBD

- [ ] Cloud name, API key, API secret
- [ ] Backend: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

### 6. Google Cloud (Maps + Places) — owner TBD

- [ ] GCP project
- [ ] Enable **Maps JavaScript API** and **Places API**
- [ ] API key → `EXPO_PUBLIC_GOOGLE_MAPS_KEY`
- [ ] Restrict key by Android package: `com.atomikaudio.service` (and iOS bundle if you ship iOS)

### 7. Firebase — `yttest379@gmail.com`

- [ ] Firebase project
- [ ] Android app with package `com.atomikaudio.service`
- [ ] Download `google-services.json`
- [ ] Local path: `frontend/google-services.json` (gitignored)
- [ ] EAS: file env `GOOGLE_SERVICES_JSON`
- [ ] Note: push goes through **Expo Push**; Firebase config enables FCM under the hood. Expo Go does not receive remote push — use a dev or production build.

### 8. Expo / EAS — `intern1@atomikaudio.com`

- [ ] `eas login` on that account
- [ ] Project slug: `atomik-audio`
- [ ] Production EAS env:
  - `EXPO_PUBLIC_API_URL` (real `https://…` API — not localhost)
  - `EXPO_PUBLIC_RAZORPAY_KEY_ID`
  - `EXPO_PUBLIC_GOOGLE_MAPS_KEY`
  - File: `GOOGLE_SERVICES_JSON`
- [ ] Do **not** set `EXPO_PUBLIC_DEMO_PASSWORD` in production
- [ ] Docs: `frontend/PLAY_STORE_RELEASE.md`, `frontend/PLAY_STORE_SIGNING.md`

### 9. Render (API) — owner TBD

- [ ] Web service from `backend/` (see `render.yaml` / `FREE_DEPLOY.md`)
- [ ] Set env from `backend/render.env.example` (Mongo, JWT, Twilio, Razorpay, Cloudinary, `CLIENT_URL`, etc.)
- [ ] Free tier sleeps ~15 min — keep-warm via GitHub Action and/or cron-job.org

### 10. Google Play Console — owner TBD

- [ ] Developer account ($25 one-time)
- [ ] App package: `com.atomikaudio.service`
- [ ] Store listing, privacy policy URL, Data safety, content rating
- [ ] Optional: service account JSON for `eas submit` → `frontend/google-service-account.json` (gitignored)

### 11. GitHub — owner TBD

- [ ] Repo access for deploys / Blueprint
- [ ] Keep-warm workflow: `.github/workflows/keep-warm.yml`

### 12. CORS / public URLs

- [ ] Backend `CLIENT_URL` = allowed web origins (comma-separated; not `*` in production)
- [ ] Public privacy / terms URL for Play Console (API also serves legal routes on the host)

---

## Env var quick map

### Backend (typical)

```text
MONGODB_URI
JWT_SECRET
JWT_EXPIRES_IN                 # optional
CLIENT_URL
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
DEMO_USER_PASSWORD             # local / seed only — not production
NODE_ENV
PORT                           # optional, default 5000
```

Templates: `backend/.env.example`, `backend/render.env.example`

### Frontend / EAS

```text
EXPO_PUBLIC_API_URL
EXPO_PUBLIC_RAZORPAY_KEY_ID
EXPO_PUBLIC_GOOGLE_MAPS_KEY
EXPO_PUBLIC_DEMO_PASSWORD      # __DEV__ / local only
GOOGLE_SERVICES_JSON           # EAS file env for google-services.json
```

Templates: `frontend/.env.example`, `frontend/.env.production.example`

---

## Related docs

| Topic | File |
|-------|------|
| Quick start | `README.md` |
| Free production path | `FREE_DEPLOY.md` |
| Production checklist | `PRODUCTION_DEPLOYMENT.md` |
| Security / env notes | `SECURITY.md` |
| Twilio OTP | `TWILIO_AUTH_SETUP.md` |
| Appwrite OTP (optional) | `APPWRITE_AUTH_SETUP.md` |
| Demo logins | `DEMO_CREDENTIALS.md` |
| Play Store | `frontend/PLAY_STORE_RELEASE.md` |
| Brand / UI | `docs/ATOMIK-Brand-Guide.md` |

---

## What you should still add to this file

Fill these in when you have them (emails only — never passwords or API keys):

1. **Owner emails** for Twilio, Razorpay, Cloudinary, Google Cloud, Render, Play Console, GitHub, domain.
2. **Which environment** each account is for (dev vs live), if you split accounts later.
3. **Shared access** — who else on the team has admin (so you’re not locked out if one person leaves).
4. **Recovery** — where 2FA backup codes / recovery emails live (password manager note is enough).
5. **Billing cards** — which company card is on Twilio / Razorpay / Play / Atlas (so renewals don’t fail silently).

Optional later (only if you build them):

6. **Transactional email** (Resend or SendGrid) — assign an owner **after** email is implemented.
7. **Sentry** (or similar) — assign if you add crash reporting.
8. **Apple Developer** — assign if you ship iOS.

---

## Minimum path summary

| Goal | Accounts you need |
|------|-------------------|
| Local demo login | MongoDB + JWT + API URL |
| Phone OTP + payments + photos + maps | Above + Twilio + Razorpay + Cloudinary + Google Maps |
| Live Android app on Play | Above + Render + Expo/EAS + Firebase + Play Console |
