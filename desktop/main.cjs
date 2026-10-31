const { app, BrowserWindow, shell, Menu, dialog, net, session } = require("electron");
const path = require("node:path");

const APP_URL = "https://mohammadfadaiemacbook-coder.github.io/ai-business-core/";
const APP_ORIGIN = new URL(APP_URL).origin;
const RELEASES_API = "https://api.github.com/repos/mohammadfadaiemacbook-coder/ai-business-core/releases/latest";
const REPO_RELEASES = "https://github.com/mohammadfadaiemacbook-coder/ai-business-core/releases";
let mainWindow = null;
let updateCheckInProgress = false;

function isTrustedAppUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.origin === APP_ORIGIN || url.origin === "https://accounts.google.com";
  } catch {
    return false;
  }
}

async function checkForUpdates(showUpToDate = false) {
  if (updateCheckInProgress) return;
  updateCheckInProgress = true;
  try {
    const response = await net.fetch(RELEASES_API, {
      headers: { Accept: "application/vnd.github+json", "Cache-Control": "no-cache" }
    });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    const release = await response.json();
    const match = String(release.tag_name || "").match(/^mac-v(\d+\.\d+\.\d+)$/);
    const asset = (release.assets || []).find(item => item.name && item.name.endsWith(".dmg"));
    if (!match || !asset) {
      if (showUpToDate) await dialog.showMessageBox(mainWindow, {
        type: "info", title: "Nexora AI", message: "نسخه جدیدی برای مک منتشر نشده است."
      });
      return;
    }

    const latestVersion = match[1];
    const currentVersion = app.getVersion();
    if (latestVersion.localeCompare(currentVersion, undefined, { numeric: true }) <= 0) {
      if (showUpToDate) await dialog.showMessageBox(mainWindow, {
        type: "info", title: "Nexora AI", message: "برنامه شما به‌روز است."
      });
      return;
    }

    const choice = await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "بروزرسانی Nexora AI",
      message: `نسخه جدید ${latestVersion} آماده است.`,
      detail: "نسخه جدید شامل آخرین امکانات برنامه و بهبودهای دسکتاپ است. پس از دریافت فایل DMG، آن را باز کنید و برنامه را در پوشه Applications جایگزین کنید.",
      buttons: ["دریافت بروزرسانی", "بعداً"],
      defaultId: 0,
      cancelId: 1
    });
    if (choice.response !== 0) return;

    const downloads = app.getPath("downloads");
    const filePath = path.join(downloads, asset.name);
    const downloadSession = session.defaultSession;
    const onWillDownload = (_event, item) => {
      if (item.getURL() !== asset.browser_download_url && !item.getURL().includes("/releases/download/")) return;
      item.setSavePath(filePath);
      item.once("done", async (_event, state) => {
        downloadSession.removeListener("will-download", onWillDownload);
        if (state === "completed") {
          await dialog.showMessageBox(mainWindow, {
            type: "info",
            title: "دانلود کامل شد",
            message: "فایل بروزرسانی دریافت شد.",
            detail: "فایل DMG باز می‌شود. Nexora AI را به Applications بکشید و جایگزینی نسخه قبلی را تأیید کنید."
          });
          await shell.openPath(filePath);
        } else {
          await dialog.showMessageBox(mainWindow, {
            type: "warning", title: "دانلود ناموفق", message: "دریافت بروزرسانی کامل نشد. دوباره تلاش کنید."
          });
        }
      });
    };
    downloadSession.on("will-download", onWillDownload);
    downloadSession.downloadURL(asset.browser_download_url);
  } catch (error) {
    console.warn("Desktop update check failed:", error);
    if (showUpToDate) {
      await dialog.showMessageBox(mainWindow, {
        type: "warning",
        title: "بررسی بروزرسانی",
        message: "اتصال به سرور بروزرسانی برقرار نشد.",
        detail: "اتصال اینترنت را بررسی کنید و دوباره تلاش کنید."
      });
    }
  } finally {
    updateCheckInProgress = false;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 980,
    minHeight: 680,
    title: "Nexora AI",
    backgroundColor: "#081426",
    autoHideMenuBar: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("mailto:")) shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedAppUrl(url)) {
      event.preventDefault();
      if (url.startsWith("https://") || url.startsWith("mailto:")) shell.openExternal(url);
    }
  });

  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const trusted = details.requestingUrl && new URL(details.requestingUrl).origin === APP_ORIGIN;
    callback(Boolean(trusted && ["media", "notifications"].includes(permission)));
  });

  win.webContents.on("did-finish-load", () => {
    if (win.isDestroyed()) return;
    // The hosted app supplies the same feature set as the phone/web version.
  });

  win.loadURL(APP_URL);
  mainWindow = win;
  return win;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: "Nexora AI",
      submenu: [
        { role: "about", label: "درباره Nexora AI" },
        { type: "separator" },
        { label: "بررسی بروزرسانی…", click: () => checkForUpdates(true) },
        { type: "separator" },
        { role: "hide", label: "مخفی‌کردن" },
        { role: "quit", label: "خروج" }
      ]
    },
    {
      label: "نمایش",
      submenu: [
        { role: "reload", label: "بارگذاری مجدد" },
        { role: "togglefullscreen", label: "تمام‌صفحه" },
        { role: "zoomIn", label: "بزرگ‌نمایی" },
        { role: "zoomOut", label: "کوچک‌نمایی" },
        { role: "resetZoom", label: "اندازه پیش‌فرض" },
        { role: "toggleDevTools", label: "ابزار توسعه‌دهنده" }
      ]
    }
  ]));
  createWindow();
  setTimeout(() => checkForUpdates(false), 5000);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
