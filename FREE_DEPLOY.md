# Free production setup (Render + EAS)

**Cost: $0** — Render free web service + MongoDB Atlas M0 + EAS free build quota.

**GitHub repo:** https://github.com/Siddhantbg/Atomik-Service-App

---

## 1. Deploy API on Render (one-time)

### Option A — Blueprint (recommended)

1. Open [render.com](https://render.com) → sign up (no card for free web services).
2. **New** → **Blueprint** → connect GitHub repo **[Siddhantbg/Atomik-Service-App](https://github.com/Siddhantbg/Atomik-Service-App)**.
3. Render reads root `render.yaml` and creates **`atomik-api`** (free plan, Singapore).
4. When prompted, fill **secret** env vars using `backend/render.env.example` + your local `backend/.env` values.
5. **MongoDB Atlas** → Network Access → allow `0.0.0.0/0` (free tier; tighten later).
6. Wait for deploy → URL: **`https://atomik-service-app.onrender.com`**
7. Test: `https://atomik-service-app.onrender.com/health` → `{"status":"ok",...}`

### Option B — Deploy button

After code is on GitHub:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Siddhantbg/Atomik-Service-App)

---

## 2. Point the mobile app at Render

After health check passes:

```powershell
cd frontend
powershell -ExecutionPolicy Bypass -File ./scripts/set-eas-production-env.ps1 -ApiBaseUrl "https://atomik-service-app.onrender.com"
```

---

## 3. Build Play Store `.aab` (only after steps 1–2 succeed)

```bash
cd frontend
eas build --platform android --profile production
```

Upload the new `.aab` to Play Console.

---

## Free tier notes

- Render free sleeps after ~15 min idle; first request may take 30–60s.
- Optional keep-warm: ping `https://atomik-service-app.onrender.com/health` every 10 min via [cron-job.org](https://cron-job.org) (free).

---

## Local dev (unchanged)

```bash
# frontend/.env → EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:5000/api
cd backend && npm run dev
cd frontend && npm start
```

---

## Production hosting policy

| Use | Don't use |
|-----|-----------|
| **Render** free web service | Fly.io (requires card) |
| **MongoDB Atlas** M0 | PC / Cloudflare quick tunnels |
| **EAS** for Android builds | Placeholder API URLs in builds |
