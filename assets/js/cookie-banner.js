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
    // 🛡️ P0 SECURITY: SANITIZATION HELPERS
    // ===================================

    /**
     * ✅ P0 SECURITY: Sanitize data from localStorage before DOM insertion
     * @param {*} value - Value to sanitize
     * @returns {string} Sanitized string
     */
    function sanitizeStorageValue(value) {
        if (value === null || value === undefined) {
            return '';
        }

        // Convert to string
        const str = String(value);

        // Use DOMPurify if available
        if (typeof DOMPurify !== 'undefined') {
            return DOMPurify.sanitize(str, {
                ALLOWED_TAGS: [],
                ALLOWED_ATTR: [],
                KEEP_CONTENT: true
            });
        }

        // Fallback: Basic XSS prevention
        return str
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;')
            .trim()
            .substring(0, 500); // Max length
    }

    /**
     * ✅ P0 SECURITY: Validate boolean value from storage
     * @param {*} value - Value to validate
     * @returns {boolean} Validated boolean
     */
    function validateBoolean(value) {
        return value === true || value === 'true';
    }

    /**
     * ✅ P0 SECURITY: Validate timestamp from storage
     * @param {*} value - Value to validate
     * @returns {number|null} Validated timestamp or null
     */
    function validateTimestamp(value) {
        const timestamp = parseInt(value);

        if (isNaN(timestamp)) {
            return null;
        }

        // Check reasonable range (2020 - 2040)
        const minDate = new Date('2020-01-01').getTime();
        const maxDate = new Date('2040-01-01').getTime();

        if (timestamp < minDate || timestamp > maxDate) {
            return null;
        }

        return timestamp;
    }

    // ===================================
    // 🍪 COOKIE CONSENT MANAGEMENT
    // ===================================

    /**
     * ✅ P0 SECURITY + P1 DSGVO: Check if user has already given consent
     * ✅ Validates and sanitizes all data from localStorage
     * ✅ 6-month expiry (180 days) as per DSGVO requirements
     * @returns {Object|null} Consent object or null
     */
    function getConsent() {
        try {
            const saved = localStorage.getItem(COOKIE_CONSENT_KEY);
            if (!saved) return null;

            // ✅ P0 SECURITY: Parse with error handling
            let consent;
            try {
                consent = JSON.parse(saved);
            } catch (parseError) {
                console.warn('⚠️ Invalid consent data format, clearing');
                localStorage.removeItem(COOKIE_CONSENT_KEY);
                return null;
            }

            // ✅ P0 SECURITY: Validate object structure
            if (!consent || typeof consent !== 'object') {
                console.warn('⚠️ Invalid consent object, clearing');
                localStorage.removeItem(COOKIE_CONSENT_KEY);
                return null;
            }

            // ✅ P0 SECURITY: Validate timestamp
            const timestamp = validateTimestamp(consent.timestamp);
            if (!timestamp) {
                console.warn('⚠️ Invalid consent timestamp, clearing');
                localStorage.removeItem(COOKIE_CONSENT_KEY);
                return null;
            }

            // ✅ P1 DSGVO: Check if consent is still valid (6 months = 180 days)
            const expiryDate = new Date(timestamp);
            expiryDate.setDate(expiryDate.getDate() + 180); // 6 months

            if (new Date() > expiryDate) {
                // Consent expired after 6 months
                if (isDevelopment) {
                    console.log('ℹ️ Cookie consent expired (>6 months), asking again');
                }
                localStorage.removeItem(COOKIE_CONSENT_KEY);
                return null;
            }

            // ✅ P0 SECURITY: Validate version string
            const version = sanitizeStorageValue(consent.version);
            if (version !== COOKIE_CONSENT_VERSION) {
                // Version changed, ask again
                if (isDevelopment) {
                    console.log('ℹ️ Cookie consent version changed, asking again');
                }
                localStorage.removeItem(COOKIE_CONSENT_KEY);
                return null;
            }

            // ✅ P0 SECURITY: Validate boolean values
            return {
                version: version,
                timestamp: timestamp,
                analytics: validateBoolean(consent.analytics),
                functional: validateBoolean(consent.functional),
                necessary: true // Always true
            };

        } catch (error) {
            console.error('❌ Error reading cookie consent:', error);
            // Clear corrupted data
            try {
                localStorage.removeItem(COOKIE_CONSENT_KEY);
            } catch (e) {
                // Ignore
            }
            return null;
        }
    }

    /**
     * ✅ P1 STABILITY: Save user consent with separate analytics/functional flags
     * @param {boolean} analytics - Allow analytics cookies
     * @param {boolean} functional - Allow functional cookies
     * @returns {Object|null} Saved consent object or null on error
     */
    function saveConsent(analytics, functional) {
        try {
            // ✅ P0 SECURITY: Strict boolean validation
            const analyticsConsent = analytics === true;
            const functionalConsent = functional === true;

            const consent = {
                version: COOKIE_CONSENT_VERSION,
                timestamp: Date.now(),
                analytics: analyticsConsent,
                functional: functionalConsent,
                necessary: true // Always true
            };

            // ✅ P1 STABILITY: Save to localStorage with error handling
            try {
                localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent));
            } catch (storageError) {
                console.error('❌ Failed to save consent to localStorage:', storageError);

                // Show user-friendly error
                if (window.NocapUtils?.showNotification) {
                    window.NocapUtils.showNotification(
                        'Cookie-Einstellungen konnten nicht gespeichert werden',
                        'error'
                    );
                }

                return null;
            }

            // ✅ P1 DSGVO: Also set old privacy consent for compatibility
            try {
                localStorage.setItem('nocap_privacy_consent', 'true');
                localStorage.setItem('nocap_privacy_date', new Date().toISOString());
            } catch (e) {
                // Non-fatal
                if (isDevelopment) {
                    console.warn('Could not set legacy privacy consent:', e);
                }
            }

            // Apply consent immediately
            applyConsent(consent);

            if (isDevelopment) {
                console.log('✅ Cookie consent saved:', {
                    analytics: analyticsConsent,
                    functional: functionalConsent,
                    expiresIn: '6 months'
                });
            }

            return consent;

        } catch (error) {
            console.error('❌ Error saving cookie consent:', error);
            return null;
        }
    }

    /**
     * ✅ P1 STABILITY: Apply consent settings and load optional scripts
     * ✅ Analytics und functional scripts werden nur nach Zustimmung geladen
     * @param {Object} consent - Consent object
     */
    function applyConsent(consent) {
        if (!consent) {
            if (isDevelopment) {
                console.warn('⚠️ No consent object provided to applyConsent()');
            }
            return;
        }

        // ===================================
        // ANALYTICS (nur wenn zugestimmt)
        // ===================================
        if (consent.analytics) {
            enableAnalytics();

            if (isDevelopment) {
                console.log('✅ Analytics enabled (user consent)');
            }
        } else {
            disableAnalytics();

            if (isDevelopment) {
                console.log('ℹ️ Analytics disabled (no consent)');
            }
        }

        // ===================================
        // FUNCTIONAL COOKIES (nur wenn zugestimmt)
        // ===================================
        if (consent.functional) {
            // Allow persistent auth
            if (window.firebase?.auth) {
                firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
                    .then(() => {
                        if (isDevelopment) {
                            console.log('✅ Firebase persistence set to LOCAL');
                        }
                    })
                    .catch(error => {
                        console.warn('Could not set local persistence:', error);
                    });
            }

            if (isDevelopment) {
                console.log('✅ Functional cookies enabled (user consent)');
            }
        } else {
            // Session-only persistence
            if (window.firebase?.auth) {
                firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION)
                    .then(() => {
                        if (isDevelopment) {
                            console.log('✅ Firebase persistence set to SESSION (no functional consent)');
                        }
                    })
                    .catch(error => {
                        console.warn('Could not set session persistence:', error);
                    });
            }

            if (isDevelopment) {
                console.log('ℹ️ Functional cookies disabled (no consent)');
            }
        }

        // ===================================
        // PRIVACY CONSENT (für Kompatibilität)
        // ===================================
        if (window.NocapPrivacy?.acceptPrivacy) {
            window.NocapPrivacy.acceptPrivacy();
            if (isDevelopment) {
                console.log('✅ Privacy consent granted via NocapPrivacy.acceptPrivacy()');
            }
        } else {
            // Fallback: Direct localStorage
            try {
                localStorage.setItem('nocap_privacy_consent', 'true');
                localStorage.setItem('nocap_privacy_date', new Date().toISOString());

                if (isDevelopment) {
                    console.log('✅ Privacy consent set directly (fallback)');
                }
            } catch (e) {
                console.warn('Could not set privacy consent:', e);
            }
        }

        // ===================================
        // DISPATCH EVENT (für andere Scripts)
        // ===================================
        window.dispatchEvent(new CustomEvent('nocap:consentChanged', {
            detail: {
                analytics: consent.analytics,
                functional: consent.functional,
                necessary: consent.necessary
            }
        }));

        if (isDevelopment) {
            console.log('✅ Cookie consent applied:', consent);
        }
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

