# Android APK (Android 15)

The Android shell wraps the HTTPS-hosted GitHub Pages application in a WebView. It keeps JavaScript and DOM storage enabled for the existing local-first workspace, permits the browser file picker for supported upload controls, and opens unrelated external links in the system browser.

## Build

GitHub Actions workflow: **Build Android APK**. Run it manually from Actions or let it run after changes to `android/**`. Download the artifact named `ai-business-core-android-debug`; the APK is `app-debug.apk`.

This is a debug-signed APK for testing and direct installation. It is not a Play Store release. A production release requires a privately managed signing key and a protected GitHub Actions secret; never commit the keystore or passwords.

## Runtime requirements and limitations

- Android 6.0+ is the declared minimum; target SDK is 35 (Android 15).
- Internet access is required because the web app is loaded from GitHub Pages.
- Workspace records and AI Studio session settings use the WebView's app-local browser storage; they do not automatically sync with Chrome or another device.
- AI requests continue to use the existing Cloudflare Worker. No provider key is embedded in the APK.
- File selection is enabled for web file inputs. This does not guarantee every Android document-provider or large-file workflow.
- Push notifications, home-screen widgets, background scheduling and native share integrations are not included in this first APK.
- Verify the app on a physical Android 15 device before treating it as production-ready.
