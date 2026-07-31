import { Router, Request, Response } from 'express';

/**
 * Public app config for store-update prompts.
 * Set these on the host (Render env) when you ship a new Play build:
 *   ANDROID_LATEST_VERSION=1.1.7
 *   ANDROID_LATEST_VERSION_CODE=2
 *   ANDROID_MIN_VERSION=1.1.0          (optional — below this = forced update)
 *   ANDROID_MIN_VERSION_CODE=1
 *   ANDROID_FORCE_UPDATE=false
 *   ANDROID_STORE_URL=https://play.google.com/store/apps/details?id=com.atomikaudio.service
 *   APP_UPDATE_MESSAGE=A newer ATOMIK build is available on Play Store.
 */
const DEFAULT_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.atomikaudio.service';

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null || raw.trim() === '') return fallback;
  const v = raw.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function parseIntEnv(raw: string | undefined): number | null {
  if (raw == null || raw.trim() === '') return null;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

const router = Router();

router.get('/version', (_req: Request, res: Response) => {
  const latestVersion =
    process.env.ANDROID_LATEST_VERSION?.trim() ||
    process.env.APP_LATEST_VERSION?.trim() ||
    '';
  const latestVersionCode = parseIntEnv(
    process.env.ANDROID_LATEST_VERSION_CODE ?? process.env.APP_LATEST_VERSION_CODE
  );
  const minVersion =
    process.env.ANDROID_MIN_VERSION?.trim() ||
    process.env.APP_MIN_VERSION?.trim() ||
    '';
  const minVersionCode = parseIntEnv(
    process.env.ANDROID_MIN_VERSION_CODE ?? process.env.APP_MIN_VERSION_CODE
  );
  const storeUrl =
    process.env.ANDROID_STORE_URL?.trim() ||
    process.env.APP_STORE_URL?.trim() ||
    DEFAULT_STORE_URL;
  const forceUpdate = parseBool(process.env.ANDROID_FORCE_UPDATE, false);
  const message =
    process.env.APP_UPDATE_MESSAGE?.trim() ||
    'A newer version of ATOMIK is available. Update to continue with the latest fixes and features.';

  res.json({
    success: true,
    data: {
      platform: 'android',
      latestVersion: latestVersion || null,
      latestVersionCode,
      minVersion: minVersion || null,
      minVersionCode,
      forceUpdate,
      storeUrl,
      message,
    },
  });
});

export default router;
