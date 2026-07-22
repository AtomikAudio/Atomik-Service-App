/**
 * ATOMIK Audio — Expo config (EAS Build / Google Play).
 * Run `eas init` once to link this app to your Expo account (adds extra.eas.projectId).
 */

const fs = require('fs');
const path = require('path');

// FCM config for Android push.
// Local: keep frontend/google-services.json (gitignored — never commit).
// EAS: set production file env GOOGLE_SERVICES_JSON (eas env:create --type file).
const googleServicesFromEnv = process.env.GOOGLE_SERVICES_JSON?.trim();
const googleServicesPath = path.resolve(__dirname, 'google-services.json');
const androidGoogleServicesFile = googleServicesFromEnv
  ? googleServicesFromEnv
  : fs.existsSync(googleServicesPath)
    ? './google-services.json'
    : undefined;

if (
  process.env.EAS_BUILD_PROFILE === 'production' &&
  !androidGoogleServicesFile
) {
  throw new Error(
    'Production build blocked: missing Firebase google-services.json. ' +
      'Keep it locally at frontend/google-services.json (gitignored), and set ' +
      'EAS production file env GOOGLE_SERVICES_JSON for cloud builds.'
  );
}

const PLACEHOLDER_API_HOSTS = [
  'YOUR_PRODUCTION_API_HOST',
  'YOUR_STAGING_API_HOST',
  'YOUR_LAN_IP',
  'yourdomain.com',
  'localhost',
  'trycloudflare.com',
];

function assertProductionApiUrl() {
  const profile = process.env.EAS_BUILD_PROFILE;
  if (profile !== 'production') return;

  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';
  if (!apiUrl) {
    throw new Error(
      'Production build blocked: set EXPO_PUBLIC_API_URL in EAS (eas env:create --environment production).'
    );
  }

  const lower = apiUrl.toLowerCase();
  if (
    PLACEHOLDER_API_HOSTS.some((h) => lower.includes(h.toLowerCase())) ||
    !apiUrl.startsWith('https://')
  ) {
    throw new Error(
      `Production build blocked: EXPO_PUBLIC_API_URL must be a real HTTPS API URL, got "${apiUrl}".`
    );
  }
}

assertProductionApiUrl();

module.exports = {
  expo: {
    name: 'ATOMIK Audio',
    slug: 'atomik-audio',
    version: '1.1.6',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    scheme: 'atomikaudio',
    newArchEnabled: true,
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#231f20',
    },
    assetBundlePatterns: ['**/*'],
    updates: {
      enabled: false,
      checkAutomatically: 'NEVER',
      fallbackToCacheTimeout: 0,
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.atomikaudio.service',
      buildNumber: '1',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'ATOMIK uses your location to pin your service venue on the map.',
        NSCameraUsageDescription:
          'ATOMIK uses the camera to attach reference photos to your service request.',
        NSPhotoLibraryUsageDescription:
          'ATOMIK uses your photo library to attach reference photos to your service request.',
      },
    },
    android: {
      package: 'com.atomikaudio.service',
      versionCode: 1,
      ...(androidGoogleServicesFile
        ? { googleServicesFile: androidGoogleServicesFile }
        : {}),
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#231f20',
      },
      permissions: [
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'CAMERA',
        'POST_NOTIFICATIONS',
      ],
      blockedPermissions: [
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-font',
      'expo-secure-store',
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#8e302f',
          defaultChannel: 'default',
        },
      ],
      [
        'expo-splash-screen',
        {
          backgroundColor: '#231f20',
          image: './assets/splash.png',
          resizeMode: 'contain',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            'Allow ATOMIK to access your photos to attach reference images to service requests.',
          cameraPermission:
            'Allow ATOMIK to use the camera to attach reference photos to service requests.',
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Allow ATOMIK to use your location to set your service venue on the map.',
        },
      ],
    ],
    extra: {
      eas: {
        // Linked via `eas init` (non-interactive)
        projectId: "30dcf4d7-36e2-43e2-b5eb-386aa267f6ce"
      },
      // Always prefer the live Render URL. Legacy atomik-api.onrender.com is remapped
      // in apiConfig.ts so old env values cannot cause 503s.
      apiUrl: (() => {
        const raw = process.env.EXPO_PUBLIC_API_URL?.trim() || '';
        const fallback = 'https://atomik-service-app.onrender.com/api';
        if (!raw || raw.includes('YOUR_') || raw.includes('localhost')) return fallback;
        if (raw.toLowerCase().includes('atomik-api.onrender.com')) return fallback;
        return raw;
      })(),
    },
  },
};
