/**
 * Settings & DSGVO Functions
 * Version 2.0 - FSK18 Server-Side Validation
 *
 * ✅ FSK0 & FSK16: Always available (no verification needed)
 * ✅ FSK18: Only after server-side age verification
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
        userFSKAccess: { fsk0: true, fsk16: true, fsk18: false }, // ✅ FSK0 & FSK16 always true
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
            Logger.error('❌ Firebase Functions not available.');
            return;
        } else {
            SettingsState.functionsInstance = functions;
            Logger.info('✅ Firebase Functions ready');
        }

        if (!auth) {
            Logger.error('❌ Firebase Auth not available.');
            return;
        }

        const unsub = auth.onAuthStateChanged(onAuthStateChanged);
        if (typeof unsub === 'function') SettingsState.eventCleanup.push(unsub);

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
            // ✅ Reset FSK access when logged out
            SettingsState.userFSKAccess = { fsk0: true, fsk16: true, fsk18: false };
            updateFSKBadges(SettingsState.userFSKAccess);
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

            // ✅ Force token refresh to get latest Custom Claims
            await SettingsState.currentUser.getIdToken(true);
            const tokenResult = await SettingsState.currentUser.getIdTokenResult();

            // ✅ Check FSK18 Custom Claim
            const hasFSK18Claim = tokenResult?.claims?.fsk18 === true;

            // ✅ FSK0 & FSK16 always available
            SettingsState.userFSKAccess = {
                fsk0: true,
                fsk16: true,
                fsk18: hasFSK18Claim
            };

            Logger.info('✅ FSK Access loaded:', SettingsState.userFSKAccess);

            // ✅ If anonymous user without FSK18 claim -> try to grant
            if (!SettingsState.currentUser.isAnonymous && !hasFSK18Claim) {
                Logger.info('🔄 Non-anonymous user without FSK18 claim, attempting auto-grant...');

                try {
                    if (SettingsState.functionsInstance) {
                        const grantFSK18 = SettingsState.functionsInstance.httpsCallable('grantFSK18Access');
                        const result = await grantFSK18();

                        if (result?.data?.success) {
                            // ✅ Refresh token to get new Custom Claim
                            await SettingsState.currentUser.getIdToken(true);
                            const refreshed = await SettingsState.currentUser.getIdTokenResult();

                            SettingsState.userFSKAccess.fsk18 = refreshed?.claims?.fsk18 === true;

                            Logger.info('✅ FSK18 auto-granted:', SettingsState.userFSKAccess.fsk18);
                        }
                    }
                } catch (error) {
                    // ✅ Non-fatal: User can manually request FSK18 later
                    Logger.warn('⚠️ FSK18 auto-grant failed (non-fatal):', error.message);
                }
            }

            updateFSKBadges(SettingsState.userFSKAccess);
            syncFSKToLocalStorage(SettingsState.userFSKAccess);

            await checkScheduledDeletion();

        } catch (error) {
            Logger.error('❌ Error loading user data:', error);
        }
    }
    /**
     * ✅ Sync FSK access to localStorage (read-only cache)
     */
    function syncFSKToLocalStorage(fskAccess) {
        const ts = Date.now();

        if (window.NocapUtils && window.NocapUtils.setLocalStorage) {
            window.NocapUtils.setLocalStorage('nocap_fsk18_verified', String(fskAccess.fsk18));
            window.NocapUtils.setLocalStorage('nocap_fsk_sync_ts', String(ts));
        } else {
            localStorage.setItem('nocap_fsk18_verified', String(fskAccess.fsk18));
            localStorage.setItem('nocap_fsk_sync_ts', String(ts));
        }
    }

    /**
     * ✅ Check if user has scheduled deletion
     */
    async function checkScheduledDeletion() {
        if (!SettingsState.currentUser) return;

        try {
            const { database } = window.FirebaseConfig.getFirebaseInstances();
            const deletionRef = database.ref(`deletionRequests/${SettingsState.currentUser.uid}`);
            const snapshot = await deletionRef.once('value');

            if (snapshot.exists()) {
                const request = snapshot.val();
                if (request?.status === 'scheduled') {
                    showCancellationOption(request);
                } else {
                    hideCancellationOption();
                }
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
        // ✅ Only show FSK18 badge (FSK0 & FSK16 are default)
        const fsk18Badge = document.getElementById('fsk18-badge');
        const fsk18BadgeSettings = document.getElementById('fsk18-badge-settings');

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

        // ✅ Remove FSK16 badges (no longer needed)
        const fsk16Badge = document.getElementById('fsk16-badge');
        const fsk16BadgeSettings = document.getElementById('fsk16-badge-settings');

        if (fsk16Badge) {
            window.NocapUtils?.hideElement
                ? window.NocapUtils.hideElement(fsk16Badge)
                : fsk16Badge.classList.add('hidden');
        }

        if (fsk16BadgeSettings) {
            window.NocapUtils?.hideElement
                ? window.NocapUtils.hideElement(fsk16BadgeSettings)
                : fsk16BadgeSettings.classList.add('hidden');
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

        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            addTrackedListener(settingsBtn, 'click', openSettings);
        }

        const closeBtn = document.getElementById('settings-close-btn');
        if (closeBtn) {
            addTrackedListener(closeBtn, 'click', closeSettings);
        }

        const saveNameBtn = document.getElementById('save-display-name-btn');
        if (saveNameBtn) {
            addTrackedListener(saveNameBtn, 'click', saveDisplayName);
        }

        const verifyAgeBtn = document.getElementById('verify-age-btn');
        if (verifyAgeBtn) {
            addTrackedListener(verifyAgeBtn, 'click', verifyAge);
        }

        const exportBtn = document.getElementById('export-data-btn');
        if (exportBtn) {
            addTrackedListener(exportBtn, 'click', exportMyData);
        }

        const deleteBtn = document.getElementById('delete-account-btn');
        if (deleteBtn) {
            addTrackedListener(deleteBtn, 'click', showDeleteAccountDialog);
        }

        const cancelDeletionBtn = document.getElementById('cancel-deletion-btn');
        if (cancelDeletionBtn) {
            addTrackedListener(cancelDeletionBtn, 'click', cancelAccountDeletion);
        }

        const closeFSKModalBtn = document.getElementById('close-fsk-modal-btn');
        if (closeFSKModalBtn) {
            addTrackedListener(closeFSKModalBtn, 'click', closeFSKModal);
        }

        const gotoAgeVerificationBtn = document.getElementById('goto-age-verification-btn');
        if (gotoAgeVerificationBtn) {
            addTrackedListener(gotoAgeVerificationBtn, 'click', goToAgeVerification);
        }

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

        // ✅ Only age 18+ matters for FSK18
        const ageLevel = age >= 18 ? 18 : 0;

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

            // ✅ Force Token Refresh (Custom Claims are now set)
            await SettingsState.currentUser.getIdToken(true);
            const refreshed = await SettingsState.currentUser.getIdTokenResult();

            // ✅ Update local state from claims
            SettingsState.userFSKAccess = {
                fsk0: true,
                fsk16: true,
                fsk18: refreshed?.claims?.fsk18 === true
            };

            updateFSKBadges(SettingsState.userFSKAccess);
            syncFSKToLocalStorage(SettingsState.userFSKAccess);

            if (ageLevel >= 18) {
                showSuccess('✅ Altersverifikation erfolgreich! FSK18-Inhalte freigeschaltet.');
            } else {
                showSuccess('✅ Alter bestätigt. FSK18-Inhalte bleiben gesperrt.');
            }

            // ✅ Close modals
            closeFSKModal();
            closeSettings();

            // ✅ Notify other pages
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('nocap:age-verified', {
                    detail: { ageLevel, fsk18: ageLevel >= 18 }
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
    /**
     * ✅ P0 SECURITY: Validate FSK access via Cloud Function
     * - FSK0 & FSK16: Always allowed (no verification needed)
     * - FSK18: Requires server-side validation via Custom Claims
     *
     * @param {string} category - 'fsk0', 'fsk16', 'fsk18'
     * @returns {Promise<boolean>} Access granted
     */
    async function validateFSKAccess(category) {
        if (!SettingsState.currentUser) {
            showError('Bitte melde dich an');
            return false;
        }

        if (!category || typeof category !== 'string') {
            showError('Ungültige Kategorie');
            return false;
        }

        // ✅ FSK0 & FSK16 always allowed (no server check needed)
        if (category === 'fsk0' || category === 'fsk16') {
            Logger.info('✅ FSK0/FSK16 access granted (no verification needed)');
            return true;
        }

        // ✅ FSK18 requires server-side validation via Custom Claims
        if (category === 'fsk18') {
            try {
                // ✅ Check if user is anonymous
                if (SettingsState.currentUser.isAnonymous) {
                    Logger.warn('❌ FSK18 requires Google sign-in (anonymous user)');
                    showFSKError(category, 'FSK18 erfordert eine Google-Anmeldung. Anonyme Benutzer haben keinen Zugriff.');
                    return false;
                }

                // ✅ Force token refresh to get latest Custom Claims
                await SettingsState.currentUser.getIdToken(true);
                const tokenResult = await SettingsState.currentUser.getIdTokenResult();

                // ✅ Check Custom Claim
                const hasFSK18 = tokenResult?.claims?.fsk18 === true;

                if (hasFSK18) {
                    Logger.info('✅ FSK18 access granted (Custom Claim validated)');
                    return true;
                }

                // ✅ No Custom Claim -> Try to grant via Cloud Function
                Logger.info('🔄 No FSK18 claim found, attempting to grant...');

                if (!SettingsState.functionsInstance) {
                    throw new Error('Functions not initialized');
                }

                // ✅ Call grantFSK18Access Cloud Function
                const grantFSK18 = SettingsState.functionsInstance.httpsCallable('grantFSK18Access');
                const result = await grantFSK18();

                if (result?.data?.success) {
                    Logger.info('✅ FSK18 access granted via Cloud Function');

                    // ✅ Refresh token to get new Custom Claim
                    await SettingsState.currentUser.getIdToken(true);

                    // ✅ Update local FSK access state
                    SettingsState.userFSKAccess.fsk18 = true;
                    updateFSKBadges(SettingsState.userFSKAccess);
                    syncFSKToLocalStorage(SettingsState.userFSKAccess);

                    return true;
                }

                // ✅ Access denied
                Logger.warn('❌ FSK18 access denied');
                showFSKError(category, 'FSK18-Zugriff wurde verweigert. Bitte melde dich mit einem Google-Konto an.');
                return false;

            } catch (error) {
                Logger.error('FSK18 validation error:', error);

                // ✅ Handle specific error codes
                if (error.code === 'failed-precondition') {
                    showFSKError(category, 'FSK18 erfordert eine Google-Anmeldung.');
                } else {
                    showError('Fehler bei der FSK18-Validierung');
                }

                return false;
            }
        }

        // ✅ Unknown category
        Logger.warn('❌ Unknown category:', category);
        return false;
    }

    function showFSKError(fskLevel, message) {
        const defaultMessage = 'Dieser Inhalt ist ab 18 Jahren freigegeben. Bitte verifiziere dein Alter in den Einstellungen.';

        const modal = document.getElementById('fsk-warning-modal');
        const messageEl = document.getElementById('fsk-message');

        if (messageEl) {
            messageEl.textContent = message || defaultMessage;
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

            if (!SettingsState.functionsInstance) {
                throw new Error('Functions not initialized');
            }

            const exportData = SettingsState.functionsInstance.httpsCallable('exportUserData');
            const result = await exportData();

            Logger.info('Export completed:', result.data);

            const dataStr = JSON.stringify(result.data, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `nocap-daten-${new Date().toISOString().split('T')[0]}.json`;
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

            if (!SettingsState.functionsInstance) {
                throw new Error('Functions not initialized');
            }

            const scheduleDelete = SettingsState.functionsInstance.httpsCallable('scheduleAccountDeletion');
            const result = await scheduleDelete({
                confirmation: 'DELETE_MY_ACCOUNT'
            });

            Logger.info('✅ Account deletion scheduled:', result.data);

            const scheduledDate = new Date(result.data.scheduledFor);
            const message =
                `✅ Account-Löschung wurde geplant!\n\n` +
                `📅 Geplant für: ${scheduledDate.toLocaleString('de-DE')}\n\n` +
                `⏰ Sie haben ${result.data.gracePeriodHours} Stunden Zeit, um die Löschung abzubrechen.\n\n` +
                `📧 Sie erhalten eine E-Mail mit weiteren Informationen.`;

            alert(message);

            await checkScheduledDeletion();

        } catch (error) {
            Logger.error('Account deletion scheduling error:', error);
            handleFunctionError(error);
        } finally {
            setButtonLoading(btn, false);
        }
    }

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

            if (!SettingsState.functionsInstance) {
                throw new Error('Functions not initialized');
            }

            const cancelDelete = SettingsState.functionsInstance.httpsCallable('cancelAccountDeletion');
            const result = await cancelDelete();

            Logger.info('✅ Deletion cancelled:', result.data);

            showSuccess('✅ Account-Löschung wurde abgebrochen!\n\nIhr Account bleibt erhalten.');

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
        alert('✅ ' + message);
    }

    function showError(message) {
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
        updateFSKBadges,
        getFSKAccess: () => ({ ...SettingsState.userFSKAccess }) // ✅ Read-only getter
    });

    (async function boot() {
        try {
            if (!window.FirebaseConfig?.isInitialized?.()) {
                await window.FirebaseConfig.initialize();
            }
            await window.FirebaseConfig.waitForFirebase(10000);
            await init();
        } catch (e) {
            Logger.error('❌ Settings boot failed:', e);
        }
    })();

})(window);