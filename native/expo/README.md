# AI Business Core — Expo native shell

This is the first Expo-based Android/iOS client layer. It intentionally lives beside the existing PWA and legacy Android wrapper; it does not replace either one.

## Current behavior
- Opens the existing Persian AI Business Core workspace inside a native React Native WebView.
- Opens external destinations, including Google OAuth, in the system browser.
- Provides native back navigation, reload, loading and connection-error states.
- Supports Expo Updates checks only after an EAS project ID is configured.
- Does not embed API keys, Cloudflare secrets, OAuth tokens, or provider credentials.

## Toolchain
Targets Expo SDK 58, React Native 0.88, React 19.3 and the New Architecture. WebView is pinned to 14.0.1. SDK 58 requires Node.js 22.13 or newer.

## Local setup
```bash
cd native/expo
npm install
npx expo install --fix
npx expo-doctor
npm run typecheck
npx expo start
```

For an Android APK:
```bash
npx expo prebuild --platform android
npx expo run:android
```

Or use EAS after configuring the Expo account and project:
```bash
eas build:configure
eas build --platform android --profile preview
```

## OTA updates
Set EAS_PROJECT_ID in the build environment and configure EAS Update before enabling OTA updates. Until then, the native shell does not pretend that remote updates are active. The PWA has its own service-worker update prompt.

## Important limitations
This is a native shell around the current hosted PWA, not yet a full React Native rewrite. Native secure token storage, native media capture/export, push notifications, and native OAuth callback/deep-link handoff are not implemented in this first scaffold. The existing WebView Canvas/MediaRecorder behavior still needs real-device testing. The current Cloudflare Worker must be updated separately before the security fixes in the repository branch take effect.
