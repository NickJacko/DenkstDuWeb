// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  DIESE DATEI IST VOLLSTÄNDIG DEPRECATED UND WIRD NICHT MEHR VERWENDET  ⚠️
// ═══════════════════════════════════════════════════════════════════════════
//
// ❌ DIESE DATEI WURDE AUS SICHERHEITSGRÜNDEN DEAKTIVIERT
//
// Warum wurde diese Datei entfernt?
// ---------------------------------
// 1. SICHERHEIT (P0): API-Keys lagen unverschlüsselt im Client-Code
// 2. ARCHITEKTUR: Duplizierte Firebase-Initialisierung führte zu Konflikten
// 3. WARTBARKEIT: Legacy-Code ohne Error-Handling und moderne Best Practices
//
// ✅ Was du stattdessen verwenden solltest:
// -----------------------------------------
// → firebase-service.js (FirebaseGameService)
// → firebase-auth.js (FirebaseAuthService)
//
// Migration Guide:
// ----------------
// ALT (firebase-config.js):
//   initFirebase();
//   const manager = new FirebaseGameManager();
//   await manager.createGame(settings);
//
// NEU (firebase-service.js):
//   const service = await FirebaseGameService.initialize();
//   const gameId = await service.createGame(settings);
//
// ═══════════════════════════════════════════════════════════════════════════

// Verhindere versehentliche Verwendung
if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'firebaseGameManager', {
        get() {
            throw new Error(
                '❌ firebaseGameManager ist nicht mehr verfügbar!\n' +
                '✅ Verwende stattdessen: FirebaseGameService.getInstance()\n' +
                'Siehe: firebase-service.js'
            );
        },
        set() {
            throw new Error('❌ firebaseGameManager kann nicht gesetzt werden!');
        },
        configurable: false
    });

    // Blockiere auch die alten Funktionen
    window.initFirebase = function() {
        throw new Error(
            '❌ initFirebase() ist deprecated!\n' +
            '✅ Verwende: await FirebaseGameService.initialize()'
        );
    };

    // Blockiere Legacy-Klasse
    window.FirebaseGameManager = class {
        constructor() {
            throw new Error(
                '❌ FirebaseGameManager ist deprecated!\n' +
                '✅ Verwende: FirebaseGameService'
            );
        }
    };
}

// Logging für Entwickler (nur im Development-Mode)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.warn(
        '%c⚠️ DEPRECATION NOTICE',
        'background: #ff6b6b; color: white; font-weight: bold; padding: 10px; font-size: 14px;'
    );
    console.warn(
        '%cfirebase-config.js wurde permanent deaktiviert.\n' +
        'Verwende firebase-service.js für alle Firebase-Operationen.',
        'color: #ff6b6b; font-size: 12px;'
    );
    console.warn(
        '%cMigration:\n' +
        '→ FirebaseGameService für Multiplayer\n' +
        '→ FirebaseAuthService für Authentication',
        'color: #51cf66; font-size: 12px;'
    );
}

// Export leeres Objekt für bestehende Imports (Breaking Changes vermeiden)
export default null;