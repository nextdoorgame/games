import { app, BrowserWindow } from "electron";
import { startStaticServer } from "../server.mjs";

let mainWindow;
let staticServer;
async function createWindow() {
  staticServer = await startStaticServer({
    preferredPort: 5173,
    host: "127.0.0.1",
    rootDir: app.getAppPath()
  });

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 980,
    minHeight: 680,
    title: "五子棋 Gomoku",
    backgroundColor: "#f7f6f1",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  await mainWindow.loadURL(staticServer.url);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (staticServer?.server) staticServer.server.close();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
