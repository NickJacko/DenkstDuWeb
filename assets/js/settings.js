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

    // Get Logger from utils
    const Logger = window.NocapUtils?.Logger || {
        debug: console.log,
        info: console.log,
        warn: console.warn,
        error: console.error
    };

    // ===================================
    // GLOBAL STATE
    // ===================================

    let currentUser = null;
    let userFSKAccess = {
        fsk0: true,
        fsk16: false,
        fsk18: false
    };

    // ✅ FIX: Initialize Functions with correct region
    let functionsInstance = null;

    // ===================================
    // INIT
    // ===================================

    async function init() {
        Logger.info('🚀 Initializing Settings Module...');

        // ✅ FIX: Use waitForFirebaseInit from utils.js to avoid retry loops
        const firebaseReady = await window.NocapUtils.waitForFirebaseInit(10000);

        if (!firebaseReady) {
            Logger.error('❌ Firebase initialization timeout - Settings Module cannot start');
            return;
        }

        // ✅ FIX: Initialize Functions with europe-west1 region
        try {
            functionsInstance = firebase.app().functions('europe-west1');
            Logger.info('✅ Firebase Functions initialized (europe-west1)');
        } catch (error) {
            Logger.error('❌ Failed to initialize Functions:', error);
        }

        // Listen to Auth State
        firebase.auth().onAuthStateChanged(onAuthStateChanged);

        // Setup Event Listeners
        setupEventListeners();

        Logger.info('✅ Settings Module initialized');
    }

    // ===================================
    // AUTH STATE
    // ===================================

    function onAuthStateChanged(user) {
        currentUser = user;

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
            userMenuContainer.style.display = 'flex';
        }
    }

    function hideUserMenu() {
        const userMenuContainer = document.getElementById('user-menu-container');
        if (userMenuContainer) {
            userMenuContainer.style.display = 'none';
        }
    }

    async function loadUserData() {
        if (!currentUser) return;

        try {
            // Load display name
            const displayName = currentUser.displayName || 'Gast';
            updateDisplayName(displayName);

            // Load FSK access from custom claims
            const token = await currentUser.getIdTokenResult();
            userFSKAccess = {
                fsk0: true,
                fsk16: token.claims.fsk16 || false,
                fsk18: token.claims.fsk18 || false
            };

            updateFSKBadges(userFSKAccess);

            // ✅ NEW: Check for scheduled deletion
            await checkScheduledDeletion();

        } catch (error) {
            Logger.error('❌ Error loading user data:', error);
        }
    }

    /**
     * ✅ NEW: Check if user has scheduled deletion
     */
    async function checkScheduledDeletion() {
        if (!currentUser) return;

        try {
            const db = firebase.database();
            const deletionRef = db.ref(`deletionRequests/${currentUser.uid}`);
            const snapshot = await deletionRef.once('value');

            if (snapshot.exists()) {
                const request = snapshot.val();

                if (request.status === 'scheduled') {
                    // Show cancellation option
                    showCancellationOption(request);
                } else {
                    // Hide cancellation option
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
            cancelContainer.style.display = 'block';
        }

        if (deleteContainer) {
            deleteContainer.style.display = 'none';
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
            cancelContainer.style.display = 'none';
        }

        if (deleteContainer) {
            deleteContainer.style.display = 'block';
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
            fsk16Badge.style.display = fskAccess.fsk16 ? 'inline-block' : 'none';
        }

        if (fsk18Badge) {
            fsk18Badge.style.display = fskAccess.fsk18 ? 'inline-block' : 'none';
        }

        // Settings badges
        const fsk16BadgeSettings = document.getElementById('fsk16-badge-settings');
        const fsk18BadgeSettings = document.getElementById('fsk18-badge-settings');

        if (fsk16BadgeSettings) {
            fsk16BadgeSettings.style.display = fskAccess.fsk16 ? 'inline-block' : 'none';
        }

        if (fsk18BadgeSettings) {
            fsk18BadgeSettings.style.display = fskAccess.fsk18 ? 'inline-block' : 'none';
        }
    }

    // ===================================
    // EVENT LISTENERS
    // ===================================

    function setupEventListeners() {
        // Settings Button
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', openSettings);
        }

        // Close Settings
        const closeBtn = document.getElementById('settings-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeSettings);
        }

        // Save Display Name
        const saveNameBtn = document.getElementById('save-display-name-btn');
        if (saveNameBtn) {
            saveNameBtn.addEventListener('click', saveDisplayName);
        }

        // Verify Age
        const verifyAgeBtn = document.getElementById('verify-age-btn');
        if (verifyAgeBtn) {
            verifyAgeBtn.addEventListener('click', verifyAge);
        }

        // Export Data
        const exportBtn = document.getElementById('export-data-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportMyData);
        }

        // Delete Account
        const deleteBtn = document.getElementById('delete-account-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', showDeleteAccountDialog);
        }

        // Cancel Deletion
        const cancelDeletionBtn = document.getElementById('cancel-deletion-btn');
        if (cancelDeletionBtn) {
            cancelDeletionBtn.addEventListener('click', cancelAccountDeletion);
        }

        // FSK Warning Modal
        const closeFSKModalBtn = document.getElementById('close-fsk-modal-btn');
        if (closeFSKModalBtn) {
            closeFSKModalBtn.addEventListener('click', closeFSKModal);
        }

        const gotoAgeVerificationBtn = document.getElementById('goto-age-verification-btn');
        if (gotoAgeVerificationBtn) {
            gotoAgeVerificationBtn.addEventListener('click', goToAgeVerification);
        }

        // Close modal on outside click
        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target === settingsModal) {
                    closeSettings();
                }
            });
        }

        const fskWarningModal = document.getElementById('fsk-warning-modal');
        if (fskWarningModal) {
            fskWarningModal.addEventListener('click', (e) => {
                if (e.target === fskWarningModal) {
                    closeFSKModal();
                }
            });
        }
    }

    // ===================================
    // SETTINGS MODAL
    // ===================================

    function openSettings() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }

    function closeSettings() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    // ===================================
    // DISPLAY NAME
    // ===================================

    async function saveDisplayName() {
        if (!currentUser) {
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
            await currentUser.updateProfile({
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
        if (!currentUser) {
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

        const btn = document.getElementById('verify-age-btn');
        setButtonLoading(btn, true);

        try {
            // ✅ FIX: Use regionalized Functions instance
            if (!functionsInstance) {
                throw new Error('Functions not initialized');
            }

            const setAge = functionsInstance.httpsCallable('setAgeVerification');
            const result = await setAge({
                ageLevel: age,
                verificationMethod: 'birthdate-self-declaration'
            });

            Logger.info('✅ Age verified:', result.data);

            // Update FSK Access
            userFSKAccess = result.data.fskAccess;
            updateFSKBadges(userFSKAccess);

            // Force Token Refresh (wichtig für Custom Claims!)
            await currentUser.getIdToken(true);

            showSuccess('Altersverifikation erfolgreich!');

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
        if (!currentUser) {
            showError('Bitte melde dich an');
            return false;
        }

        try {
            // ✅ FIX: Get auth token for HTTP request
            const idToken = await currentUser.getIdToken();

            // ✅ FIX: Call HTTP function with proper CORS headers
            const response = await fetch('https://europe-west1-denkstduwebsite.cloudfunctions.net/validateFSKAccess', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({ data: { category: category } })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.result && result.result.allowed) {
                Logger.info('✅ FSK Access granted:', category);
                return true;
            } else {
                const message = result.result?.message || 'Zugriff verweigert';
                Logger.warn('❌ FSK Access denied:', message);
                showFSKError(category, message);
                return false;
            }

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
            modal.style.display = 'flex';
        }
    }

    function closeFSKModal() {
        const modal = document.getElementById('fsk-warning-modal');
        if (modal) {
            modal.style.display = 'none';
        }
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
        if (!currentUser) {
            showError('Bitte melde dich an');
            return;
        }

        const btn = document.getElementById('export-data-btn');
        setButtonLoading(btn, true);

        try {
            Logger.info('📥 Exporting user data...');

            // ✅ FIX: Use regionalized Functions instance
            if (!functionsInstance) {
                throw new Error('Functions not initialized');
            }

            const exportData = functionsInstance.httpsCallable('exportUserData');
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
        if (!currentUser) {
            showError('Bitte melde dich an');
            return;
        }

        const btn = document.getElementById('delete-account-btn');
        setButtonLoading(btn, true);

        try {
            Logger.info('🗑️ Scheduling account deletion...');

            // ✅ FIX: Use regionalized Functions instance
            if (!functionsInstance) {
                throw new Error('Functions not initialized');
            }

            // ✅ NEW: Use scheduleAccountDeletion with 48h grace period
            const scheduleDelete = functionsInstance.httpsCallable('scheduleAccountDeletion');
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
            if (!functionsInstance) {
                throw new Error('Functions not initialized');
            }

            const cancelDelete = functionsInstance.httpsCallable('cancelAccountDeletion');
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

    // Export functions for use in other scripts
    window.SettingsModule = {
        validateFSKAccess,
        showFSKError,
        updateFSKBadges
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window);

