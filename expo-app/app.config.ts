import type { ExpoConfig } from 'expo/config'

/**
 * AdminOS mobile — one codebase, two Android stores.
 *
 *   APP_STORE=play    Google Play (AAB). Push via FCM: needs GOOGLE_SERVICES_JSON
 *                     (an EAS "file" environment variable holding google-services.json).
 *   APP_STORE=huawei  Huawei AppGallery (APK). Huawei phones without Google
 *                     Play Services can't receive FCM, so push registration is
 *                     skipped and the in-app notification list is the channel.
 *
 * Public build-time values (set as EAS environment variables, never committed):
 *   EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY  — same public values the web app ships
 *   EXPO_PUBLIC_API_URL                                       — defaults to https://adminos.co.za
 *   EAS_PROJECT_ID                                            — from `eas init`; enables OTA updates
 *
 * The Android package name is permanent once published: za.co.adminos is the
 * reverse of adminos.co.za, the domain we own.
 */

const store = (process.env.APP_STORE ?? 'play') as 'play' | 'huawei'
const projectId = process.env.EAS_PROJECT_ID
const version = '1.0.0'

const config: ExpoConfig = {
  name: 'AdminOS',
  slug: 'adminos',
  owner: process.env.EXPO_OWNER || undefined,
  version,
  scheme: 'adminos',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0A0F2C',
  runtimeVersion: { policy: 'appVersion' },
  ...(projectId ? { updates: { url: `https://u.expo.dev/${projectId}`, checkAutomatically: 'ON_LOAD', fallbackToCacheTimeout: 0 } } : {}),

  ios: {
    bundleIdentifier: 'za.co.adminos',
    buildNumber: '1',
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription: 'AdminOS uses the camera to photograph receipts for your expense claims.',
      NSLocationWhenInUseUsageDescription: 'AdminOS records where you clock in and out, if your employer requires it.',
      NSFaceIDUsageDescription: 'AdminOS can use Face ID to unlock the app.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },

  android: {
    package: 'za.co.adminos',
    // versionCode is managed remotely by EAS (eas.json appVersionSource: remote).
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      monochromeImage: './assets/adaptive-icon-monochrome.png',
      backgroundColor: '#6366F1',
    },
    ...(store === 'play' && process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}),
    permissions: [
      'android.permission.CAMERA',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.USE_BIOMETRIC',
      'android.permission.USE_FINGERPRINT',
      'android.permission.POST_NOTIFICATIONS',
    ],
    // Pulled in by libraries but never used — each one is a Data Safety
    // question and a reason for reviewers (and users) to distrust the app.
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_MEDIA_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
  },

  web: { bundler: 'metro', output: 'static', favicon: './assets/favicon.png' },

  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-splash-screen', {
      image: './assets/splash-icon.png',
      imageWidth: 120,
      backgroundColor: '#0A0F2C',
      resizeMode: 'contain',
    }],
    ['expo-location', {
      locationWhenInUsePermission: 'AdminOS records where you clock in and out, if your employer requires it.',
      isAndroidBackgroundLocationEnabled: false,
      isIosBackgroundLocationEnabled: false,
    }],
    ['expo-image-picker', {
      cameraPermission: 'AdminOS uses the camera to photograph receipts for your expense claims.',
      photosPermission: false,
      microphonePermission: false,
    }],
    ['expo-local-authentication', { faceIDPermission: 'AdminOS can use Face ID to unlock the app.' }],
    ['expo-notifications', {
      icon: './assets/notification-icon.png',
      color: '#6366F1',
      defaultChannel: 'default',
    }],
    ['expo-build-properties', {
      android: {
        // Play requires targetSdk 36 for new apps from 31 Aug 2026; SDK 57 defaults to it.
        enableProguardInReleaseBuilds: true,
        enableShrinkResourcesInReleaseBuilds: true,
      },
    }],
    'expo-updates',
  ],

  extra: {
    store,
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'https://adminos.co.za',
    router: { origin: false },
    ...(projectId ? { eas: { projectId } } : {}),
  },
}

export default config
