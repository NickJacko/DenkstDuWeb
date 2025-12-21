/**
 * NO-CAP Cookie Banner
 * DSGVO-konformes Cookie-Consent Management
 * Version 1.0
 */

(function(window) {
    'use strict';

    // ===================================
    // 📊 CONFIGURATION
    // ===================================

    const COOKIE_CONSENT_KEY = 'nocap_cookie_consent';
    const COOKIE_CONSENT_VERSION = '1.0';
    const CONSENT_EXPIRY_DAYS = 365;

    // ===================================
    // 🍪 COOKIE CONSENT MANAGEMENT
    // ===================================

    /**
     * Check if user has already given consent
     * @returns {Object|null} Consent object or null
     */
    function getConsent() {
        try {
            const saved = localStorage.getItem(COOKIE_CONSENT_KEY);
            if (!saved) return null;

            const consent = JSON.parse(saved);

            // Check if consent is still valid (not expired)
            const expiryDate = new Date(consent.timestamp);
            expiryDate.setDate(expiryDate.getDate() + CONSENT_EXPIRY_DAYS);

            if (new Date() > expiryDate) {
                // Consent expired
                localStorage.removeItem(COOKIE_CONSENT_KEY);
                return null;
            }

            // Check if version matches
            if (consent.version !== COOKIE_CONSENT_VERSION) {
                // Version changed, ask again
                localStorage.removeItem(COOKIE_CONSENT_KEY);
                return null;
            }

            return consent;
        } catch (error) {
            console.error('Error reading cookie consent:', error);
            return null;
        }
    }

    /**
     * Save user consent
     * @param {boolean} analytics - Allow analytics cookies
     * @param {boolean} functional - Allow functional cookies
     */
    function saveConsent(analytics, functional) {
        try {
            const consent = {
                version: COOKIE_CONSENT_VERSION,
                timestamp: Date.now(),
                analytics: analytics === true,
                functional: functional === true,
                necessary: true // Always true
            };

            localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent));

            // ✅ FIX: Setze AUCH das alte Privacy-Consent (für Kompatibilität mit privacy.js)
            localStorage.setItem('nocap_privacy_consent', 'true');
            localStorage.setItem('nocap_privacy_date', new Date().toISOString());

            // Apply consent
            applyConsent(consent);

            return consent;
        } catch (error) {
            console.error('Error saving cookie consent:', error);
            return null;
        }
    }

    /**
     * Apply consent settings (enable/disable tracking)
     * @param {Object} consent - Consent object
     */
    function applyConsent(consent) {
        // Analytics (Firebase Analytics, Google Analytics, etc.)
        if (consent.analytics) {
            enableAnalytics();
        } else {
            disableAnalytics();
        }

        // Functional cookies (z.B. Firebase Auth persistence)
        if (!consent.functional) {
            // Setze Firebase auf session persistence
            if (window.firebase && window.firebase.auth) {
                firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION)
                    .catch(error => console.warn('Could not set session persistence:', error));
            }
        }

        // ✅ FIX: Setze Privacy Consent für NocapPrivacy
        // Rufe die richtige Funktion auf: acceptPrivacy()
        if (window.NocapPrivacy && window.NocapPrivacy.acceptPrivacy) {
            window.NocapPrivacy.acceptPrivacy();
            console.log('✅ Privacy consent granted via Cookie Banner (acceptPrivacy called)');
        } else {
            // Fallback: Setze direkt in LocalStorage
            try {
                localStorage.setItem('nocap_privacy_consent', 'true');
                localStorage.setItem('nocap_privacy_date', new Date().toISOString());
                console.log('✅ Privacy consent set directly in LocalStorage (fallback)');
            } catch (e) {
                console.warn('Could not set privacy consent:', e);
            }
        }

        console.log('✅ Cookie consent applied:', consent);
    }

    /**
     * Enable analytics tracking
     */
    function enableAnalytics() {
        try {
            // Firebase Analytics
            if (window.firebase && window.firebase.analytics) {
                firebase.analytics();
                console.log('✅ Analytics enabled');
            }

            // Google Analytics (falls verwendet)
            if (window.gtag) {
                gtag('consent', 'update', {
                    'analytics_storage': 'granted'
                });
            }
        } catch (error) {
            console.error('Error enabling analytics:', error);
        }
    }

    /**
     * Disable analytics tracking
     */
    function disableAnalytics() {
        try {
            // Google Analytics Opt-Out
            if (window.gtag) {
                gtag('consent', 'update', {
                    'analytics_storage': 'denied'
                });
            }

            console.log('✅ Analytics disabled');
        } catch (error) {
            console.error('Error disabling analytics:', error);
        }
    }

    // ===================================
    // 🎨 UI MANAGEMENT
    // ===================================

    /**
     * Show cookie banner
     */
    function showBanner() {
        const banner = document.getElementById('cookie-banner');
        if (!banner) {
            console.warn('Cookie banner element not found');
            return;
        }

        banner.classList.add('show');
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-labelledby', 'cookie-banner-title');
        banner.setAttribute('aria-modal', 'false'); // Not blocking

        // Focus first button
        const firstButton = banner.querySelector('button');
        if (firstButton) {
            setTimeout(() => firstButton.focus(), 100);
        }

        // Announce to screen readers
        if (window.NocapUtils && window.NocapUtils.announceToScreenReader) {
            window.NocapUtils.announceToScreenReader(
                'Cookie-Hinweis angezeigt. Bitte wähle deine Cookie-Einstellungen.',
                'polite'
            );
        }
    }

    /**
     * Hide cookie banner
     */
    function hideBanner() {
        const banner = document.getElementById('cookie-banner');
        if (!banner) return;

        banner.classList.remove('show');
        banner.removeAttribute('role');
        banner.removeAttribute('aria-labelledby');
        banner.removeAttribute('aria-modal');
    }

    /**
     * Handle accept all cookies
     */
    function handleAcceptAll() {
        const consent = saveConsent(true, true);

        if (consent) {
            hideBanner();

            // ✅ FIX: Zeige Notification NUR wenn Utils verfügbar
            if (window.NocapUtils && window.NocapUtils.showNotification) {
                window.NocapUtils.showNotification(
                    'Cookie-Einstellungen gespeichert',
                    'success',
                    2000
                );
            }

            console.log('✅ Cookies akzeptiert - Privacy Consent gesetzt');
        }
    }

    /**
     * Handle accept only necessary cookies
     */
    function handleDecline() {
        const consent = saveConsent(false, false);

        if (consent) {
            hideBanner();

            // ✅ FIX: Zeige Notification NUR wenn Utils verfügbar
            if (window.NocapUtils && window.NocapUtils.showNotification) {
                window.NocapUtils.showNotification(
                    'Nur notwendige Cookies aktiv',
                    'info',
                    2000
                );
            }

            console.log('✅ Nur notwendige Cookies - Privacy Consent gesetzt');
        }
    }

    /**
     * Handle custom settings (redirect to privacy page)
     */
    function handleSettings() {
        window.location.href = 'privacy.html#cookie-settings';
    }

    // ===================================
    // 🚀 INITIALIZATION
    // ===================================

    /**
     * Initialize cookie banner
     */
    function init() {
        // ✅ FIX: Verhindere Mehrfach-Initialisierung
        if (window._cookieBannerInitialized) {
            console.log('ℹ️ Cookie banner already initialized, skipping');
            return;
        }
        window._cookieBannerInitialized = true;

        // Check if consent already exists
        const consent = getConsent();

        if (consent) {
            // User has already given consent
            applyConsent(consent);
            console.log('ℹ️ Cookie consent already given');
            return;
        }

        // Show banner after short delay (better UX)
        setTimeout(showBanner, 1000);

        // Setup event listeners
        const btnAccept = document.getElementById('cookie-accept');
        const btnDecline = document.getElementById('cookie-decline');
        const btnSettings = document.getElementById('cookie-settings');

        if (btnAccept) {
            btnAccept.addEventListener('click', handleAcceptAll);
        }

        if (btnDecline) {
            btnDecline.addEventListener('click', handleDecline);
        }

        if (btnSettings) {
            btnSettings.addEventListener('click', handleSettings);
        }

        console.log('✅ Cookie banner initialized');
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Export to window for external access
    window.NocapCookies = {
        getConsent,
        saveConsent,
        showBanner,
        hideBanner
    };

})(window);

