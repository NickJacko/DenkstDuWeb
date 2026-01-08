/**
 * NO-CAP Cookie Banner
 * DSGVO-konformes Cookie-Consent Management
 * Version 2.0 - Production Hardened
 *
 * ✅ Features:
 * - Wiederverwendbar auf allen Seiten
 * - Zentrale Consent-Verwaltung
 * - LocalStorage-Persistierung
 * - Analytics-Integration
 * - Accessibility-optimiert
 * - Dynamic Banner Creation (optional)
 */

(function(window) {
    'use strict';

    // ===================================
    // 📊 CONFIGURATION
    // ===================================

    const COOKIE_CONSENT_KEY = 'nocap_cookie_consent';
    const COOKIE_CONSENT_VERSION = '2.0';
    const CONSENT_EXPIRY_DAYS = 365;

    const isDevelopment = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('192.168.');

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
     * ✅ NEW: Create banner dynamically if it doesn't exist in HTML
     * Allows cookie-banner.js to work standalone on any page
     */
    function createBannerElement() {
        // Check if banner already exists
        if (document.getElementById('cookie-banner')) {
            return;
        }

        const banner = document.createElement('div');
        banner.id = 'cookie-banner';
        banner.className = 'cookie-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-labelledby', 'cookie-banner-title');
        banner.setAttribute('aria-describedby', 'cookie-banner-desc');

        banner.innerHTML = `
            <div class="cookie-banner-content">
                <div class="cookie-banner-text">
                    <h3 id="cookie-banner-title">🍪 Cookie-Hinweis</h3>
                    <p id="cookie-banner-desc">
                        Wir verwenden Cookies, um deine Erfahrung zu verbessern.
                        Notwendige Cookies sind für die Funktionalität erforderlich.
                        <a href="/privacy.html" target="_blank" rel="noopener">Mehr erfahren</a>
                    </p>
                </div>
                <div class="cookie-banner-actions">
                    <button id="cookie-accept" class="btn btn-primary" aria-label="Alle Cookies akzeptieren">
                        ✅ Alle akzeptieren
                    </button>
                    <button id="cookie-decline" class="btn btn-secondary" aria-label="Nur notwendige Cookies">
                        ❌ Nur Notwendige
                    </button>
                    <button id="cookie-settings" class="btn btn-link" aria-label="Cookie-Einstellungen anpassen">
                        ⚙️ Einstellungen
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(banner);

        if (isDevelopment) {
            console.log('✅ Cookie banner element created dynamically');
        }
    }

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
     * @param {Object} options - Configuration options
     */
    function init(options = {}) {
        // ✅ FIX: Verhindere Mehrfach-Initialisierung
        if (window._cookieBannerInitialized) {
            if (isDevelopment) {
                console.log('ℹ️ Cookie banner already initialized, skipping');
            }
            return;
        }
        window._cookieBannerInitialized = true;

        // Check if consent already exists
        const consent = getConsent();

        if (consent) {
            // User has already given consent
            applyConsent(consent);

            if (isDevelopment) {
                console.log('ℹ️ Cookie consent already given:', consent);
            }
            return;
        }

        // ✅ NEW: Create banner element if it doesn't exist
        // This allows cookie-banner.js to work standalone
        createBannerElement();

        // Show banner after short delay (better UX)
        const delay = options.delay !== undefined ? options.delay : 1000;
        setTimeout(showBanner, delay);

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

        if (isDevelopment) {
            console.log('✅ Cookie banner initialized (v2.0)');
        }
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => init());
    } else {
        init();
    }

    // ===================================
    // 📤 PUBLIC API
    // ===================================

    /**
     * ✅ ENHANCED: Comprehensive Public API
     * Can be used from any page or component
     */
    window.NocapCookies = {
        // Core functions
        getConsent: getConsent,
        saveConsent: saveConsent,
        showBanner: showBanner,
        hideBanner: hideBanner,

        // ✅ NEW: Additional utility functions
        hasConsent: () => getConsent() !== null,
        hasAnalyticsConsent: () => {
            const consent = getConsent();
            return consent ? consent.analytics === true : false;
        },
        hasFunctionalConsent: () => {
            const consent = getConsent();
            return consent ? consent.functional === true : false;
        },

        // ✅ NEW: Revoke consent (for "Einstellungen zurücksetzen")
        revokeConsent: () => {
            try {
                localStorage.removeItem(COOKIE_CONSENT_KEY);
                localStorage.removeItem('nocap_privacy_consent');
                localStorage.removeItem('nocap_privacy_date');

                if (isDevelopment) {
                    console.log('✅ Cookie consent revoked');
                }

                return true;
            } catch (error) {
                console.error('Error revoking consent:', error);
                return false;
            }
        },

        // ✅ NEW: Re-initialize (useful after revoke)
        reinitialize: (options) => {
            window._cookieBannerInitialized = false;
            init(options);
        },

        // Metadata
        version: COOKIE_CONSENT_VERSION,
        expiryDays: CONSENT_EXPIRY_DAYS
    };

})(window);

