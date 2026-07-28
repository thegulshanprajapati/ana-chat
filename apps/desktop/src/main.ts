import { app, BrowserWindow, ipcMain, nativeTheme } from "electron";
import path from "path";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devUrl = "http://localhost:5173";
  if (process.env.NODE_ENV === "development" || !app.isPackaged) {
    mainWindow.loadURL(devUrl).catch(() => {
      mainWindow?.loadFile(path.join(__dirname, "index.html"));
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../../frontend/dist/index.html")).catch(() => {
      mainWindow?.loadFile(path.join(__dirname, "index.html"));
    });
  }
  
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("ready", createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (!mainWindow) createWindow();
});

ipcMain.handle("get-theme", () => nativeTheme.shouldUseDarkColors ? "dark" : "light");
