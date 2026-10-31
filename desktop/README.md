# Nexora AI for macOS

The macOS app is a native Electron desktop shell around the same hosted Nexora AI application used on mobile/web. It therefore shares the current application features, Worker APIs, YouTube connection, analytics, provider settings and workspace data; it does not create a separate backend or duplicate database.

## Build

Requires macOS and Node.js 22:

```bash
cd desktop
npm install
npm run dist:mac
```

The universal DMG is written to `desktop/dist/`.

## Updates

- The app checks GitHub Releases shortly after launch.
- You can also use **Nexora AI > بررسی بروزرسانی…** at any time.
- A newer `mac-vX.Y.Z` release prompts the user, downloads its DMG to Downloads and opens it.
- To finish replacing an unsigned build, open the DMG and drag Nexora AI into Applications, confirming replacement.
- Publish a new version by incrementing `desktop/package.json` and pushing a matching `mac-vX.Y.Z` tag. The release workflow builds and attaches the universal DMG.

## Install and limitations

Open the DMG and drag Nexora AI into Applications. This community build is unsigned; macOS Gatekeeper may require Finder > Control-click > Open. A Developer ID certificate and Apple notarization are required for a frictionless trusted installer and fully seamless in-place updating. The updater intentionally does not bypass macOS security or overwrite the running app.

## Security and capabilities

- Renderer Node.js integration is disabled; context isolation, Chromium sandbox and web security are enabled.
- Only the production app and Google sign-in origin can navigate inside the app; other HTTPS links open in the default browser.
- Microphone and notification permission requests are limited to the trusted hosted app origin.
- The app requires internet access for hosted features, OAuth, analytics and update checks.
- API keys and provider secrets remain in the existing secure settings and Cloudflare Worker flow. Never paste secrets into chat.
