# ATOMIK App Update Popup (Play Store)

How the in-app **Update Available** dialog works, what to set on **Render**, and what must be in the app for **UPDATE** to open the Play Store listing.

**Living code**

| Piece | Path |
|-------|------|
| Branded dialog | `frontend/src/components/common/ThemedConfirmModal.tsx` |
| Update gate (shows popup) | `frontend/src/components/common/AppUpdateGate.tsx` |
| Version check + Play Store open | `frontend/src/services/appUpdate.ts` |
| Mounted in app root | `frontend/App.tsx` (`<AppUpdateGate />`) |
| Public API | `backend/src/routes/app.ts` → `GET /api/app/version` |
| Wired in Express | `backend/src/app.ts` (`app.use('/api/app', appRoutes)`) |

**Service on Render:** [Atomik-Service-App](https://dashboard.render.com/web/srv-d9fn5rhkh4rs73cq8660)  
**API base:** `https://atomik-service-app.onrender.com/api`  
**Play Store URL:** `https://play.google.com/store/apps/details?id=com.atomikaudio.service`  
**Package ID:** `com.atomikaudio.service`

---

## 1. What the user sees

When the installed Android build is **behind** the version configured on Render:

1. Branded ATOMIK confirm dialog appears (same look as logout / service-completed dialogs).
2. Title: **Update Available**
3. Primary button: **UPDATE** → opens Play Store (`market://` with HTTPS fallback).
4. Secondary button: **LATER** (soft updates only) → dismisses until the next newer version.
5. Forced updates hide **LATER** and cannot be dismissed via scrim / back.

Checks run shortly after launch and again when the app returns to the foreground.

---

## 2. End-to-end flow

```
App launch / resume
        │
        ▼
AppUpdateGate → GET /api/app/version
        │
        ▼
Compare installed version + versionCode
  vs ANDROID_LATEST_* (and optional min / force)
        │
   behind? ──no──► no popup
        │
       yes
        │
        ▼
ThemedConfirmModal
   UPDATE → openPlayStore()
            market://details?id=com.atomikaudio.service
            or https://play.google.com/store/apps/details?id=...
```

---

## 3. Changes on Render (required for the popup)

Open **Atomik-Service-App** → **Environment** and set (or update) these keys.

| Env var | Example | Purpose |
|---------|---------|---------|
| `ANDROID_LATEST_VERSION` | `1.1.7` | Marketing / semver string of the newest Play build |
| `ANDROID_LATEST_VERSION_CODE` | `2` | Android `versionCode` of that build (preferred compare) |
| `ANDROID_STORE_URL` | `https://play.google.com/store/apps/details?id=com.atomikaudio.service` | HTTPS listing (fallback if `market://` fails) |
| `APP_UPDATE_MESSAGE` | `A newer version of ATOMIK is available…` | Body copy in the dialog |
| `ANDROID_FORCE_UPDATE` | `false` | `true` = must update (no **LATER**) |
| `ANDROID_MIN_VERSION` | `1.1.6` | Optional — installed below this = forced |
| `ANDROID_MIN_VERSION_CODE` | `1` | Optional — installed code below this = forced |

### When you ship a new Play build

1. Publish the new AAB/APK on Play Console (bump `version` + `versionCode` in `frontend/app.config.js`).
2. On Render, set:
   - `ANDROID_LATEST_VERSION` = that new `version` (e.g. `1.1.7`)
   - `ANDROID_LATEST_VERSION_CODE` = that new `versionCode` (e.g. `2`)
3. Save → Render restarts the service so `/api/app/version` returns the new numbers.
4. Users still on the old build will see the popup on next open / resume.

### If latest is not set

If both `ANDROID_LATEST_VERSION` and `ANDROID_LATEST_VERSION_CODE` are empty, the API returns nulls and **the app shows no popup**.

### Current baseline (this release)

- App marketing version: `1.1.7`
- Android `versionCode`: managed by **EAS remote** (`eas.json` → `appVersionSource: remote`, `autoIncrement: true`). Next production build after code `26` is **`27`**.
- Render must match after this build is on Play:
  - `ANDROID_LATEST_VERSION=1.1.7`
  - `ANDROID_LATEST_VERSION_CODE=27`
  - `ANDROID_FORCE_UPDATE=false`

Users still on older installs (e.g. `1.1.6` / code `≤26`) see the update popup once Render is set as above and the new build is live on Play Store.

---

## 4. Code that must be in the app

These pieces must be present in the **shipped** client (EAS / Play build), not only Expo Go for production store redirects.

### Mount the gate

In `frontend/App.tsx`:

```tsx
import { AppUpdateGate } from './src/components/common/AppUpdateGate';

// inside AppShell, alongside AuthBootstrap:
<AppUpdateGate />
```

### Gate → branded dialog → Play Store

`AppUpdateGate` calls `checkForAppUpdate()`. If an update is needed it renders:

```tsx
<ThemedConfirmModal
  visible
  title="Update Available"
  message={...}
  icon="cloud-download-outline"
  confirmLabel="UPDATE"
  cancelLabel="LATER"
  hideCancel={forceUpdate}
  dismissible={!forceUpdate}
  onConfirm={() => openPlayStore(storeUrl)}
  onCancel={() => /* dismiss soft update */}
/>
```

`openPlayStore()` prefers:

1. `market://details?id=com.atomikaudio.service`
2. else `ANDROID_STORE_URL` / default HTTPS Play link

### Backend route (must be deployed)

`GET https://atomik-service-app.onrender.com/api/app/version`

Example response:

```json
{
  "success": true,
  "data": {
    "platform": "android",
    "latestVersion": "1.1.7",
    "latestVersionCode": 2,
    "minVersion": null,
    "minVersionCode": null,
    "forceUpdate": false,
    "storeUrl": "https://play.google.com/store/apps/details?id=com.atomikaudio.service",
    "message": "A newer version of ATOMIK is available. Update for the latest fixes and features."
  }
}
```

Deploy note: Render **Atomik-Service-App** auto-deploys from `main` (`backend` root). Push the `backend/src/routes/app.ts` changes to GitHub before relying on this in production.

---

## 5. Soft vs forced update

| Mode | When | UI |
|------|------|-----|
| Soft | Installed &lt; latest, and not below min / force flag | **UPDATE** + **LATER** |
| Forced | `ANDROID_FORCE_UPDATE=true` **or** installed &lt; min version/code | **UPDATE** only; no dismiss |

Soft “LATER” is remembered per latest version token in AsyncStorage (`atomik_update_dismissed_for`) so the same latest build is not nagged again until you publish a newer latest on Render.

---

## 6. Quick test checklist

1. Confirm API: open `/api/app/version` in a browser (wake free tier if cold).
2. Temporarily set Render `ANDROID_LATEST_VERSION_CODE` **higher** than the installed app’s `versionCode`.
3. Open the Android build that includes `AppUpdateGate`.
4. Dialog appears → tap **UPDATE** → Play Store opens for ATOMIK.
5. Set latest back to the real current store version when done testing (or leave it if that higher code is already live on Play).

---

## 7. Related brand dialog rules

Popup styling follows `docs/ATOMIK-Branded-Dialog-Guide.md` / `ThemedConfirmModal` (surface `#2b2728`, red CTA `#8e302f`, Montserrat, icon circle, etc.). Do not invent a second dialog style for updates.
