// Capsule for Windows: a native window around the same app, with its own private server and data folder.
// Everything stays on this PC: the database and photos live in %APPDATA%\Capsule\data.
const { app, BrowserWindow, Menu, shell, dialog } = require("electron");
const { spawn } = require("node:child_process");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const fs = require("node:fs");

app.setName("Capsule");
const PREFERRED_PORT = 47621; // fixed so the browser-side settings (localStorage) survive restarts
const DATA_DIR = path.join(app.getPath("userData"), "data");
const SERVER_DIR = app.isPackaged ? path.join(process.resourcesPath, "server") : path.join(__dirname, "..", ".next", "standalone");
const ICON = path.join(__dirname, "..", "build", "icon.png");

let win = null;
let server = null;
let port = PREFERRED_PORT;

if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

const freePort = (want) =>
  new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => {
      const t = net.createServer();
      t.listen(0, "127.0.0.1", () => {
        const p = t.address().port;
        t.close(() => resolve(p));
      });
    });
    s.listen(want, "127.0.0.1", () => s.close(() => resolve(want)));
  });

function waitForServer(p, ms = 40000) {
  const until = Date.now() + ms;
  return new Promise((resolve, reject) => {
    const ping = () => {
      const r = http.get({ host: "127.0.0.1", port: p, path: "/", timeout: 1500 }, (res) => {
        res.resume();
        resolve();
      });
      r.on("error", () => (Date.now() > until ? reject(new Error("The Capsule server did not start in time.")) : setTimeout(ping, 300)));
      r.on("timeout", () => r.destroy());
    };
    ping();
  });
}

function startServer() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const entry = path.join(SERVER_DIR, "server.js");
  if (!fs.existsSync(entry)) throw new Error(`Server files are missing (${entry}). Run "npm run desktop:build" first.`);
  const logFile = path.join(app.getPath("userData"), "server.log");
  server = spawn(process.execPath, [entry], {
    cwd: SERVER_DIR,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production", PORT: String(port), HOSTNAME: "127.0.0.1", CAPSULE_DATA_DIR: DATA_DIR },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const log = fs.createWriteStream(logFile, { flags: "a" });
  server.stdout.pipe(log);
  server.stderr.pipe(log);
  server.on("exit", (code) => {
    if (!app.isQuitting && code) dialog.showErrorBox("Capsule", `The built-in server stopped (code ${code}). Details: ${logFile}`);
  });
}

const splash =
  "data:text/html;charset=utf-8," +
  encodeURIComponent(
    '<body style="margin:0;display:grid;place-items:center;height:100vh;background:#1b1a18;color:#faf8f5;font:15px system-ui"><div style="opacity:.85">Opening Capsule…</div></body>',
  );

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 420,
    minHeight: 600,
    backgroundColor: "#faf8f5",
    title: "Capsule",
    icon: ICON,
    show: false,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false },
  });
  win.once("ready-to-show", () => win.show());
  win.loadURL(splash);
  const local = () => `http://127.0.0.1:${port}`;
  // anything that is not Capsule itself opens in the normal browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(local())) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(local()) && !url.startsWith("data:")) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
  win.on("closed", () => {
    win = null;
  });
}

function menu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Capsule",
        submenu: [
          { label: "Open my data folder", click: () => shell.openPath(DATA_DIR) },
          { label: "Reload", accelerator: "CmdOrCtrl+R", click: () => win && win.webContents.reload() },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      { label: "View", submenu: [{ role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { role: "togglefullscreen" }] },
    ]),
  );
}

app.whenReady().then(async () => {
  menu();
  createWindow();
  try {
    port = await freePort(PREFERRED_PORT);
    startServer();
    await waitForServer(port);
    if (win) await win.loadURL(`http://127.0.0.1:${port}/`);
  } catch (e) {
    dialog.showErrorBox("Capsule could not start", String((e && e.message) || e));
    app.quit();
  }
});

app.on("before-quit", () => {
  app.isQuitting = true;
  if (server && !server.killed) server.kill();
});
app.on("window-all-closed", () => app.quit());
