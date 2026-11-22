// Desktop-Widget: rahmenloses, transparentes Fenster, das wie bei Widget Notes an den Desktop (Progman) gehängt wird
// und in dasselbe Raster einrastet (gleiche Zellgröße, gleiche Abstände, weicht Notiz-Kacheln aus).
const { BrowserWindow, screen, app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

// ---------- Win32 ----------
let native = null;
function win32() {
  if (native !== null) return native;
  try {
    const koffi = require('koffi');
    const u = koffi.load('user32.dll');
    native = {
      FindWindowW: u.func('__stdcall', 'FindWindowW', 'intptr', ['str16', 'str16']),
      GetWindowLongPtrW: u.func('__stdcall', 'GetWindowLongPtrW', 'intptr', ['intptr', 'int']),
      SetWindowLongPtrW: u.func('__stdcall', 'SetWindowLongPtrW', 'intptr', ['intptr', 'int', 'intptr']),
      SetWindowPos: u.func('__stdcall', 'SetWindowPos', 'bool', ['intptr', 'intptr', 'int', 'int', 'int', 'int', 'uint']),
    };
  } catch (e) {
    console.warn('[betterfy] Win32-Anbindung nicht verfügbar – Widget schwebt normal:', e.message);
    native = false;
  }
  return native;
}

const GWL_EXSTYLE = -20;
const GWLP_HWNDPARENT = -8;
const WS_EX_TOOLWINDOW = 0x80n;
const WS_EX_APPWINDOW = 0x40000n;
const HWND_BOTTOM = 1;
const SWP_NOSIZE = 0x1;
const SWP_NOMOVE = 0x2;
const SWP_NOACTIVATE = 0x10;

function hwndOf(win) {
  const buf = win.getNativeWindowHandle();
  return Number(buf.length >= 8 ? buf.readBigUInt64LE(0) : BigInt(buf.readUInt32LE(0)));
}

function attachToDesktop(win) {
  const w = win32();
  if (!w || process.platform !== 'win32') return;
  const hwnd = hwndOf(win);
  const progman = w.FindWindowW('Progman', null);
  if (progman) w.SetWindowLongPtrW(hwnd, GWLP_HWNDPARENT, progman);
  let ex = BigInt(w.GetWindowLongPtrW(hwnd, GWL_EXSTYLE));
  ex = (ex | WS_EX_TOOLWINDOW) & ~WS_EX_APPWINDOW;
  w.SetWindowLongPtrW(hwnd, GWL_EXSTYLE, Number(ex));
  sendToBottom(win);
}

function sendToBottom(win) {
  const w = win32();
  if (!w || !win || win.isDestroyed()) return;
  w.SetWindowPos(hwndOf(win), HWND_BOTTOM, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
}

// ---------- Raster (identisch zu Widget Notes / GridLayout.cs) ----------
const UNIT = 77;
const GAP = 16;
const STEP = UNIT + GAP;
const MARGIN = 16; // transparenter Rand um die Kachel (Schatten), wie ShadowMargin bei Widget Notes

const UNITS = { small: [2, 2], medium: [4, 2], large: [4, 4] };
const NOTE_UNITS = { Small: [2, 2], Large: [4, 4], Tall: [2, 4], Medium: [4, 2] };

const tileSize = ([w, h]) => ({ width: w * UNIT + (w - 1) * GAP, height: h * UNIT + (h - 1) * GAP });
const unitsOf = (size) => UNITS[size] ?? UNITS.medium;

const notesFile = () => path.join(app.getPath('appData'), 'WidgetNotes', 'notes.json');

function readNotes() {
  try {
    return JSON.parse(fs.readFileSync(notesFile(), 'utf8'));
  } catch {
    return [];
  }
}

/** Belegte Flächen: die Kacheln von Widget Notes (Position ohne Schattenrand, in DIP). */
function notesRects() {
  return readNotes()
    .filter((n) => typeof n.X === 'number' && typeof n.Y === 'number')
    .map((n) => {
      const u = n.W && n.H ? [n.W, n.H] : (NOTE_UNITS[n.Size] ?? NOTE_UNITS.Medium);
      const s = tileSize(u);
      return { x: n.X, y: n.Y, width: s.width, height: s.height };
    });
}

const intersects = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

function candidates(origin, min, max, length, magnets) {
  const last = max - length;
  const list = [min, last];
  for (let p = origin; p <= last + 0.5; p += STEP) list.push(p);
  for (const m of magnets) if (m >= min - 0.5 && m <= last + 0.5) list.push(m);
  return [...new Set(list.map((p) => Math.round(p)))];
}

/** Freien Rasterplatz nahe `desired` suchen (Port von GridLayout.FindSlot). */
function findSlot(desired, size) {
  const tile = tileSize(unitsOf(size));
  const display = screen.getDisplayNearestPoint({ x: Math.round(desired.x + tile.width / 2), y: Math.round(desired.y + tile.height / 2) });
  const wa = display.workArea;
  const area = { x: wa.x, y: wa.y, width: wa.width, height: wa.height };
  const others = notesRects().filter((o) => intersects(o, area));

  const xs = candidates(wa.x, wa.x, wa.x + wa.width, tile.width, others.flatMap((o) => [o.x + o.width + GAP, o.x - GAP - tile.width, o.x, o.x + o.width - tile.width]));
  const ys = candidates(wa.y, wa.y, wa.y + wa.height, tile.height, others.flatMap((o) => [o.y + o.height + GAP, o.y - GAP - tile.height, o.y, o.y + o.height - tile.height]));

  let best = null;
  let nearest = null;
  let bestD = Infinity;
  let nearestD = Infinity;
  for (const y of ys)
    for (const x of xs) {
      const d = (x - desired.x) ** 2 + (y - desired.y) ** 2;
      if (d < nearestD) {
        nearestD = d;
        nearest = { x, y };
      }
      if (d >= bestD) continue;
      const inner = { x: x + 2, y: y + 2, width: tile.width - 4, height: tile.height - 4 };
      if (others.some((o) => intersects(o, inner))) continue;
      bestD = d;
      best = { x, y };
    }
  return best ?? nearest ?? { x: wa.x, y: wa.y };
}

/** Standardplatz: oben rechts auf dem Hauptbildschirm (wie bei Widget Notes), freier Platz. */
function defaultSpot(size) {
  const wa = screen.getPrimaryDisplay().workArea;
  const tile = tileSize(unitsOf(size));
  return findSlot({ x: wa.x + wa.width - tile.width, y: wa.y }, size);
}

function isOnScreen(pos, size) {
  const tile = tileSize(unitsOf(size));
  const c = { x: pos.x + tile.width / 2, y: pos.y + tile.height / 2 };
  return screen.getAllDisplays().some(({ workArea: a }) => c.x >= a.x && c.x <= a.x + a.width && c.y >= a.y && c.y <= a.y + a.height);
}

// ---------- Farben aus Widget Notes ----------
const NOTE_THEMES = {
  graphite: { stops: ['#3A3A40', '#1C1C20'], accent: '#FFD60A' },
  midnight: { stops: ['#2A3B68', '#0D1427'], accent: '#64D2FF' },
  aurora: { stops: ['#5B2A86', '#B4446C', '#F08A5D'], accent: '#FFE29A' },
  ocean: { stops: ['#13A89E', '#0B4F6C'], accent: '#B5FFF4' },
  forest: { stops: ['#4A7C55', '#1B3024'], accent: '#B8F28C' },
  sunset: { stops: ['#FFC86B', '#FF7A59'], accent: '#7A2400' },
  lemon: { stops: ['#FFF4A8', '#FFDB45'], accent: '#946000' },
  paper: { stops: ['#FFFFFF', '#ECECF1'], accent: '#FF9F0A' },
};

/** Alle unterschiedlichen Stile der vorhandenen Notiz-Kacheln. */
function notesStyles() {
  const seen = new Map();
  for (const n of readNotes()) {
    const custom = n.Theme === 'custom' && n.CustomColor1 && n.CustomColor2 && n.CustomAccent;
    const t = custom ? { stops: [n.CustomColor1, n.CustomColor2], accent: n.CustomAccent } : (NOTE_THEMES[n.Theme] ?? NOTE_THEMES.graphite);
    const style = {
      stops: t.stops,
      accent: t.accent,
      opacity: typeof n.Opacity === 'number' ? n.Opacity : 1,
      radius: typeof n.Radius === 'number' ? n.Radius : 22,
      gloss: n.Gloss !== false,
      shadow: n.Shadow !== false,
      title: n.Title || (n.Kind === 'todo' ? 'To-do' : 'Notiz'),
    };
    const key = JSON.stringify([style.stops, style.accent, style.opacity, style.radius, style.gloss]);
    if (!seen.has(key)) seen.set(key, style);
  }
  return [...seen.values()];
}

// ---------- Fenster ----------
let widget = null;
let preview = null;
let snapping = false;

function windowBounds(pos, size) {
  const t = tileSize(unitsOf(size));
  return { x: Math.round(pos.x - MARGIN), y: Math.round(pos.y - MARGIN), width: t.width + MARGIN * 2, height: t.height + MARGIN * 2 };
}

function showPreview(pos, size) {
  const t = tileSize(unitsOf(size));
  const b = { x: Math.round(pos.x), y: Math.round(pos.y), width: t.width, height: t.height };
  if (!preview || preview.isDestroyed()) {
    preview = new BrowserWindow({
      ...b,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      resizable: false,
      focusable: false,
      skipTaskbar: true,
      hasShadow: false,
      show: false,
      webPreferences: { sandbox: true },
    });
    preview.setIgnoreMouseEvents(true);
    preview.loadURL(
      'data:text/html,' +
        encodeURIComponent(
          `<html style="background:transparent"><body style="margin:0;height:100vh;box-sizing:border-box;border:2px dashed rgba(255,255,255,.45);border-radius:${Math.min(40, t.height / 4)}px;background:rgba(255,255,255,.08)"></body></html>`,
        ),
    );
    preview.once('ready-to-show', () => {
      attachToDesktop(preview);
      preview.showInactive();
      sendToBottom(preview);
    });
  } else {
    preview.setBounds(b);
    if (!preview.isVisible()) preview.showInactive();
    sendToBottom(preview);
  }
}

function hidePreview() {
  if (preview && !preview.isDestroyed()) preview.hide();
}

function tilePosOfWindow() {
  const b = widget.getBounds();
  return { x: b.x + MARGIN, y: b.y + MARGIN };
}

function open({ url, preload, prefs, onMoved }) {
  currentSize = prefs.size in UNITS ? prefs.size : 'medium';
  let pos = typeof prefs.x === 'number' && typeof prefs.y === 'number' ? { x: prefs.x, y: prefs.y } : null;
  if (!pos || !isOnScreen(pos, prefs.size)) pos = defaultSpot(prefs.size);
  const bounds = windowBounds(pos, prefs.size);

  if (widget && !widget.isDestroyed()) {
    // Größe geändert → am aktuellen Platz neu einrasten
    const slot = findSlot(tilePosOfWindow(), prefs.size);
    snapping = true;
    widget.setBounds(windowBounds(slot, prefs.size));
    snapping = false;
    onMoved(slot);
    widget.webContents.send('widget:changed', prefs);
    return widget;
  }

  widget = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    show: false,
    title: 'Betterfy Widget',
    webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
  });

  widget.loadURL(url);
  widget.once('ready-to-show', () => {
    attachToDesktop(widget);
    widget.showInactive();
    sendToBottom(widget);
  });

  // Während des Ziehens: Vorschau des Rasterplatzes. Beim Loslassen: einrasten.
  widget.on('move', () => {
    if (snapping) return;
    const p = prefsSize();
    showPreview(findSlot(tilePosOfWindow(), p), p);
  });
  widget.on('moved', () => {
    if (snapping) return;
    const size = prefsSize();
    const slot = findSlot(tilePosOfWindow(), size);
    hidePreview();
    snapping = true;
    widget.setBounds(windowBounds(slot, size));
    setTimeout(() => (snapping = false), 50);
    sendToBottom(widget);
    onMoved(slot);
  });
  widget.on('closed', () => {
    widget = null;
    if (preview && !preview.isDestroyed()) preview.destroy();
    preview = null;
  });

  return widget;
}

let currentSize = 'medium';
const prefsSize = () => currentSize;

function setSize(size) {
  currentSize = size;
}

function close() {
  if (widget && !widget.isDestroyed()) widget.destroy();
  widget = null;
}

const get = () => (widget && !widget.isDestroyed() ? widget : null);

module.exports = { open, close, get, setSize, notesStyles, UNITS, tileSize, MARGIN };
