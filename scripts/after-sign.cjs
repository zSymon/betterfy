// electron-builder afterSign-Hook: signiert die gepackte App per castLabs EVS (VMP) – NACH dem Setzen von Icon/Versionsinfo,
// sonst wird die Signatur ungültig. Läuft vor dem Bau des Installers. Ohne VMP-Signatur spielt Spotify nur ~10 Sekunden.
const { execFileSync } = require('node:child_process');

exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== 'win32') return;
  console.log(`  • VMP-Signatur (castLabs EVS) für ${context.appOutDir}`);
  try {
    execFileSync('python', ['-m', 'castlabs_evs.vmp', 'sign-pkg', context.appOutDir], { stdio: 'inherit' });
  } catch (e) {
    throw new Error(
      'VMP-Signierung fehlgeschlagen. Ist castlabs-evs installiert und ein Konto angelegt?\n' +
        '  python -m pip install --upgrade castlabs-evs\n  python -m castlabs_evs.account signup\n' +
        e.message,
    );
  }
};
