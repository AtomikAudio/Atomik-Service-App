# ATOMIK — Audio Engineering and Design · Service Infrastructure

Premium audio service management platform for Atomik Audio.

**Production deploy (free):** see **[FREE_DEPLOY.md](./FREE_DEPLOY.md)** — Render + EAS.  
**GitHub:** https://github.com/Siddhantbg/Atomik-Service-App

---

## Project Structure

```
AtomikService/
├── frontend/          React Native Expo (iOS + Android)
└── backend/           Node.js + Express + MongoDB
```

---

## Demo logins

See **[DEMO_CREDENTIALS.md](./DEMO_CREDENTIALS.md)** for Client, Technician, and Admin test accounts.

### Role testing checklist

1. Run `cd backend && npm run seed` once (creates demo users).
2. Start backend (`npm run dev`) and frontend (`npm start` in `frontend/`).
3. Set `EXPO_PUBLIC_API_URL` to your PC LAN IP (e.g. `http://192.168.x.x:5000/api`) — not `localhost` on a physical phone.
4. **Client** (`client@atomik.demo`): book service → pay (Razorpay test keys) → track on Home.
5. **Admin** (`admin@atomik.demo`): dashboard → assign technician on a pending booking.
6. **Technician** (`tech@atomik.demo`): Jobs tab shows assigned bookings → update status.

Payments use Razorpay **test mode** via WebView checkout in Expo Go (`react-native-webview`). Set `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` in backend `.env` and `EXPO_PUBLIC_RAZORPAY_KEY_ID` in frontend `.env`.

---

## Quick Start

### Backend

```bash
cd backend
npm install
cp .env.example .env     # fill in your credentials
npm run dev              # starts on port 5000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env     # set API URL
npx expo start           # scan QR with Expo Go
```

---

## Required Environment Variables

### Backend `.env`
| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret key for JWT signing |
| `RAZORPAY_KEY_ID` | Razorpay API key |
| `RAZORPAY_KEY_SECRET` | Razorpay secret key |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |

### Frontend `.env`
| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend API URL |
| `EXPO_PUBLIC_RAZORPAY_KEY_ID` | Razorpay key (for client) |

---

## API Endpoints

### Auth
| Method | Path | Access |
|---|---|---|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/forgot-password` | Public |
| GET | `/api/auth/me` | Authenticated |
| PATCH | `/api/auth/fcm-token` | Authenticated |

### Bookings
| Method | Path | Access |
|---|---|---|
| POST | `/api/bookings` | Client |
| GET | `/api/bookings/my` | Authenticated |
| GET | `/api/bookings/:id` | Authenticated |
| PATCH | `/api/bookings/:id/status` | Technician, Admin |
| PATCH | `/api/bookings/:id/assign` | Admin |
| PATCH | `/api/bookings/:id/cancel` | Client, Admin |
| GET | `/api/bookings` | Admin |

### Payments
| Method | Path | Access |
|---|---|---|
| POST | `/api/payments/create-order` | Client |
| POST | `/api/payments/verify` | Client |
| GET | `/api/payments/invoices` | Client |

### Venues
| Method | Path | Access |
|---|---|---|
| POST | `/api/venues` | Client |
| GET | `/api/venues/my` | Client |
| PATCH | `/api/venues/:id` | Client |
| DELETE | `/api/venues/:id` | Client |
| GET | `/api/venues` | Admin |

### Admin
| Method | Path | Access |
|---|---|---|
| GET | `/api/admin/stats` | Admin |
| GET | `/api/admin/users` | Admin |
| PATCH | `/api/admin/users/:id/toggle` | Admin |
| GET | `/api/admin/analytics` | Admin |

---

## User Roles

| Role | Description |
|---|---|
| `client` | Books services, tracks visits, makes payments |
| `technician` | Views assigned jobs, updates status, adds spare parts |
| `admin` | Full access — manages all entities, assigns technicians |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile Frontend | React Native + Expo |
| State Management | Redux Toolkit |
| Backend | Node.js + Express.js |
| Database | MongoDB Atlas + Mongoose |
| Auth | JWT (RS256-compatible) |
| Payments | Razorpay |
| Storage | Cloudinary |
| Notifications | Firebase Cloud Messaging |
| Fonts | Montserrat + Space Mono |

---

## Design System

- **Background**: `#231f20` (Charcoal Black)
- **Surface**: `#2b2728`
- **Accent**: `#ed1d24` (Signal Red)
- **Typography**: Montserrat (headings) + Space Mono (tech/metadata)
- **Style**: Dark matte, glassmorphism, precision engineering aesthetic

---

## Brand

ATOMIK• — Audio Engineering and Design · Service Infrastructure
