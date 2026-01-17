/**
 * Settings & DSGVO Functions
 * Version 1.0 - Firebase Cloud Functions Integration
 *
 * Features:
 * - User Settings Management
 * - Age Verification (FSK)
 * - DSGVO Data Export
 * - Account Deletion
 */

(function(window) {
    'use strict';

    const Logger = window.NocapUtils?.Logger || {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {}
    };


    // ===================================
    // GLOBAL STATE
    // ===================================

    const SettingsState = {
        currentUser: null,
        userFSKAccess: { fsk0: true, fsk16: false, fsk18: false },
        functionsInstance: null,
        eventCleanup: []
    };
    Object.seal(SettingsState);


    // ===================================
    // INIT
    // ===================================

    async function init() {
        Logger.info('🚀 Initializing Settings Module...');

        let instances;
        try {
            instances = window.FirebaseConfig.getFirebaseInstances();
        } catch (error) {
            Logger.error('❌ Failed to read Firebase instances:', error);
            return;
        }

        const { auth, functions } = instances;

        if (!functions) {
            Logger.error('❌ Firebase Functions not available (SDK missing or not initialized). Callable features disabled.');
            // Optional: return; wenn Settings ohne Functions keinen Sinn macht
            // return;
        } else {
            SettingsState.functionsInstance = functions;
            Logger.info('✅ Firebase Functions ready (via FirebaseConfig)');
        }
        if (!auth) {
            Logger.error('❌ Firebase Auth not available (SDK missing or not initialized).');
            return;
        }

        const unsub = auth.onAuthStateChanged(onAuthStateChanged);
        if (typeof unsub === 'function') SettingsState.eventCleanup.push(unsub);


        // Setup Event Listeners
        setupEventListeners();

        Logger.info('✅ Settings Module initialized');
    }

    // ===================================
    // AUTH STATE
    // ===================================

    function onAuthStateChanged(user) {
        SettingsState.currentUser = user;

        if (user) {
            Logger.info('✅ User logged in:', user.uid);
            showUserMenu();
            loadUserData();
        } else {
            Logger.info('ℹ️ No user logged in');
            hideUserMenu();
        }
    }

    function showUserMenu() {
        const userMenuContainer = document.getElementById('user-menu-container');
        if (userMenuContainer) {
            window.NocapUtils?.showElement
                ? window.NocapUtils.showElement(userMenuContainer, 'flex')
                : userMenuContainer.classList.remove('hidden');
        }
    }

    function hideUserMenu() {
        const userMenuContainer = document.getElementById('user-menu-container');
        if (userMenuContainer) {
            window.NocapUtils?.hideElement
                ? window.NocapUtils.hideElement(userMenuContainer)
                : userMenuContainer.classList.add('hidden');
        }
    }
    async function loadUserData() {
        if (!SettingsState.currentUser) return;

        try {
            const displayName = SettingsState.currentUser.displayName || 'Gast';
            updateDisplayName(displayName);

            await SettingsState.currentUser.getIdToken(true);
            const tokenResult = await SettingsState.currentUser.getIdTokenResult();


            SettingsState.userFSKAccess = {
                fsk0: true,
                fsk16: tokenResult?.claims?.fsk16 === true,
                fsk18: tokenResult?.claims?.fsk18 === true
            };

            updateFSKBadges(SettingsState.userFSKAccess);

            await checkScheduledDeletion();

        } catch (error) {
            Logger.error('❌ Error loading user data:', error);
        }
    }


    /**
     * ✅ NEW: Check if user has scheduled deletion
     */
    async function checkScheduledDeletion() {
        if (!SettingsState.currentUser) return;

        try {
            const { database } = window.FirebaseConfig.getFirebaseInstances();
            const deletionRef = database.ref(`deletionRequests/${SettingsState.currentUser.uid}`);
            const snapshot = await deletionRef.once('value');

            if (snapshot.exists()) {
                const request = snapshot.val();
                if (request?.status === 'scheduled') showCancellationOption(request);
                else hideCancellationOption();
            } else {
                hideCancellationOption();
            }
        } catch (error) {
            Logger.error('Error checking scheduled deletion:', error);
        }
    }


    function showCancellationOption(request) {
        const cancelContainer = document.getElementById('cancel-deletion-container');
        const deleteContainer = document.getElementById('delete-account-container');
        const scheduledDateEl = document.getElementById('deletion-scheduled-date');

        if (cancelContainer) {
            window.NocapUtils?.showElement
                ? window.NocapUtils.showElement(cancelContainer, 'block')
                : cancelContainer.classList.remove('hidden');
        }

        if (deleteContainer) {
            window.NocapUtils?.hideElement
                ? window.NocapUtils.hideElement(deleteContainer)
                : deleteContainer.classList.add('hidden');
        }

        if (scheduledDateEl && request.scheduledFor) {
            const date = new Date(request.scheduledFor);
            scheduledDateEl.textContent = `Geplant für: ${date.toLocaleString('de-DE')}`;
        }
    }

    function hideCancellationOption() {
        const cancelContainer = document.getElementById('cancel-deletion-container');
        const deleteContainer = document.getElementById('delete-account-container');

        if (cancelContainer) {
            window.NocapUtils?.hideElement
                ? window.NocapUtils.hideElement(cancelContainer)
                : cancelContainer.classList.add('hidden');
        }

        if (deleteContainer) {
            window.NocapUtils?.showElement
                ? window.NocapUtils.showElement(deleteContainer, 'block')
                : deleteContainer.classList.remove('hidden');
        }

    }

    function updateDisplayName(name) {
        const displayNameEl = document.getElementById('user-display-name');
        const displayNameInput = document.getElementById('display-name-input');

        if (displayNameEl) {
            displayNameEl.textContent = name;
        }

        if (displayNameInput) {
            displayNameInput.value = name;
        }
    }

    function updateFSKBadges(fskAccess) {
        // Header badges
        const fsk16Badge = document.getElementById('fsk16-badge');
        const fsk18Badge = document.getElementById('fsk18-badge');

        if (fsk16Badge) {
            if (fskAccess.fsk16) {
                window.NocapUtils?.showElement
                    ? window.NocapUtils.showElement(fsk16Badge, 'inline-block')
                    : fsk16Badge.classList.remove('hidden');
            } else {
                window.NocapUtils?.hideElement
                    ? window.NocapUtils.hideElement(fsk16Badge)
                    : fsk16Badge.classList.add('hidden');
            }
        }

        if (fsk18Badge) {
            if (fskAccess.fsk18) {
                window.NocapUtils?.showElement
                    ? window.NocapUtils.showElement(fsk18Badge, 'inline-block')
                    : fsk18Badge.classList.remove('hidden');
            } else {
                window.NocapUtils?.hideElement
                    ? window.NocapUtils.hideElement(fsk18Badge)
                    : fsk18Badge.classList.add('hidden');
            }
        }


        // Settings badges
        const fsk16BadgeSettings = document.getElementById('fsk16-badge-settings');
        const fsk18BadgeSettings = document.getElementById('fsk18-badge-settings');

        if (fsk16BadgeSettings) {
            if (fskAccess.fsk16) {
                window.NocapUtils?.showElement
                    ? window.NocapUtils.showElement(fsk16BadgeSettings, 'inline-block')
                    : fsk16BadgeSettings.classList.remove('hidden');
            } else {
                window.NocapUtils?.hideElement
                    ? window.NocapUtils.hideElement(fsk16BadgeSettings)
                    : fsk16BadgeSettings.classList.add('hidden');
            }
        }

        if (fsk18BadgeSettings) {
            if (fskAccess.fsk18) {
                window.NocapUtils?.showElement
                    ? window.NocapUtils.showElement(fsk18BadgeSettings, 'inline-block')
                    : fsk18BadgeSettings.classList.remove('hidden');
            } else {
                window.NocapUtils?.hideElement
                    ? window.NocapUtils.hideElement(fsk18BadgeSettings)
                    : fsk18BadgeSettings.classList.add('hidden');
            }
        }

    }

    // ===================================
    // EVENT LISTENERS
    // ===================================
    function addTrackedListener(el, type, fn, opts) {
        if (!el) return;
        el.addEventListener(type, fn, opts);
        SettingsState.eventCleanup.push(() => {
            try { el.removeEventListener(type, fn, opts); } catch (_) {}
        });
    }
    function setupEventListeners() {
        const fskWarningModal = document.getElementById('fsk-warning-modal');
        // Settings Button
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            addTrackedListener(settingsBtn, 'click', openSettings);
        }

        // Close Settings
        const closeBtn = document.getElementById('settings-close-btn');
        if (closeBtn) {
            addTrackedListener(closeBtn, 'click', closeSettings);
        }

        // Save Display Name
        const saveNameBtn = document.getElementById('save-display-name-btn');
        if (saveNameBtn) {
            addTrackedListener(saveNameBtn, 'click', saveDisplayName);
        }

        // Verify Age
        const verifyAgeBtn = document.getElementById('verify-age-btn');
        if (verifyAgeBtn) {
            addTrackedListener(verifyAgeBtn, 'click', verifyAge);
        }

        // Export Data
        const exportBtn = document.getElementById('export-data-btn');
        if (exportBtn) {
            addTrackedListener(exportBtn, 'click', exportMyData)
        }

        // Delete Account
        const deleteBtn = document.getElementById('delete-account-btn');
        if (deleteBtn) {
            addTrackedListener(deleteBtn, 'click', showDeleteAccountDialog);
        }

        // Cancel Deletion
        const cancelDeletionBtn = document.getElementById('cancel-deletion-btn');
        if (cancelDeletionBtn) {
            addTrackedListener(cancelDeletionBtn, 'click', cancelAccountDeletion);
        }

        // FSK Warning Modal
        const closeFSKModalBtn = document.getElementById('close-fsk-modal-btn');
        if (closeFSKModalBtn) {
            addTrackedListener(closeFSKModalBtn, 'click', closeFSKModal);
        }

        const gotoAgeVerificationBtn = document.getElementById('goto-age-verification-btn');
        if (gotoAgeVerificationBtn) {
            addTrackedListener(gotoAgeVerificationBtn, 'click', goToAgeVerification);
        }

        // Close modal on outside click
        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal) {
            addTrackedListener(settingsModal, 'click', (e) => {
                if (e.target === settingsModal) closeSettings();
            });
        }
        if (fskWarningModal) {
            addTrackedListener(fskWarningModal, 'click', (e) => {
                if (e.target === fskWarningModal) closeFSKModal();
            });
        }
    }

    // ===================================
    // SETTINGS MODAL
    // ===================================

    function openSettings() {
        const modal = document.getElementById('settings-modal');
        if (!modal) return;

        // sichtbar machen
        modal.classList.remove('hidden');
        modal.classList.add('d-flex');
        modal.setAttribute('aria-hidden', 'false');

        document.body.classList.add('modal-open');
    }

    function closeSettings() {
        const modal = document.getElementById('settings-modal');
        if (!modal) return;

        modal.setAttribute('aria-hidden', 'true');
        modal.classList.add('hidden');
        modal.classList.remove('d-flex');

        document.body.classList.remove('modal-open');
    }

    // ===================================
    // DISPLAY NAME
    // ===================================

    async function saveDisplayName() {
        if (!SettingsState.currentUser) {
            showError('Bitte melde dich an');
            return;
        }

        const input = document.getElementById('display-name-input');
        const newName = input.value.trim();

        if (!newName || newName.length < 2) {
            showError('Name muss mindestens 2 Zeichen lang sein');
            return;
        }

        const btn = document.getElementById('save-display-name-btn');
        setButtonLoading(btn, true);

        try {
            await SettingsState.currentUser.updateProfile({
                displayName: newName
            });

            updateDisplayName(newName);
            showSuccess('Name gespeichert!');

            Logger.info('✅ Display name updated:', newName);

        } catch (error) {
            Logger.error('❌ Error saving display name:', error);
            showError('Fehler beim Speichern');
        } finally {
            setButtonLoading(btn, false);
        }
    }

    // ===================================
    // AGE VERIFICATION
    // ===================================

    function calculateAge(birthdate) {
        const today = new Date();
        const birth = new Date(birthdate);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }

        return age;
    }

    async function verifyAge() {
        if (!SettingsState.currentUser) {
            showError('Bitte melde dich an');
            return;
        }

        const input = document.getElementById('birthdate-input');
        const birthdate = input.value;

        if (!birthdate) {
            showError('Bitte gib dein Geburtsdatum ein');
            return;
        }

        const age = calculateAge(birthdate);
        if (age < 0 || age > 120) {
            showError('Ungültiges Geburtsdatum');
            return;
        }
        const ageLevel = age >= 18 ? 18 : (age >= 16 ? 16 : 0);


        const btn = document.getElementById('verify-age-btn');
        setButtonLoading(btn, true);

        try {
            if (!SettingsState.functionsInstance) {
                throw new Error('Functions not initialized');
            }

            const setAge = SettingsState.functionsInstance.httpsCallable('setAgeVerification');
            const result = await setAge({
                ageLevel: ageLevel,
                verificationMethod: 'birthdate-self-declaration'
            });

            Logger.info('✅ Age verified:', result.data);
            // Optional: sofortiges UI-Update aus Response (falls Claims minimal verzögert)
            if (result?.data?.fskAccess) {
                SettingsState.userFSKAccess = result.data.fskAccess;
                updateFSKBadges(SettingsState.userFSKAccess);
            }

// ✅ Lokaler Cache für andere Seiten (Settings-only read path)
            const ts = Date.now();

            if (window.NocapUtils && window.NocapUtils.setLocalStorage) {
                window.NocapUtils.setLocalStorage('nocap_age_level', String(ageLevel));
                window.NocapUtils.setLocalStorage('nocap_is_adult', String(ageLevel >= 18));
                window.NocapUtils.setLocalStorage('nocap_age_verification', 'true');

                // ✅ wichtig: Timestamp (damit Seiten nicht “komisch” erneut fragen)
                window.NocapUtils.setLocalStorage('nocap_age_verification_ts', String(ts));
            } else {
                localStorage.setItem('nocap_age_level', String(ageLevel));
                localStorage.setItem('nocap_is_adult', String(ageLevel >= 18));
                localStorage.setItem('nocap_age_verification', 'true');

                // ✅ wichtig: Timestamp (damit Seiten nicht “komisch” erneut fragen)
                localStorage.setItem('nocap_age_verification_ts', String(ts));
            }



            // ✅ Force Token Refresh (Custom Claims werden erst danach sicher sichtbar)
            await SettingsState.currentUser.getIdToken(true);
            const refreshed = await SettingsState.currentUser.getIdTokenResult();

            // ✅ Claims sind Source of Truth
            SettingsState.userFSKAccess = {
                fsk0: true,
                fsk16: refreshed?.claims?.fsk16 === true,
                fsk18: refreshed?.claims?.fsk18 === true
            };
            updateFSKBadges(SettingsState.userFSKAccess);

            showSuccess('Altersverifikation erfolgreich!');
            // ✅ UI: Modals sauber schließen (sonst bleibt schwarzer Screen / Overlay hängen)
            closeFSKModal();   // falls das FSK-Modal offen war
            closeSettings();   // Settings modal schließen

// ✅ UX: anderen Seiten sagen “Alter ist jetzt verifiziert”
// (damit category-selection den Klick automatisch fortsetzen kann)
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('nocap:age-verified', {
                    detail: { ageLevel }
                }));
            }, 0);


        } catch (error) {
            Logger.error('❌ Error verifying age:', error);
            handleFunctionError(error);
        } finally {
            setButtonLoading(btn, false);
        }
    }

    // ===================================
    // FSK VALIDATION
    // ===================================

    async function validateFSKAccess(category) {
        if (!SettingsState.currentUser) {
            showError('Bitte melde dich an');
            return false;
        }

        if (!category || typeof category !== 'string') {
            showError('Ungültige Kategorie');
            return false;
        }

        try {
            if (!SettingsState.functionsInstance) {
                throw new Error('Functions not initialized');
            }

            // ✅ CALLABLE statt fetch => kein CORS Preflight
            const validate = SettingsState.functionsInstance.httpsCallable('validateFSKAccessCallable');
            const result = await validate({ category });

            const allowed = Boolean(result?.data?.allowed);
            const message = result?.data?.message;

            if (allowed) {
                Logger.info('✅ FSK Access granted (callable):', category);
                return true;
            }

            Logger.warn('❌ FSK Access denied (callable):', message || 'Zugriff verweigert');
            showFSKError(category, message);
            return false;

        } catch (error) {
            Logger.error('FSK validation error:', error);
            showError('Fehler bei der Altersverifikation');
            return false;
        }
    }

    function showFSKError(fskLevel, message) {
        const messages = {
            'fsk16': 'Dieser Inhalt ist ab 16 Jahren freigegeben.',
            'fsk18': 'Dieser Inhalt ist ab 18 Jahren freigegeben.'
        };

        const modal = document.getElementById('fsk-warning-modal');
        const messageEl = document.getElementById('fsk-message');

        if (messageEl) {
            messageEl.textContent = message || messages[fskLevel] || 'Altersbeschränkung aktiv';
        }

        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('d-flex');
            modal.setAttribute('aria-hidden', 'false');
        }
    }

    function closeFSKModal() {
        const modal = document.getElementById('fsk-warning-modal');
        if (!modal) return;

        modal.setAttribute('aria-hidden', 'true');
        modal.classList.add('hidden');
        modal.classList.remove('d-flex');
    }

    function goToAgeVerification() {
        closeFSKModal();
        openSettings();

        // Scroll to age verification section
        setTimeout(() => {
            const birthdateInput = document.getElementById('birthdate-input');
            if (birthdateInput) {
                birthdateInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                birthdateInput.focus();
            }
        }, 300);
    }

    // ===================================
    // DATA EXPORT (DSGVO)
    // ===================================

    async function exportMyData() {
        if (!SettingsState.currentUser) {
            showError('Bitte melde dich an');
            return;
        }

        const btn = document.getElementById('export-data-btn');
        setButtonLoading(btn, true);

        try {
            Logger.info('📥 Exporting user data...');

            // ✅ FIX: Use regionalized Functions instance
            if (!SettingsState.functionsInstance) {
                throw new Error('Functions not initialized');
            }

            const exportData = SettingsState.functionsInstance.httpsCallable('exportUserData');
            const result = await exportData();

            Logger.info('Export completed:', result.data);

            // Download als JSON
            const dataStr = JSON.stringify(result.data, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `denkstduweb-daten-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showSuccess('✅ Daten erfolgreich exportiert!');

        } catch (error) {
            Logger.error('Export error:', error);
            handleFunctionError(error);
        } finally {
            setButtonLoading(btn, false);
        }
    }

    // ===================================
    // ACCOUNT DELETION (DSGVO)
    // ===================================

    async function showDeleteAccountDialog() {
        const confirmed = confirm(
            '⚠️ WARNUNG: Dies plant die Löschung Ihres Accounts!\n\n' +
            '✅ Sie haben 48 Stunden Zeit, um die Löschung abzubrechen.\n\n' +
            'Möchten Sie fortfahren?'
        );

        if (!confirmed) return;

        const doubleConfirm = prompt(
            'Bitte geben Sie zur Bestätigung "LÖSCHEN" ein:'
        );

        if (doubleConfirm !== 'LÖSCHEN') {
            showError('Löschung abgebrochen');
            return;
        }

        await scheduleAccountDeletion();
    }

    async function scheduleAccountDeletion() {
        if (!SettingsState.currentUser) {
            showError('Bitte melde dich an');
            return;
        }

        const btn = document.getElementById('delete-account-btn');
        setButtonLoading(btn, true);

        try {
            Logger.info('🗑️ Scheduling account deletion...');

            // ✅ FIX: Use regionalized Functions instance
            if (!SettingsState.functionsInstance) {
                throw new Error('Functions not initialized');
            }

            // ✅ NEW: Use scheduleAccountDeletion with 48h grace period
            const scheduleDelete = SettingsState.functionsInstance.httpsCallable('scheduleAccountDeletion');
            const result = await scheduleDelete({
                confirmation: 'DELETE_MY_ACCOUNT'
            });

            Logger.info('✅ Account deletion scheduled:', result.data);

            // Show info about grace period
            const scheduledDate = new Date(result.data.scheduledFor);
            const message =
                `✅ Account-Löschung wurde geplant!\n\n` +
                `📅 Geplant für: ${scheduledDate.toLocaleString('de-DE')}\n\n` +
                `⏰ Sie haben ${result.data.gracePeriodHours} Stunden Zeit, um die Löschung abzubrechen.\n\n` +
                `📧 Sie erhalten eine E-Mail mit weiteren Informationen.`;

            alert(message);

            // Reload user data to show cancellation option
            await checkScheduledDeletion();

        } catch (error) {
            Logger.error('Account deletion scheduling error:', error);
            handleFunctionError(error);
        } finally {
            setButtonLoading(btn, false);
        }
    }

    /**
     * ✅ NEW: Cancel scheduled account deletion
     */
    async function cancelAccountDeletion() {
        const confirmed = confirm(
            '✅ Möchten Sie die Account-Löschung wirklich abbrechen?\n\n' +
            'Ihr Account bleibt dann erhalten.'
        );

        if (!confirmed) return;

        const btn = document.getElementById('cancel-deletion-btn');
        setButtonLoading(btn, true);

        try {
            Logger.info('↩️ Cancelling account deletion...');

            // ✅ FIX: Use regionalized Functions instance
            if (!SettingsState.functionsInstance) {
                throw new Error('Functions not initialized');
            }

            const cancelDelete = SettingsState.functionsInstance.httpsCallable('cancelAccountDeletion');
            const result = await cancelDelete();

            Logger.info('✅ Deletion cancelled:', result.data);

            showSuccess('✅ Account-Löschung wurde abgebrochen!\n\nIhr Account bleibt erhalten.');

            // Hide cancellation option
            hideCancellationOption();

        } catch (error) {
            Logger.error('Cancel deletion error:', error);
            handleFunctionError(error);
        } finally {
            setButtonLoading(btn, false);
        }
    }

    // ===================================
    // ERROR HANDLING
    // ===================================

    function handleFunctionError(error) {
        Logger.error('Cloud Function Error:', error);

        const errorMessages = {
            'unauthenticated': 'Bitte melden Sie sich an.',
            'permission-denied': 'Keine Berechtigung für diese Aktion.',
            'invalid-argument': 'Ungültige Eingabe.',
            'failed-precondition': 'Vorbedingung nicht erfüllt.',
            'resource-exhausted': 'Zu viele Anfragen. Bitte warten Sie.',
            'internal': 'Serverfehler. Bitte versuchen Sie es später erneut.'
        };

        const message = errorMessages[error.code] || 'Ein Fehler ist aufgetreten.';
        showError(message);

        return message;
    }

    // ===================================
    // UI HELPERS
    // ===================================

    function showSuccess(message) {
        // Simple alert for now - can be replaced with toast notification
        alert('✅ ' + message);
    }

    function showError(message) {
        // Simple alert for now - can be replaced with toast notification
        alert('❌ ' + message);
    }

    function setButtonLoading(button, isLoading) {
        if (!button) return;

        if (isLoading) {
            button.classList.add('btn-loading');
            button.disabled = true;
        } else {
            button.classList.remove('btn-loading');
            button.disabled = false;
        }
    }

    // ===================================
    // PUBLIC API
    // ===================================
    function cleanup() {
        SettingsState.eventCleanup.forEach(fn => { try { fn(); } catch(_) {} });
        SettingsState.eventCleanup = [];
    }
    window.addEventListener('beforeunload', cleanup);

    window.SettingsModule = Object.freeze({
        validateFSKAccess,
        showFSKError,
        updateFSKBadges
    });

    (async function boot() {
        try {
            if (!window.FirebaseConfig?.isInitialized?.()) {
                await window.FirebaseConfig.initialize();
            }
            await window.FirebaseConfig.waitForFirebase(10000);
            await init();
        } catch (e) {
            Logger.error('❌ Settings boot failed (Firebase not ready):', e);
        }
    })();

})(window);

