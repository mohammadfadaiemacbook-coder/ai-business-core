# Nexora AI for macOS

This is a lightweight Electron desktop shell for the existing hosted Nexora AI application. It does not fork the backend or create a second database: sign-in, provider settings, YouTube OAuth, analytics and content workflows continue to use the existing Cloudflare Worker, D1 database and GitHub Pages app.

## Build

Requires macOS and Node.js 22:

```bash
cd desktop
npm install
npm run dist:mac
```

The universal DMG is written to `desktop/dist/`.

## Install

Open the DMG, drag Nexora AI into Applications, then launch it. This unsigned community build may be blocked by Gatekeeper; use Finder > Control-click the app > Open only if you trust the build source. A Developer ID certificate and Apple notarization are required for a fully trusted public installer.

## Security and limitations

- Renderer Node.js integration is disabled; context isolation and Chromium sandbox are enabled.
- External HTTPS links open in the default browser.
- The app loads the production web application over HTTPS; an internet connection is required.
- Secrets remain managed by the existing secure provider-settings flow and Cloudflare Worker. Do not paste API keys into chat.
- YouTube OAuth and media permissions should be tested on the installed build before production use.
