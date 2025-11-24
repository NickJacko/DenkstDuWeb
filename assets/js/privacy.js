// No-Cap - Privacy & GDPR Compliance
// Version 2.0 - Audit-Fixed & Security Hardened

(function(window) {
    'use strict';

    // P1 FIX: Environment detection
    const isDevelopment = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('192.168.');

    // ============================================================================
    // PRIVACY CONSENT MANAGEMENT
    // ============================================================================

    /**
     * P0 FIX: Check if user has given privacy consent
     */
    function hasPrivacyConsent() {
        try {
            const consent = localStorage.getItem('nocap_privacy_consent');
            const consentDate = localStorage.getItem('nocap_privacy_date');

            if (!consent || consent !== 'true' || !consentDate) {
                return false;
            }

            // Check if consent is still valid (1 year)
            const consentTime = new Date(consentDate).getTime();
            const currentTime = Date.now();
            const daysSinceConsent = (currentTime - consentTime) / (24 * 60 * 60 * 1000);

            if (daysSinceConsent > 365) {
                // Consent expired - remove old consent
                revokePrivacyConsentSilent();
                return false;
            }

            return true;

        } catch (error) {
            console.error('Error checking privacy consent:', error);
            return false;
        }
    }

    /**
     * P1 FIX: Show privacy consent modal (safe DOM creation)
     */
    function showPrivacyConsent() {
        // Check if modal already exists
        if (document.getElementById('privacy-modal')) {
            return;
        }

        // P0 FIX: Create modal safely without innerHTML
        const modal = document.createElement('div');
        modal.id = 'privacy-modal';
        modal.className = 'privacy-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-labelledby', 'privacy-modal-title');
        modal.setAttribute('aria-modal', 'true');

        const modalContent = document.createElement('div');
        modalContent.className = 'privacy-modal-content';

        // Title
        const title = document.createElement('h3');
        title.id = 'privacy-modal-title';
        title.textContent = '🔒 Datenschutz & Cookies';

        // Description
        const description = document.createElement('p');
        description.textContent = 'Wir verwenden nur technisch notwendige Daten für das Multiplayer-Spiel. Keine Werbung, kein Tracking. Alle Daten werden nach 24h automatisch gelöscht.';

        // Info list
        const infoList = document.createElement('ul');
        infoList.className = 'privacy-info-list';

        const infoItems = [
            '✅ Nur notwendige Daten für Spielfunktionalität',
            '✅ Automatische Löschung nach 24 Stunden',
            '✅ Keine Werbung oder Tracking',
            '✅ Jederzeit widerrufbar'
        ];

        infoItems.forEach(text => {
            const li = document.createElement('li');
            li.textContent = text;
            infoList.appendChild(li);
        });

        // Privacy link
        const linkContainer = document.createElement('div');
        linkContainer.className = 'privacy-link';

        const link = document.createElement('a');
        link.href = 'privacy.html';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = '→ Vollständige Datenschutzerklärung';

        linkContainer.appendChild(link);

        // Buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'privacy-buttons';

        const declineBtn = window.NocapUtils
            ? window.NocapUtils.createButton('Ablehnen', () => declinePrivacy(), 'btn btn-outline')
            : createSimpleButton('Ablehnen', () => declinePrivacy(), 'btn btn-outline');

        const acceptBtn = window.NocapUtils
            ? window.NocapUtils.createButton('Akzeptieren', () => acceptPrivacy(), 'btn btn-primary')
            : createSimpleButton('Akzeptieren', () => acceptPrivacy(), 'btn btn-primary');

        buttonContainer.appendChild(declineBtn);
        buttonContainer.appendChild(acceptBtn);

        // Assemble modal
        modalContent.appendChild(title);
        modalContent.appendChild(description);
        modalContent.appendChild(infoList);
        modalContent.appendChild(linkContainer);
        modalContent.appendChild(buttonContainer);
        modal.appendChild(modalContent);

        document.body.appendChild(modal);

        // Show with animation
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });

        // P1 FIX: Trap focus in modal
        if (window.NocapUtils && window.NocapUtils.trapFocus) {
            window.NocapUtils.trapFocus(modalContent);
        }
    }

    /**
     * P0 FIX: Simple button helper (fallback)
     */
    function createSimpleButton(text, onClick, className) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.textContent = text;
        button.addEventListener('click', onClick);
        return button;
    }

    /**
     * P1 FIX: Accept privacy consent with validation
     */
    function acceptPrivacy() {
        try {
            const consentData = {
                accepted: true,
                date: new Date().toISOString(),
                version: '1.0',
                userAgent: navigator.userAgent.substring(0, 100), // Truncated
                language: navigator.language
            };

            // P0 FIX: Use safe storage helper
            if (window.NocapUtils) {
                window.NocapUtils.setLocalStorage('nocap_privacy_consent', 'true');
                window.NocapUtils.setLocalStorage('nocap_privacy_date', consentData.date);
                window.NocapUtils.setLocalStorage('nocap_privacy_version', consentData.version);
            } else {
                localStorage.setItem('nocap_privacy_consent', 'true');
                localStorage.setItem('nocap_privacy_date', consentData.date);
                localStorage.setItem('nocap_privacy_version', consentData.version);
            }

            // Hide modal
            closePrivacyModal();

            // P1 FIX: Show success notification
            if (window.NocapUtils) {
                window.NocapUtils.showNotification(
                    'Datenschutz akzeptiert! Multiplayer-Features sind nun verfügbar.',
                    'success',
                    3000
                );
            }

            // Enable multiplayer features
            enableMultiplayerFeatures();

            // P1 FIX: Dispatch custom event
            window.dispatchEvent(new CustomEvent('nocap:privacyAccepted', {
                detail: { timestamp: consentData.date }
            }));

            if (isDevelopment) {
                console.log('✅ Privacy consent accepted');
            }

        } catch (error) {
            console.error('❌ Error accepting privacy consent:', error);
        }
    }

    /**
     * P1 FIX: Decline privacy consent
     */
    function declinePrivacy() {
        try {
            // P0 FIX: Use safe storage
            if (window.NocapUtils) {
                window.NocapUtils.setLocalStorage('nocap_privacy_declined', 'true');
                window.NocapUtils.setLocalStorage('nocap_privacy_decline_date', new Date().toISOString());
            } else {
                localStorage.setItem('nocap_privacy_declined', 'true');
                localStorage.setItem('nocap_privacy_decline_date', new Date().toISOString());
            }

            // Hide modal
            closePrivacyModal();

            // P1 FIX: Show info notification
            if (window.NocapUtils) {
                window.NocapUtils.showNotification(
                    'Ohne Datenschutz-Zustimmung sind nur lokale Spiele möglich.',
                    'warning',
                    5000
                );
            }

            // Disable multiplayer features
            disableMultiplayerFeatures();

            // P1 FIX: Dispatch custom event
            window.dispatchEvent(new CustomEvent('nocap:privacyDeclined'));

            if (isDevelopment) {
                console.log('ℹ️ Privacy consent declined');
            }

        } catch (error) {
            console.error('❌ Error declining privacy consent:', error);
        }
    }

    /**
     * P1 FIX: Revoke privacy consent
     */
    function revokePrivacyConsent() {
        if (!confirm('Datenschutz-Zustimmung wirklich widerrufen? Multiplayer-Features werden deaktiviert und alle gespeicherten Daten gelöscht.')) {
            return;
        }

        revokePrivacyConsentSilent();

        // P1 FIX: Show confirmation
        if (window.NocapUtils) {
            window.NocapUtils.showNotification(
                'Datenschutz-Zustimmung widerrufen und Daten gelöscht.',
                'success',
                3000
            );
        }

        // Redirect to home if on multiplayer page
        if (window.location.pathname.includes('multiplayer') ||
            window.location.pathname.includes('join-game')) {
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        }
    }

    /**
     * P1 FIX: Silent revocation (no confirmation)
     */
    function revokePrivacyConsentSilent() {
        try {
            // Remove consent
            const keysToRemove = [
                'nocap_privacy_consent',
                'nocap_privacy_date',
                'nocap_privacy_version',
                'nocap_privacy_declined',
                'nocap_privacy_decline_date'
            ];

            keysToRemove.forEach(key => {
                if (window.NocapUtils) {
                    window.NocapUtils.removeLocalStorage(key);
                } else {
                    localStorage.removeItem(key);
                }
            });

            // Clear all game data
            clearAllGameData();

            // Disable multiplayer
            disableMultiplayerFeatures();

            // P1 FIX: Dispatch event
            window.dispatchEvent(new CustomEvent('nocap:privacyRevoked'));

            if (isDevelopment) {
                console.log('ℹ️ Privacy consent revoked');
            }

        } catch (error) {
            console.error('❌ Error revoking privacy consent:', error);
        }
    }

    /**
     * P1 FIX: Close privacy modal
     */
    function closePrivacyModal() {
        const modal = document.getElementById('privacy-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.remove();
                }
            }, 300);
        }
    }

    // ============================================================================
    // MULTIPLAYER FEATURE MANAGEMENT
    // ============================================================================

    /**
     * P1 FIX: Enable multiplayer features
     */
    function enableMultiplayerFeatures() {
        // Remove disabled state
        document.querySelectorAll('[data-requires-privacy]').forEach(element => {
            element.disabled = false;
            element.classList.remove('privacy-disabled');
            element.removeAttribute('title');
        });

        // Show multiplayer options
        document.querySelectorAll('.multiplayer-feature').forEach(element => {
            element.style.display = '';
        });

        // Add body class
        document.body.classList.add('privacy-accepted');
        document.body.classList.remove('privacy-required');

        if (isDevelopment) {
            console.log('✅ Multiplayer features enabled');
        }
    }

    /**
     * P1 FIX: Disable multiplayer features
     */
    function disableMultiplayerFeatures() {
        // Disable buttons
        document.querySelectorAll('[data-requires-privacy]').forEach(element => {
            element.disabled = true;
            element.classList.add('privacy-disabled');
            element.setAttribute('title', 'Erfordert Datenschutz-Zustimmung');
        });

        // Hide multiplayer options
        document.querySelectorAll('.multiplayer-feature').forEach(element => {
            element.style.display = 'none';
        });

        // Add body class
        document.body.classList.add('privacy-required');
        document.body.classList.remove('privacy-accepted');

        // Disconnect Firebase if connected
        if (window.firebaseGameService && window.firebaseGameService.isConnected) {
            window.firebaseGameService.cleanup();
        }

        if (isDevelopment) {
            console.log('ℹ️ Multiplayer features disabled');
        }
    }

    // ============================================================================
    // DATA MANAGEMENT
    // ============================================================================

    /**
     * P0 FIX: Clear all game data
     */
    function clearAllGameData() {
        try {
            // Clear via NocapUtils if available
            if (window.NocapUtils && window.NocapUtils.clearAppStorage) {
                window.NocapUtils.clearAppStorage();
            } else {
                // Fallback: Clear manually
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('nocap_')) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(key => localStorage.removeItem(key));
            }

            // Clear GameState if available
            if (window.gameState && typeof window.gameState.clearStorage === 'function') {
                window.gameState.clearStorage();
            }

            if (isDevelopment) {
                console.log('✅ All game data cleared');
            }

        } catch (error) {
            console.error('❌ Error clearing game data:', error);
        }
    }

    /**
     * P1 FIX: Export user data (GDPR Art. 20)
     */
    function exportUserData() {
        try {
            const userData = {
                meta: {
                    exportDate: new Date().toISOString(),
                    version: '1.0',
                    appVersion: '4.0'
                },
                consent: {
                    accepted: hasPrivacyConsent(),
                    date: localStorage.getItem('nocap_privacy_date'),
                    version: localStorage.getItem('nocap_privacy_version')
                },
                gameState: null
            };

            // Add GameState if available
            if (window.gameState && typeof window.gameState.getDebugInfo === 'function') {
                userData.gameState = window.gameState.getDebugInfo();
            }

            // Create and download file
            const dataStr = JSON.stringify(userData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });

            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `nocap-data-export-${new Date().toISOString().split('T')[0]}.json`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up URL
            URL.revokeObjectURL(link.href);

            // Show confirmation
            if (window.NocapUtils) {
                window.NocapUtils.showNotification(
                    'Daten erfolgreich exportiert!',
                    'success',
                    3000
                );
            }

            if (isDevelopment) {
                console.log('✅ User data exported');
            }

        } catch (error) {
            console.error('❌ Error exporting user data:', error);

            if (window.NocapUtils) {
                window.NocapUtils.showNotification(
                    'Export fehlgeschlagen',
                    'error'
                );
            }
        }
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    /**
     * P1 FIX: Initialize privacy management
     */
    function initPrivacyManagement() {
        try {
            // Check if privacy consent is given
            if (hasPrivacyConsent()) {
                enableMultiplayerFeatures();
            } else {
                disableMultiplayerFeatures();

                // Show consent modal after delay (unless recently declined)
                const declined = localStorage.getItem('nocap_privacy_declined');
                const declineDate = localStorage.getItem('nocap_privacy_decline_date');

                const shouldShow = !declined ||
                    (declineDate && Date.now() - new Date(declineDate).getTime() > 7 * 24 * 60 * 60 * 1000);

                if (shouldShow) {
                    setTimeout(showPrivacyConsent, 2000);
                }
            }

            if (isDevelopment) {
                console.log('✅ Privacy management initialized');
            }

        } catch (error) {
            console.error('❌ Error initializing privacy management:', error);
        }
    }

    // ============================================================================
    // EXPORT API
    // ============================================================================

    window.NocapPrivacy = {
        // Version
        version: '2.0',

        // Consent management
        hasPrivacyConsent,
        showPrivacyConsent,
        acceptPrivacy,
        declinePrivacy,
        revokePrivacyConsent,

        // Feature management
        enableMultiplayerFeatures,
        disableMultiplayerFeatures,

        // Data management
        clearAllGameData,
        exportUserData,

        // Initialization
        initPrivacyManagement
    };

    // P1 FIX: Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPrivacyManagement);
    } else {
        initPrivacyManagement();
    }

    if (isDevelopment) {
        console.log('%c✅ NocapPrivacy v2.0 loaded (Audit-Fixed)',
            'color: #9C27B0; font-weight: bold; font-size: 12px');
    }

})(window);