// Updates aus den GitHub-Releases: neuen Installer laden, still installieren, Betterfy neu starten.
const { app, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawn } = require('node:child_process');

const LATEST = 'https://api.github.com/repos/zSymon/betterfy/releases/latest';
const RELEASES_PAGE = 'https://github.com/zSymon/betterfy/releases/latest';

/** @type {{ state: 'idle'|'checking'|'none'|'available'|'downloading'|'installing'|'error', current: string, latest?: {version:string,url:string,size:number,notes:string,page:string}, progress?: number, error?: string, canInstall: boolean, checkedAt?: number }} */
let status = { state: 'idle', current: app.getVersion(), canInstall: app.isPackaged };
let onChange = () => {};

const parse = (v) => String(v).replace(/^v/i, '').split(/[.+-]/).slice(0, 3).map((n) => parseInt(n, 10) || 0);
function newer(a, b) {
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

function set(patch) {
  status = { ...status, ...patch };
  onChange(status);
  return status;
}

async function check() {
  if (status.state === 'downloading' || status.state === 'installing') return status;
  set({ state: 'checking', error: undefined });
  try {
    const res = await net.fetch(LATEST, { headers: { 'User-Agent': 'Betterfy-Updater', Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(`GitHub antwortet mit ${res.status}`);
    const rel = await res.json();
    const version = String(rel.tag_name || '').replace(/^v/i, '');
    const asset = (rel.assets || []).find((a) => /^Betterfy-Setup-.*\.exe$/i.test(a.name));
    if (!version || !asset || !newer(version, status.current)) return set({ state: 'none', latest: undefined, checkedAt: Date.now() });
    return set({
      state: 'available',
      checkedAt: Date.now(),
      latest: { version, url: asset.browser_download_url, size: asset.size, notes: String(rel.body || ''), page: rel.html_url || RELEASES_PAGE },
    });
  } catch (e) {
    return set({ state: 'error', error: e.message || String(e) });
  }
}

/** Installer laden und still installieren – der Installer startet Betterfy danach neu. */
async function install(quit) {
  if (!status.latest) await check();
  const latest = status.latest;
  if (!latest) return status;
  if (!app.isPackaged) return set({ state: 'error', error: 'Updates gehen nur in der installierten Version.' });

  set({ state: 'downloading', progress: 0, error: undefined });
  const target = path.join(os.tmpdir(), `Betterfy-Setup-${latest.version}.exe`);
  try {
    const res = await net.fetch(latest.url, { headers: { 'User-Agent': 'Betterfy-Updater' } });
    if (!res.ok || !res.body) throw new Error(`Download fehlgeschlagen (${res.status})`);
    const total = Number(res.headers.get('content-length')) || latest.size || 0;
    const out = fs.createWriteStream(target);
    const reader = res.body.getReader();
    let done = 0;
    let lastPct = -1;
    for (;;) {
      const { value, done: end } = await reader.read();
      if (end) break;
      done += value.length;
      if (!out.write(Buffer.from(value))) await new Promise((r) => out.once('drain', r));
      const pct = total ? Math.floor((done / total) * 100) : 0;
      if (pct !== lastPct) {
        lastPct = pct;
        set({ progress: pct });
      }
    }
    await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
    if (latest.size && fs.statSync(target).size !== latest.size) throw new Error('Download unvollständig.');
    const head = Buffer.alloc(2);
    const fd = fs.openSync(target, 'r');
    fs.readSync(fd, head, 0, 2, 0);
    fs.closeSync(fd);
    if (head.toString() !== 'MZ') throw new Error('Die heruntergeladene Datei ist kein gültiger Installer.');
  } catch (e) {
    return set({ state: 'error', error: e.message || String(e) });
  }

  set({ state: 'installing', progress: 100 });
  // NSIS (electron-builder): /S = still, --force-run = Betterfy danach starten
  spawn(target, ['/S', '--force-run'], { detached: true, stdio: 'ignore' }).unref();
  setTimeout(quit, 400);
  return status;
}

function start(listener) {
  onChange = listener;
  if (!app.isPackaged || process.env.AURA_SCREENSHOT) return;
  setTimeout(check, 15_000);
  setInterval(check, 6 * 60 * 60 * 1000);
}

module.exports = { start, check, install, get: () => status, RELEASES_PAGE };
