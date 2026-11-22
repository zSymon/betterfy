/** Zugriff auf die Electron-Brücke (im Mock-Modus durch Beispieldaten ersetzt). */
export const aura = (): Window['aura'] => (window as unknown as { __auraMock?: Window['aura'] }).__auraMock ?? window.aura;
