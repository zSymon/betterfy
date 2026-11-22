<p align="center">
  <img src="build/icon.png" width="96" alt="Betterfy" />
</p>

<h1 align="center">Betterfy</h1>

<p align="center">Ein cleaner, futuristischer Desktop-Client für Spotify – mit Songtexten, Design-Tab und Desktop-Widget.</p>

---

## Download

**[⬇ Betterfy-Setup herunterladen](https://github.com/zSymon/betterfy/releases/latest)**

Starten, fertig: Betterfy installiert sich für deinen Benutzer, legt Verknüpfungen auf dem Desktop und im Startmenü an und startet direkt. Zum **Anheften an die Taskleiste**: Rechtsklick auf das Betterfy-Symbol in der Taskleiste → *An Taskleiste anheften*.

> Beim ersten Start kann Windows SmartScreen warnen („Der Computer wurde durch Windows geschützt“), weil die App nicht mit einem Microsoft-Zertifikat signiert ist. Dann auf **Weitere Informationen → Trotzdem ausführen** klicken.

**Voraussetzungen:** Windows 10/11 (64 Bit) und **Spotify Premium**.

## Einrichtung (einmalig, ca. 2 Minuten)

Spotify verlangt für eigene Apps eine **Client ID**. Du hast zwei Möglichkeiten:

**A) Eigene Client ID (empfohlen)**

1. Im [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) einloggen → **Create app**
2. Name und Beschreibung beliebig, Redirect URI: `http://127.0.0.1:8888/callback` (auf **Add** klicken!)
3. **Web API** und **Web Playback SDK** anhaken, Bedingungen akzeptieren, speichern
4. Die **Client ID** kopieren und beim Start von Betterfy einfügen → *Mit Spotify anmelden*

**B) Client ID von einem Freund**

Wer schon eine App hat, kann dich im Dashboard unter *User Management* mit deiner Spotify-E-Mail eintragen (max. 5 Personen) und dir seine Client ID geben.

## Funktionen

- **Eigenes Design** – Glas-Panels, Farben passen sich live dem Album-Cover an
- **Design-Tab** – Presets (Aurora, Neon, Mono, Bloom), Akzentfarbe, Hintergründe (Aurora, Mesh, Grid, Minimal), Glas, Unschärfe, Ecken, Schrift, Glow, Layout
- **Synchrone Songtexte** – mitlaufend, Klick auf eine Zeile springt dorthin; Großansicht mit <kbd>Strg</kbd>+<kbd>L</kbd>
- **Desktop-Widget** – Mini-Player als Kachel auf dem Desktop (bleibt bei <kbd>Win</kbd>+<kbd>D</kbd> sichtbar), rastet im Raster von [Widget Notes](https://github.com/zSymon/widget-notes) ein und übernimmt per Pipette dessen Farben
- **Bibliothek, Suche, Warteschlange, Geräte** – inklusive Spotify Connect: steuert auch Handy, Lautsprecher oder die offizielle App
- **Medientasten** – Play/Pause, Vor und Zurück auf der Tastatur steuern Betterfy (auch wenn die Musik auf Handy oder Lautsprecher läuft); Song und Cover erscheinen im Windows-Lautstärke-Overlay
- **Updates per Klick** – neue Versionen werden automatisch erkannt, oben rechts erscheint *Update*; installiert sich still und startet neu
- **Tray** – läuft bei aktivem Widget im Hintergrund weiter, optional mit Windows starten

## Tastenkürzel

| Taste | Aktion |
| --- | --- |
| <kbd>Leertaste</kbd> | Play / Pause |
| <kbd>Strg</kbd> + <kbd>←</kbd>/<kbd>→</kbd> | Vorheriger / nächster Song |
| <kbd>Strg</kbd> + <kbd>↑</kbd>/<kbd>↓</kbd> | Lauter / leiser |
| <kbd>Strg</kbd> + <kbd>K</kbd> | Suche |
| <kbd>Strg</kbd> + <kbd>L</kbd> | Großansicht mit Songtext |
| <kbd>Alt</kbd> + <kbd>←</kbd>/<kbd>→</kbd>, Maus-Seitentasten | Zurück / Vor |
| Medientasten ⏯ ⏭ ⏮ | Play/Pause, nächster / vorheriger Song |

## Gut zu wissen

- Spotify erlaubt eigenen Apps seit 2026 nur noch, die Songs **eigener** Playlists aufzulisten. Gefolgte Playlists lassen sich trotzdem abspielen.
- Songtexte kommen von [LRCLIB](https://lrclib.net).
- Login-Daten werden lokal und verschlüsselt gespeichert (`%APPDATA%\Betterfy`).
- Betterfy ist ein inoffizielles Projekt und steht in keiner Verbindung zu Spotify.

---

## Entwicklung

```sh
npm install
npm run dev        # Entwicklung mit Hot Reload
npm run dist       # Installer bauen → release/
```

Betterfy nutzt [castLabs Electron](https://github.com/castlabs/electron-releases) mit Widevine. Damit Spotify die Songs freigibt, muss die App **VMP-signiert** sein – sonst spielt sie nur ~10 Sekunden. `npm run dist` signiert automatisch (Hook `scripts/after-sign.cjs`); dafür einmalig ein kostenloses [castLabs-EVS](https://github.com/castlabs/electron-releases/wiki/EVS)-Konto anlegen:

```sh
python -m pip install --upgrade castlabs-evs
python -m castlabs_evs.account signup
npm run sign       # signiert node_modules/electron/dist für npm run dev
```

| Ordner | Inhalt |
| --- | --- |
| `electron/` | Hauptprozess: Fenster, OAuth (PKCE), Token-Speicher, Widevine, Tray, Desktop-Widget |
| `src/state/` | Player (Web Playback SDK + Spotify Connect), Navigation, Design-Einstellungen |
| `src/components/`, `src/views/` | Oberfläche |
| `src/widget/` | Desktop-Widget |
| `src/dev/mock.ts` | Beispieldaten für Layout-Tests ohne Login |
