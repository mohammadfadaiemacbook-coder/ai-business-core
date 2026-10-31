const { app, BrowserWindow, shell, Menu } = require("electron");

const APP_URL = "https://mohammadfadaiemacbook-coder.github.io/ai-business-core/";

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
    if (url.startsWith("https://") || url.startsWith("mailto:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    const target = new URL(url);
    const allowed = new URL(APP_URL);
    if (target.origin !== allowed.origin && target.protocol !== "https:") {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  win.loadURL(APP_URL);
  return win;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: "Nexora AI",
      submenu: [
        { role: "about", label: "درباره Nexora AI" },
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
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});