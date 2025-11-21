// No-Cap - Utility Functions
// Version 2.0 - Security Hardened
// Gemeinsame Hilfsfunktionen für die gesamte App

// ============================================================================
// LOADING & UI FUNCTIONS
// ============================================================================

// Show loading spinner
function showLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.add('show');
    }
}

// Hide loading spinner
function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.remove('show');
    }
}

// Show notification - XSS PROTECTED
function showNotification(message, type = 'info', duration = 3000) {
    // Remove existing notifications
    document.querySelectorAll('.notification').forEach(n => n.remove());

    // Sanitize message to prevent XSS
    const sanitizedMessage = typeof DOMPurify !== 'undefined'
        ? DOMPurify.sanitize(message, { ALLOWED_TAGS: [] })
        : String(message).replace(/[<>]/g, '');

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    // Create elements safely without innerHTML
    const content = document.createElement('div');
    content.className = 'notification-content';

    const icon = document.createElement('span');
    icon.className = 'notification-icon';
    icon.textContent = getNotificationIcon(type);

    const text = document.createElement('span');
    text.className = 'notification-text';
    text.textContent = sanitizedMessage;

    content.appendChild(icon);
    content.appendChild(text);
    notification.appendChild(content);

    document.body.appendChild(notification);

    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    // Auto hide
    const hideTimeout = setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, duration);

    // Store timeout for cleanup
    notification._hideTimeout = hideTimeout;
}

// Get notification icon
function getNotificationIcon(type) {
    const icons = {
        'success': '✅',
        'error': '❌',
        'warning': '⚠️',
        'info': 'ℹ️'
    };
    return icons[type] || 'ℹ️';
}

// ============================================================================
// SANITIZATION HELPERS
// ============================================================================

// Sanitize user input (防XSS)
function sanitizeInput(input) {
    if (!input) return '';

    // If DOMPurify is available, use it
    if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
    }

    // Fallback: Basic HTML escaping
    return String(input)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

// Sanitize HTML for safe innerHTML usage
function sanitizeHTML(html) {
    if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(html);
    }

    // Fallback: Remove all HTML tags
    return String(html).replace(/<[^>]*>/g, '');
}

// ============================================================================
// MOBILE OPTIMIZATIONS
// ============================================================================

// Tracking für Event-Listener (Memory-Leak-Prevention)
const _eventListeners = [];

// Initialize mobile optimizations
function initMobileOptimizations() {
    // Prevent zoom on input focus (iOS)
    if (isMobile()) {
        const touchHandler = () => {};
        document.addEventListener('touchstart', touchHandler, true);
        _eventListeners.push({
            element: document,
            event: 'touchstart',
            handler: touchHandler
        });

        // Add viewport meta tag if not present
        if (!document.querySelector('meta[name="viewport"]')) {
            const meta = document.createElement('meta');
            meta.name = 'viewport';
            meta.content = 'width=device-width, initial-scale=1.0, user-scalable=no';
            document.head.appendChild(meta);
        }

        // Handle safe area insets
        handleSafeAreaInsets();

        // Handle orientation changes
        const orientationHandler = handleOrientationChange;
        window.addEventListener('orientationchange', orientationHandler);
        _eventListeners.push({
            element: window,
            event: 'orientationchange',
            handler: orientationHandler
        });

        // Prevent bounce scrolling on iOS
        const touchMoveHandler = function(e) {
            if (e.target === document.body) {
                e.preventDefault();
            }
        };
        document.body.addEventListener('touchmove', touchMoveHandler, { passive: false });
        _eventListeners.push({
            element: document.body,
            event: 'touchmove',
            handler: touchMoveHandler
        });
    }

    // Handle keyboard visibility
    handleVirtualKeyboard();
}

// Check if device is mobile
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Handle safe area insets (for devices with notches)
function handleSafeAreaInsets() {
    const root = document.documentElement;

    // Add CSS custom properties for safe areas
    root.style.setProperty('--safe-area-inset-top', 'env(safe-area-inset-top)');
    root.style.setProperty('--safe-area-inset-right', 'env(safe-area-inset-right)');
    root.style.setProperty('--safe-area-inset-bottom', 'env(safe-area-inset-bottom)');
    root.style.setProperty('--safe-area-inset-left', 'env(safe-area-inset-left)');
}

// Handle orientation changes
function handleOrientationChange() {
    // Force repaint to fix layout issues
    setTimeout(() => {
        window.scrollTo(0, 0);
    }, 100);
}

// Handle virtual keyboard
function handleVirtualKeyboard() {
    let initialViewportHeight = window.innerHeight;

    const resizeHandler = () => {
        const currentHeight = window.innerHeight;
        const heightDifference = initialViewportHeight - currentHeight;

        // If height decreased significantly, keyboard is probably open
        if (heightDifference > 150) {
            document.body.classList.add('keyboard-open');
        } else {
            document.body.classList.remove('keyboard-open');
        }
    };

    window.addEventListener('resize', resizeHandler);
    _eventListeners.push({
        element: window,
        event: 'resize',
        handler: resizeHandler
    });
}

// Cleanup event listeners (call on page unload)
function cleanupEventListeners() {
    _eventListeners.forEach(({ element, event, handler }) => {
        try {
            element.removeEventListener(event, handler);
        } catch (error) {
            console.warn('Error removing event listener:', error);
        }
    });
    _eventListeners.length = 0;
}

// ============================================================================
// ANIMATION HELPERS
// ============================================================================

// Add entrance animation to elements
function addEntranceAnimation(elements, delay = 100) {
    if (!elements || !elements.forEach) return;

    elements.forEach((element, index) => {
        if (!element) return;

        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';

        setTimeout(() => {
            element.style.transition = 'all 0.5s ease';
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        }, index * delay);
    });
}

// Animate element removal
function animateRemoval(element, callback) {
    if (!element) return;

    element.style.transition = 'all 0.3s ease';
    element.style.opacity = '0';
    element.style.transform = 'translateX(-20px)';

    setTimeout(() => {
        if (callback && typeof callback === 'function') {
            callback();
        }
    }, 300);
}

// Bounce animation
function bounceElement(element) {
    if (!element) return;

    element.style.transform = 'scale(1.1)';
    setTimeout(() => {
        element.style.transform = 'scale(1)';
    }, 150);
}

// ============================================================================
// FORM UTILITIES
// ============================================================================

// Validate player name
function validatePlayerName(name) {
    if (!name || typeof name !== 'string') {
        return { valid: false, message: 'Name ist erforderlich' };
    }

    const trimmedName = name.trim();

    if (trimmedName.length < 2) {
        return { valid: false, message: 'Name muss mindestens 2 Zeichen haben' };
    }

    if (trimmedName.length > 20) {
        return { valid: false, message: 'Name darf maximal 20 Zeichen haben' };
    }

    // Check for invalid characters (erlaubt: Buchstaben, Zahlen, Umlaute, Leerzeichen, Bindestrich, Unterstrich)
    if (!/^[a-zA-ZäöüÄÖÜß0-9\s\-_]+$/.test(trimmedName)) {
        return { valid: false, message: 'Name enthält ungültige Zeichen' };
    }

    return { valid: true, name: sanitizeInput(trimmedName) };
}

// Validate game ID
function validateGameId(gameId) {
    if (!gameId || typeof gameId !== 'string') {
        return { valid: false, message: 'Game ID ist erforderlich' };
    }

    const cleanId = gameId.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (cleanId.length !== 6) {
        return { valid: false, message: 'Game ID muss 6 Zeichen haben' };
    }

    return { valid: true, gameId: cleanId };
}

// Format game ID for display
function formatGameIdDisplay(gameId) {
    if (!gameId || gameId.length !== 6) return gameId;
    return gameId.substring(0, 3) + ' ' + gameId.substring(3);
}

// ============================================================================
// LOCAL STORAGE UTILITIES
// ============================================================================

// Safe localStorage get
function getLocalStorage(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.warn(`Error reading localStorage key "${key}":`, error);
        return defaultValue;
    }
}

// Safe localStorage set
function setLocalStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.warn(`Error writing localStorage key "${key}":`, error);
        return false;
    }
}

// Remove localStorage item
function removeLocalStorage(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.warn(`Error removing localStorage key "${key}":`, error);
        return false;
    }
}

// Clear all app-related storage
function clearAppStorage() {
    try {
        // Remove all nocap_* keys
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('nocap_')) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => localStorage.removeItem(key));

        console.log(`✅ Cleared ${keysToRemove.length} storage items`);
        return true;
    } catch (error) {
        console.error('Error clearing app storage:', error);
        return false;
    }
}

// ============================================================================
// GAME UTILITIES
// ============================================================================

// Calculate sips based on difference and difficulty
function calculateSips(difference, difficulty = 'medium') {
    const baseValues = {
        'easy': 1,
        'medium': 2,
        'hard': 3
    };

    const base = baseValues[difficulty] || 2;
    return difference === 0 ? 0 : base + Math.abs(difference);
}

// Generate random game ID
function generateGameId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < 6; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

// Shuffle array
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// ============================================================================
// CATEGORY & DIFFICULTY INFO
// ============================================================================

// Get category information
function getCategoryInfo(categoryId) {
    const categories = {
        'fsk0': {
            id: 'fsk0',
            name: 'Familie & Freunde',
            icon: '👨‍👩‍👧‍👦',
            color: '#4CAF50',
            description: 'Harmlose Fragen für alle'
        },
        'fsk16': {
            id: 'fsk16',
            name: 'Party & Frech',
            icon: '🎉',
            color: '#FF9800',
            description: 'Lustige Party-Fragen'
        },
        'fsk18': {
            id: 'fsk18',
            name: 'Intim & Tabu',
            icon: '🔞',
            color: '#F44336',
            description: 'Nur für Erwachsene'
        },
        'special': {
            id: 'special',
            name: 'Special Edition',
            icon: '⭐',
            color: '#9C27B0',
            description: 'Premium Inhalte'
        }
    };

    return categories[categoryId] || {
        id: categoryId,
        name: 'Unbekannt',
        icon: '❓',
        color: '#9E9E9E',
        description: 'Unbekannte Kategorie'
    };
}

// Get difficulty information
function getDifficultyInfo(difficultyId) {
    const difficulties = {
        'easy': {
            id: 'easy',
            name: 'Entspannt',
            emoji: '🍺',
            description: '1 Schluck + Abweichung',
            baseSips: 1,
            color: '#4CAF50'
        },
        'medium': {
            id: 'medium',
            name: 'Normal',
            emoji: '🍺🍺',
            description: '2 Schlücke + Abweichung',
            baseSips: 2,
            color: '#FF9800'
        },
        'hard': {
            id: 'hard',
            name: 'Hardcore',
            emoji: '🍺🍺🍺',
            description: '3 Schlücke + Abweichung',
            baseSips: 3,
            color: '#F44336'
        }
    };

    return difficulties[difficultyId] || {
        id: difficultyId,
        name: 'Unbekannt',
        emoji: '❓',
        description: 'Unbekannte Schwierigkeit',
        baseSips: 2,
        color: '#9E9E9E'
    };
}

// ============================================================================
// NETWORK UTILITIES
// ============================================================================

// Check if user is online
function isOnline() {
    return navigator.onLine;
}

// Add network status listeners
function initNetworkListeners() {
    const onlineHandler = () => {
        showNotification('Verbindung wiederhergestellt', 'success');
        document.body.classList.remove('offline');
    };

    const offlineHandler = () => {
        showNotification('Keine Internetverbindung', 'warning');
        document.body.classList.add('offline');
    };

    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);

    _eventListeners.push({ element: window, event: 'online', handler: onlineHandler });
    _eventListeners.push({ element: window, event: 'offline', handler: offlineHandler });

    // Initial check
    if (!isOnline()) {
        document.body.classList.add('offline');
    }
}

// ============================================================================
// TIME UTILITIES
// ============================================================================

// Format timestamp for display
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
        return 'Gerade eben';
    } else if (diffMins < 60) {
        return `Vor ${diffMins} Min`;
    } else if (diffHours < 24) {
        return `Vor ${diffHours} Std`;
    } else if (diffDays < 7) {
        return `Vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`;
    } else {
        return date.toLocaleDateString('de-DE');
    }
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Global error handler
function setupErrorHandling() {
    const errorHandler = (event) => {
        console.error('Global error:', event.error);

        // Don't show notifications for script loading errors
        if (event.filename && event.filename.includes('.js')) {
            return;
        }

        showNotification('Ein unerwarteter Fehler ist aufgetreten', 'error');
    };

    const rejectionHandler = (event) => {
        console.error('Unhandled promise rejection:', event.reason);

        // Handle specific Firebase errors
        if (event.reason && event.reason.code) {
            const message = getFirebaseErrorMessage(event.reason.code);
            showNotification(message, 'error');
        } else {
            showNotification('Verbindungsfehler aufgetreten', 'error');
        }
    };

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectionHandler);

    _eventListeners.push({ element: window, event: 'error', handler: errorHandler });
    _eventListeners.push({ element: window, event: 'unhandledrejection', handler: rejectionHandler });
}

// Get user-friendly Firebase error messages
function getFirebaseErrorMessage(errorCode) {
    const messages = {
        'permission-denied': 'Keine Berechtigung für diese Aktion',
        'unavailable': 'Service momentan nicht verfügbar',
        'network-request-failed': 'Netzwerkfehler - Prüfe deine Internetverbindung',
        'timeout': 'Zeitüberschreitung - Versuche es erneut',
        'cancelled': 'Vorgang wurde abgebrochen',
        'already-exists': 'Eintrag existiert bereits',
        'not-found': 'Nicht gefunden',
        'failed-precondition': 'Voraussetzungen nicht erfüllt'
    };

    return messages[errorCode] || 'Ein Fehler ist aufgetreten';
}

// ============================================================================
// PERFORMANCE UTILITIES
// ============================================================================

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// ============================================================================
// ACCESSIBILITY UTILITIES
// ============================================================================

// Focus management
function trapFocus(element) {
    if (!element) return;

    const focusableElements = element.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    const keydownHandler = (e) => {
        if (e.key === 'Tab') {
            if (e.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    lastFocusable.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === lastFocusable) {
                    firstFocusable.focus();
                    e.preventDefault();
                }
            }
        }

        if (e.key === 'Escape') {
            element.dispatchEvent(new CustomEvent('modal-close'));
        }
    };

    element.addEventListener('keydown', keydownHandler);

    // Focus first element
    if (firstFocusable) {
        firstFocusable.focus();
    }
}

// Announce to screen readers
function announceToScreenReader(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';

    document.body.appendChild(announcement);
    announcement.textContent = sanitizeInput(message);

    setTimeout(() => {
        if (document.body.contains(announcement)) {
            document.body.removeChild(announcement);
        }
    }, 1000);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize utilities when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUtils);
} else {
    initializeUtils();
}

function initializeUtils() {
    setupErrorHandling();
    initNetworkListeners();

    // Add common keyboard shortcuts
    const escapeHandler = (e) => {
        // Escape key closes modals
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(modal => {
                if (modal.style.display === 'flex') {
                    modal.style.display = 'none';
                }
            });
        }
    };

    document.addEventListener('keydown', escapeHandler);
    _eventListeners.push({ element: document, event: 'keydown', handler: escapeHandler });

    console.log('✅ No-Cap Utils v2.0 initialized');
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    cleanupEventListeners();

    // Clear notification timeouts
    document.querySelectorAll('.notification').forEach(n => {
        if (n._hideTimeout) {
            clearTimeout(n._hideTimeout);
        }
    });
});

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

// Export functions for use in other scripts
if (typeof window !== 'undefined') {
    window.NocapUtils = {
        // UI
        showLoading,
        hideLoading,
        showNotification,

        // Security
        sanitizeInput,
        sanitizeHTML,

        // Mobile
        initMobileOptimizations,
        isMobile,

        // Validation
        validatePlayerName,
        validateGameId,
        formatGameIdDisplay,

        // Storage
        getLocalStorage,
        setLocalStorage,
        removeLocalStorage,
        clearAppStorage,

        // Game
        calculateSips,
        generateGameId,
        shuffleArray,
        getCategoryInfo,
        getDifficultyInfo,

        // Network
        isOnline,

        // Time
        formatTimestamp,

        // Performance
        debounce,
        throttle,

        // Accessibility
        trapFocus,
        announceToScreenReader,

        // Animation
        addEntranceAnimation,
        animateRemoval,
        bounceElement,

        // Cleanup
        cleanupEventListeners
    };

    console.log('✅ NocapUtils exported to window.NocapUtils');
}