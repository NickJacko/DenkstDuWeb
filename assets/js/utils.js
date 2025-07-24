// DenkstDu - Utility Functions
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

// Show notification
function showNotification(message, type = 'info', duration = 3000) {
    // Remove existing notifications
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${getNotificationIcon(type)}</span>
            <span class="notification-text">${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Auto hide
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, duration);
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
// MOBILE OPTIMIZATIONS
// ============================================================================

// Initialize mobile optimizations
function initMobileOptimizations() {
    // Prevent zoom on input focus (iOS)
    if (isMobile()) {
        document.addEventListener('touchstart', {}, true);
        
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
        window.addEventListener('orientationchange', handleOrientationChange);
        
        // Prevent bounce scrolling on iOS
        document.body.addEventListener('touchmove', function(e) {
            if (e.target === document.body) {
                e.preventDefault();
            }
        }, { passive: false });
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
    
    window.addEventListener('resize', () => {
        const currentHeight = window.innerHeight;
        const heightDifference = initialViewportHeight - currentHeight;
        
        // If height decreased significantly, keyboard is probably open
        if (heightDifference > 150) {
            document.body.classList.add('keyboard-open');
        } else {
            document.body.classList.remove('keyboard-open');
        }
    });
}

// ============================================================================
// ANIMATION HELPERS
// ============================================================================

// Add entrance animation to elements
function addEntranceAnimation(elements, delay = 100) {
    elements.forEach((element, index) => {
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
    element.style.transition = 'all 0.3s ease';
    element.style.opacity = '0';
    element.style.transform = 'translateX(-20px)';
    
    setTimeout(() => {
        if (callback) callback();
    }, 300);
}

// Bounce animation
function bounceElement(element) {
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
    
    // Check for invalid characters
    if (!/^[a-zA-ZäöüÄÖÜß0-9\s\-_]+$/.test(trimmedName)) {
        return { valid: false, message: 'Name enthält ungültige Zeichen' };
    }
    
    return { valid: true, name: trimmedName };
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

// Clear all app-related localStorage
function clearAppStorage() {
    try {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('denkstdu_')) {
                localStorage.removeItem(key);
            }
        });
        return true;
    } catch (error) {
        console.warn('Error clearing app storage:', error);
        return false;
    }
}

// ============================================================================
// GAME UTILITIES
// ============================================================================

// Calculate sips based on estimation and actual count
function calculateSips(estimation, actualCount, difficulty = 'medium') {
    const difference = Math.abs(estimation - actualCount);
    
    if (difference === 0) {
        return 0; // Perfect guess
    }
    
    const baseSips = {
        'easy': 1,
        'medium': 2,
        'hard': 3
    };
    
    return (baseSips[difficulty] || 2) + difference;
}

// Generate random game ID
function generateGameId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Shuffle array
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Get category display info
function getCategoryInfo(categoryId) {
    const categories = {
        'fsk0': {
            id: 'fsk0',
            name: 'Familie & Freunde',
            emoji: '👨‍👩‍👧‍👦',
            description: 'Harmlose Fragen für alle Altersgruppen',
            color: '#4CAF50'
        },
        'fsk16': {
            id: 'fsk16',
            name: 'Party Time',
            emoji: '🎉',
            description: 'Unterhaltsame und lustige Fragen',
            color: '#FF9800'
        },
        'fsk18': {
            id: 'fsk18',
            name: 'Heiß & Gewagt',
            emoji: '🔥',
            description: 'Nur für Erwachsene',
            color: '#F44336'
        }
    };
    
    return categories[categoryId] || {
        id: categoryId,
        name: 'Unbekannt',
        emoji: '❓',
        description: 'Unbekannte Kategorie',
        color: '#9E9E9E'
    };
}

// Get difficulty display info
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
            name: 'Standard',
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
    window.addEventListener('online', () => {
        showNotification('Verbindung wiederhergestellt', 'success');
        document.body.classList.remove('offline');
    });
    
    window.addEventListener('offline', () => {
        showNotification('Keine Internetverbindung', 'warning');
        document.body.classList.add('offline');
    });
    
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
    window.addEventListener('error', (event) => {
        console.error('Global error:', event.error);
        
        // Don't show notifications for script loading errors
        if (event.filename && event.filename.includes('.js')) {
            return;
        }
        
        showNotification('Ein unerwarteter Fehler ist aufgetreten', 'error');
    });
    
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        
        // Handle specific Firebase errors
        if (event.reason && event.reason.code) {
            const message = getFirebaseErrorMessage(event.reason.code);
            showNotification(message, 'error');
        } else {
            showNotification('Verbindungsfehler aufgetreten', 'error');
        }
    });
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
    const focusableElements = element.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    
    element.addEventListener('keydown', (e) => {
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
    });
    
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
    announcement.textContent = message;
    
    setTimeout(() => {
        document.body.removeChild(announcement);
    }, 1000);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize utilities when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setupErrorHandling();
    initNetworkListeners();
    
    // Add common keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape key closes modals
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(modal => {
                if (modal.style.display === 'flex') {
                    modal.style.display = 'none';
                }
            });
        }
    });
});

// Export functions for use in other scripts
if (typeof window !== 'undefined') {
    window.DenkstDuUtils = {
        showLoading,
        hideLoading,
        showNotification,
        initMobileOptimizations,
        validatePlayerName,
        validateGameId,
        formatGameIdDisplay,
        getLocalStorage,
        setLocalStorage,
        removeLocalStorage,
        clearAppStorage,
        calculateSips,
        generateGameId,
        shuffleArray,
        getCategoryInfo,
        getDifficultyInfo,
        isOnline,
        formatTimestamp,
        debounce,
        throttle,
        trapFocus,
        announceToScreenReader
    };
}