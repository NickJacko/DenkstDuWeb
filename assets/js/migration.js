// ===== NO-CAP LOCALSTORAGE MIGRATION =====
// Version: 1.0
// Migriert alte "denkstdu_*" Keys zu "nocap_*"
// Wird nur einmal beim ersten Laden ausgeführt

(function() {
    'use strict';

    console.log('🔄 Starting localStorage migration...');

    const migrations = [
        // Game State
        { old: 'denkstdu_game_state', new: 'nocap_game_state' },

        // Privacy & DSGVO
        { old: 'denkstdu_privacy_accepted', new: 'nocap_privacy_accepted' },
        { old: 'denkstdu_privacy_date', new: 'nocap_privacy_date' },
        { old: 'denkstdu_privacy_details', new: 'nocap_privacy_details' },
        { old: 'denkstdu_privacy_declined', new: 'nocap_privacy_declined' },
        { old: 'denkstdu_privacy_decline_date', new: 'nocap_privacy_decline_date' },

        // Age Verification
        { old: 'denkstdu_age_verification', new: 'nocap_age_verification' },
        { old: 'nocap_age_confirmed', new: 'nocap_age_verified' }, // Vereinheitlichen

        // User Auth (bereits nocap_* - nur zur Sicherheit)
        { old: 'nocap_user_auth', new: 'nocap_user_auth' }
    ];

    let migratedCount = 0;
    let skippedCount = 0;

    migrations.forEach(({ old, new: newKey }) => {
        // Skip wenn identisch
        if (old === newKey) {
            skippedCount++;
            return;
        }

        const oldData = localStorage.getItem(old);
        if (oldData) {
            try {
                // Setze neuen Key
                localStorage.setItem(newKey, oldData);

                // Lösche alten Key
                localStorage.removeItem(old);

                migratedCount++;
                console.log(`✅ Migrated: ${old} → ${newKey}`);
            } catch (error) {
                console.error(`❌ Migration failed for ${old}:`, error);
            }
        }
    });

    if (migratedCount > 0) {
        console.log(`✅ Migration complete: ${migratedCount} keys migrated`);

        // Setze Migration-Flag
        localStorage.setItem('nocap_migration_done', 'true');
        localStorage.setItem('nocap_migration_date', new Date().toISOString());
        localStorage.setItem('nocap_migration_version', '1.0');
    } else {
        console.log(`ℹ️ No migration needed (${skippedCount} keys already correct)`);
    }

})();