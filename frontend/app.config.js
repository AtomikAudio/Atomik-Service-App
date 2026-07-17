/**
 * ATOMIK Audio — Expo config (EAS Build / Google Play).
 * Run `eas init` once to link this app to your Expo account (adds extra.eas.projectId).
 */

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
    version: '1.0.0',
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
      apiUrl: process.env.EXPO_PUBLIC_API_URL?.trim() || 'https://atomik-api.onrender.com/api',
    },
  },
};
