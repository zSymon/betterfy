// Betterfy – Electron-Hauptprozess
// Verantwortlich für: Fenster, Login (OAuth PKCE über Loopback), Token-Speicher, Widevine.
const electron = require('electron');
const { app, BrowserWindow, ipcMain, shell, protocol, net, safeStorage, session, Tray, Menu, nativeImage } = electron;
const widget = require('./widget.cjs');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const REDIRECT_PORT = 8888;
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/callback`;
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-read-recently-played',
  'user-top-read',
  'user-library-read',
  'user-library-modify',
  'user-follow-read',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ');

// Spotify prüft den User-Agent – den Electron-Teil entfernen, damit wir wie Chrome aussehen.
app.userAgentFallback = app.userAgentFallback
  .replace(/\sElectron\/\S+/i, '')
  .replace(new RegExp(`\\s${app.getName()}\\/\\S+`, 'i'), '');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// Feste App-ID: sauberes Anheften an die Taskleiste
app.setAppUserModelId('de.zsymon.betterfy');
// Screenshot-Tests laufen mit eigenem Profil, damit sie eine laufende Instanz nicht stören
if (process.env.AURA_SCREENSHOT) app.setPath('userData', path.join(require('node:os').tmpdir(), 'betterfy-screenshot'));

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

// ---------- Persistenter, verschlüsselter Speicher ----------
const storeFile = () => path.join(app.getPath('userData'), 'betterfy-store.json');

function readStore() {
  try {
    const raw = fs.readFileSync(storeFile());
    const text = raw[0] === 0x7b /* { */ ? raw.toString('utf8') : safeStorage.decryptString(raw);
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function writeStore(data) {
  const text = JSON.stringify(data);
  const out = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(text) : Buffer.from(text, 'utf8');
  fs.mkdirSync(path.dirname(storeFile()), { recursive: true });
  fs.writeFileSync(storeFile(), out);
}

function patchStore(patch) {
  const next = { ...readStore(), ...patch };
  for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
  writeStore(next);
  return next;
}

// ---------- OAuth (Authorization Code + PKCE) ----------
const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let pendingAuth = null;

function waitForCallback(expectedState) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, REDIRECT_URI);
      if (url.pathname !== '/callback') {
        res.writeHead(404).end();
        return;
      }
      const error = url.searchParams.get('error');
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const ok = !error && code && state === expectedState;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html><meta charset="utf-8"><title>Betterfy</title>
        <body style="margin:0;height:100vh;display:grid;place-items:center;background:#0b0d0c;color:#eee;font:16px system-ui">
        <div style="text-align:center"><div style="font-size:42px">${ok ? '✓' : '✕'}</div>
        <p>${ok ? 'Angemeldet. Du kannst diesen Tab schließen und zu Betterfy zurückkehren.' : 'Anmeldung fehlgeschlagen: ' + (error || 'ungültige Antwort')}</p></div>`);
      cleanup();
      if (ok) resolve(code);
      else reject(new Error(error || 'Ungültige Antwort von Spotify'));
    });
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Zeitüberschreitung bei der Anmeldung'));
    }, 5 * 60 * 1000);
    function cleanup() {
      clearTimeout(timer);
      server.close();
      pendingAuth = null;
    }
    server.on('error', (e) => {
      cleanup();
      reject(new Error(`Port ${REDIRECT_PORT} ist belegt (${e.code}).`));
    });
    server.listen(REDIRECT_PORT, '127.0.0.1');
    pendingAuth = { cancel: () => { cleanup(); reject(new Error('Abgebrochen')); } };
  });
}

async function tokenRequest(params) {
  const res = await net.fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error_description || json.error || `Token-Fehler ${res.status}`);
  return json;
}

function saveTokens(clientId, t, previousRefresh) {
  patchStore({
    clientId,
    accessToken: t.access_token,
    refreshToken: t.refresh_token || previousRefresh,
    expiresAt: Date.now() + (t.expires_in - 60) * 1000,
  });
}

async function login(clientId) {
  if (!clientId) throw new Error('Keine Client-ID angegeben');
  pendingAuth?.cancel();
  const verifier = b64url(crypto.randomBytes(64));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));
  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
    state,
  }).toString();

  const codePromise = waitForCallback(state);
  await shell.openExternal(authUrl.toString());
  const code = await codePromise;
  const tokens = await tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: clientId,
    code_verifier: verifier,
  });
  saveTokens(clientId, tokens);
  focusWindow();
  return true;
}

let refreshing = null;
async function getToken(force = false) {
  const s = readStore();
  if (!s.refreshToken || !s.clientId) return null;
  if (!force && s.accessToken && Date.now() < s.expiresAt) return s.accessToken;
  refreshing ??= tokenRequest({ grant_type: 'refresh_token', refresh_token: s.refreshToken, client_id: s.clientId })
    .then((t) => {
      saveTokens(s.clientId, t, s.refreshToken);
      return t.access_token;
    })
    .catch((e) => {
      // Refresh-Token ungültig → abmelden
      if (/invalid_grant|revoked/i.test(e.message)) patchStore({ accessToken: undefined, refreshToken: undefined });
      throw e;
    })
    .finally(() => (refreshing = null));
  return refreshing;
}

// ---------- Fenster ----------
let win;

function focusWindow() {
  if (!win || win.isDestroyed()) return createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

// ---------- Desktop-Widget ----------
let quitting = false;
let tray = null;

const widgetPrefs = () => ({ enabled: false, size: 'medium', ...(readStore().prefs?.widget || {}) });

function widgetUrl() {
  const mock = process.env.AURA_MOCK ? `?mock&${process.env.AURA_MOCK}` : '';
  return DEV_URL ? `${DEV_URL}/widget.html${mock}` : `app://aura/widget.html${mock}`;
}

function setWidgetPrefs(patch) {
  const prefs = readStore().prefs || {};
  const next = { ...widgetPrefs(), ...patch };
  patchStore({ prefs: { ...prefs, widget: next } });
  syncWidget();
  broadcast('widget:changed', next);
  updateTray();
  return next;
}

function syncWidget() {
  // Debug: AURA_SCREENSHOT_WIDGET=small|medium|large erzwingt das Widget (ohne zu speichern)
  const force = process.env.AURA_SCREENSHOT_WIDGET;
  const p = force ? { ...widgetPrefs(), enabled: true, size: force } : widgetPrefs();
  if (!p.enabled) return widget.close();
  widget.open({
    url: widgetUrl(),
    preload: path.join(__dirname, 'preload.cjs'),
    prefs: p,
    onMoved: (pos) => {
      const prefs = readStore().prefs || {};
      patchStore({ prefs: { ...prefs, widget: { ...widgetPrefs(), ...pos } } });
    },
  });
}

function broadcast(channel, payload) {
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send(channel, payload);
}

/** Tray-Symbol: Ring mit Punkt (wie das Logo), programmatisch gezeichnet. */
function trayIcon() {
  const size = 32;
  const buf = Buffer.alloc(size * size * 4);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      const ring = Math.max(0, 1 - Math.abs(d - 12) / 1.6);
      const dot = Math.max(0, Math.min(1, 5 - d));
      const a = Math.min(1, ring + dot);
      const i = (y * size + x) * 4;
      buf[i] = 210; // B
      buf[i + 1] = 232; // G
      buf[i + 2] = 124; // R
      buf[i + 3] = Math.round(a * 255);
    }
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

function updateTray() {
  if (!tray) return;
  const p = widgetPrefs();
  const sizes = [
    ['small', 'Klein'],
    ['medium', 'Mittel'],
    ['large', 'Groß'],
  ];
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Betterfy öffnen', click: focusWindow },
      { type: 'separator' },
      { label: 'Desktop-Widget', type: 'checkbox', checked: p.enabled, click: (i) => setWidgetPrefs({ enabled: i.checked }) },
      {
        label: 'Widget-Größe',
        enabled: p.enabled,
        submenu: sizes.map(([id, label]) => ({ label, type: 'radio', checked: p.size === id, click: () => setWidgetPrefs({ size: id }) })),
      },
      { type: 'separator' },
      ...(app.isPackaged
        ? [
            {
              label: 'Mit Windows starten',
              type: 'checkbox',
              checked: app.getLoginItemSettings().openAtLogin,
              click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked }),
            },
          ]
        : []),
      {
        label: 'Beenden',
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip('Betterfy');
  tray.on('click', focusWindow);
  updateTray();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1040,
    minHeight: 640,
    show: false,
    backgroundColor: '#0a0c0b',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: '#e8ece9', height: 52 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false, // Musik/SDK laufen weiter, wenn das Fenster im Tray ist
    },
  });

  win.once('ready-to-show', () => win.show());
  // Mit aktivem Widget: Schließen = in den Tray, damit Widget und Musik weiterlaufen
  win.on('close', (e) => {
    if (!quitting && widgetPrefs().enabled) {
      e.preventDefault();
      win.hide();
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    const allowed = DEV_URL ? url.startsWith(DEV_URL) : url.startsWith('app://');
    if (!allowed) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });

  if (DEV_URL) win.loadURL(DEV_URL);
  else win.loadURL(`app://aura/index.html${process.env.AURA_MOCK ? `?mock&${process.env.AURA_MOCK}` : ''}`);

  // Debug-Hilfe: AURA_SCREENSHOT=pfad.png → nach dem Laden Screenshot speichern und beenden
  if (process.env.AURA_SCREENSHOT) {
    win.webContents.once('did-finish-load', () =>
      setTimeout(async () => {
        const target = process.env.AURA_SCREENSHOT_WIDGET ? widget.get() : win;
        const img = await target.webContents.capturePage();
        fs.writeFileSync(process.env.AURA_SCREENSHOT, img.toPNG());
        app.quit();
      }, Number(process.env.AURA_SCREENSHOT_DELAY || 4000)),
    );
  }
}

// ---------- IPC ----------
ipcMain.handle('auth:login', (_e, clientId) => login(String(clientId || '').trim()));
ipcMain.handle('auth:cancel', () => pendingAuth?.cancel());
ipcMain.handle('auth:token', (_e, force) => getToken(Boolean(force)));
ipcMain.handle('auth:logout', () => {
  patchStore({ accessToken: undefined, refreshToken: undefined, expiresAt: undefined });
  return true;
});
ipcMain.handle('config:get', () => {
  const s = readStore();
  return { clientId: s.clientId || '', redirectUri: REDIRECT_URI, loggedIn: Boolean(s.refreshToken), prefs: s.prefs || {} };
});
ipcMain.handle('config:prefs', (_e, prefs) => {
  const next = { ...(readStore().prefs || {}), ...prefs };
  patchStore({ prefs: next });
  broadcast('prefs:changed', next);
  return true;
});
ipcMain.handle('widget:get', () => widgetPrefs());
ipcMain.handle('notes:styles', () => widget.notesStyles());
// Live-Brücke: Hauptfenster → Widget (Player-Status), Widget → Hauptfenster (Befehle)
ipcMain.on('player:state', (_e, s) => widget.get()?.webContents.send('player:state', s));
ipcMain.on('player:command', (_e, c) => {
  if (win && !win.isDestroyed()) win.webContents.send('player:command', c);
});
ipcMain.handle('widget:set', (_e, patch) => setWidgetPrefs(patch || {}));
ipcMain.handle('app:show', () => focusWindow());
ipcMain.handle('shell:open', (_e, url) => {
  if (/^https:\/\//.test(url) || url === 'spotify:') shell.openExternal(url);
});

// ---------- Start ----------
if (!process.env.AURA_SCREENSHOT && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', focusWindow);

  app.whenReady().then(async () => {
    // castLabs-Electron: Widevine-CDM laden (nötig für die Wiedergabe in der App)
    if (electron.components?.whenReady) {
      try {
        await electron.components.whenReady();
        console.log('[betterfy] Widevine bereit:', electron.components.status());
      } catch (e) {
        console.warn('[betterfy] Widevine konnte nicht geladen werden:', e);
      }
    } else {
      console.warn('[betterfy] Kein Widevine verfügbar (Standard-Electron). Wiedergabe nur über Spotify Connect.');
    }

    const dist = path.join(__dirname, '..', 'dist');
    protocol.handle('app', (req) => {
      const { pathname } = new URL(req.url);
      const file = path.normalize(path.join(dist, decodeURIComponent(pathname)));
      if (!file.startsWith(dist)) return new Response('Forbidden', { status: 403 });
      const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(dist, 'index.html');
      return net.fetch(pathToFileURL(target).toString());
    });

    // Diagnose: Antworten des Widevine-Lizenzservers von Spotify mitloggen
    session.defaultSession.webRequest.onCompleted({ urls: ['*://*.spotify.com/*license*', '*://*.spotify.com/*widevine*'] }, (d) => {
      console.log(`[drm] ${d.method} ${d.url.split('?')[0]} → ${d.statusCode}`);
    });

    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
      cb(['media', 'mediaKeySystem', 'protected-media-identifier', 'fullscreen', 'clipboard-sanitized-write'].includes(permission));
    });

    createWindow();
    createTray();
    syncWidget();
  });

  app.on('before-quit', () => (quitting = true));
  app.on('window-all-closed', () => app.quit());
}
