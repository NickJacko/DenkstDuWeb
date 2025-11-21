/**
 * No-Cap Multiplayer Category Selection
 * Version: 8.1 - Security Hardened with XSS Protection & Encoding Fixed
 */

'use strict';

// SECURITY NOTE: All innerHTML usages protected by DOMPurify
// - Line ~375: grid.innerHTML = '' - SAFE (clearing)
// - Line ~394: card.innerHTML with DOMPurify.sanitize() - SAFE
// - Line ~459: list.innerHTML with DOMPurify.sanitize() - SAFE

// ===== FIREBASE SERVICE CLASS =====
class FirebaseGameService {
    constructor() {
        this.app = null;
        this.auth = null;
        this.database = null;
        this.isInitialized = false;
        this.isConnected = false;
        this.currentGameId = null;
        this.listeners = [];

        this.config = {
            apiKey: "AIzaSyC_cu_2X2uFCPcxYetxIUHi2v56F1Mz0Vk",
            authDomain: "denkstduwebsite.firebaseapp.com",
            databaseURL: "https://denkstduwebsite-default-rtdb.europe-west1.firebasedatabase.app",
            projectId: "denkstduwebsite",
            storageBucket: "denkstduwebsite.appspot.com",
            messagingSenderId: "27029260611",
            appId: "1:27029260611:web:3c7da4db0bf92e8ce247f6",
            measurementId: "G-BNKNW95HK8"
        };
    }

    async initialize() {
        try {
            this.log('🔥 Firebase Service - Initialisierung...');

            if (typeof firebase === 'undefined') {
                throw new Error('Firebase SDK nicht geladen');
            }

            if (!firebase.apps || firebase.apps.length === 0) {
                this.app = firebase.initializeApp(this.config);
            } else {
                this.app = firebase.app();
            }

            this.log('🔐 Starte anonyme Authentifizierung...');
            this.auth = firebase.auth();

            try {
                await this.auth.signInAnonymously();
                this.log('✅ Anonym angemeldet');
            } catch (authError) {
                this.log(`❌ Auth Fehler: ${authError.message}`, 'error');
                throw authError;
            }

            this.database = firebase.database();
            this.log('🔗 Warte auf Datenbankverbindung...');

            let connected = false;
            let attempts = 0;

            while (!connected && attempts < 10) {
                await new Promise(resolve => setTimeout(resolve, 500));

                try {
                    const connectedRef = this.database.ref('.info/connected');
                    const snapshot = await connectedRef.once('value');
                    connected = snapshot.val() === true;

                    if (connected) {
                        this.log('✅ Datenbankverbindung hergestellt!');
                    } else {
                        attempts++;
                        this.log(`🔄 Verbindungsversuch ${attempts}/10...`);
                    }
                } catch (error) {
                    attempts++;
                }
            }

            this.isConnected = connected;
            this.isInitialized = connected;

            if (this.isConnected) {
                this.log('✅ Firebase vollständig verbunden!');
            } else {
                this.log('❌ Firebase Verbindung fehlgeschlagen');
            }

            return this.isInitialized;

        } catch (error) {
            this.log(`❌ Firebase Fehler: ${error.message}`, 'error');
            this.isInitialized = false;
            this.isConnected = false;
            return false;
        }
    }

    async createGame(settings) {
        if (!this.isConnected) throw new Error('Not connected');

        const gameId = this.generateGameCode();
        const userId = this.auth.currentUser?.uid;

        const gameData = {
            gameId,
            hostId: userId,
            settings,
            players: {
                [userId]: {
                    id: userId,
                    name: gameState.playerName || 'Host',
                    isHost: true,
                    isReady: false,
                    joinedAt: Date.now()
                }
            },
            status: 'lobby',
            createdAt: Date.now()
        };

        await this.database.ref(`games/${gameId}`).set(gameData);
        this.currentGameId = gameId;
        this.log(`✅ Spiel erstellt: ${gameId}`);

        return gameId;
    }

    generateGameCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    }

    cleanup() {
        this.log('🧹 Cleanup...');
        this.listeners.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                try {
                    unsubscribe();
                } catch (e) {
                    this.log(`Cleanup error: ${e.message}`, 'error');
                }
            }
        });
        this.listeners = [];
    }

    log(message, type = 'info') {
        const colors = { info: '#4488ff', warning: '#ffaa00', error: '#ff4444', success: '#00ff00' };
        console.log(`%c[FirebaseService] ${message}`, `color: ${colors[type] || colors.info}`);
    }
}

// ===== CATEGORY DATA =====
const categoryData = {
    fsk0: {
        name: 'Familie & Freunde', icon: '👨‍👩‍👧‍👦', color: '#4CAF50', fsk: 'FSK 0', ageRange: 'Ab 0 Jahren',
        description: 'Lustige und harmlose Fragen für die ganze Familie',
        examples: ['...gemeinsam mit der Familie verreist?', '...im Supermarkt etwas vergessen?']
    },
    fsk16: {
        name: 'Party Time', icon: '🎉', color: '#FF9800', fsk: 'FSK 16', ageRange: 'Ab 16 Jahren',
        description: 'Freche und witzige Fragen für Partys mit Freunden',
        examples: ['...auf einer Party eingeschlafen?', '...den Namen vergessen?']
    },
    fsk18: {
        name: 'Heiß & Gewagt', icon: '🔥', color: '#F44336', fsk: 'FSK 18', ageRange: 'Nur Erwachsene',
        description: 'Intime und pikante Fragen nur für Erwachsene',
        examples: ['...an einem öffentlichen Ort...?', '...mit jemandem...?']
    },
    special: {
        name: 'Special Edition', icon: '⭐', color: '#FFD700', fsk: 'Premium', ageRange: 'Exklusiv',
        description: 'Exklusive Premium-Fragen für besondere Momente',
        examples: ['Premium Inhalte', 'Exklusive Fragen']
    }
};

// ===== GLOBAL STATE =====
let gameState = null;
let firebaseService = null;
let selectedCategories = [];
let isAdult = false;
let hasPremium = false;
let questionCounts = { fsk0: 200, fsk16: 300, fsk18: 250, special: 150 };

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', init);

async function init() {
    log('🌐 Init...');

    if (typeof GameState === 'undefined') {
        showNotification('Fehler beim Laden', 'error');
        return;
    }

    if (typeof DOMPurify === 'undefined') {
        console.error('SECURITY: DOMPurify not loaded!');
        showNotification('Sicherheitsmodul fehlt', 'error');
        return;
    }

    gameState = GameState.load();

    if (!validateGameState()) return;

    firebaseService = new FirebaseGameService();
    const connected = await firebaseService.initialize();

    if (!connected) {
        showNotification('Firebase Verbindung fehlgeschlagen', 'error');
        setTimeout(() => window.location.href = 'index.html', 3000);
        return;
    }

    checkAgeVerification();
    await checkPremiumStatus();
    await loadQuestionCounts();
    renderCategoryCards();
    setupEventListeners();

    if (gameState.selectedCategories) {
        selectedCategories = [...gameState.selectedCategories];
        selectedCategories.forEach(key => {
            const card = document.querySelector(`[data-category="${key}"]`);
            if (card && !card.classList.contains('locked')) {
                card.classList.add('selected');
            }
        });
        updateSelectionSummary();
    }

    log('✅ Initialized');
}

// ===== VALIDATION =====
function validateGameState() {
    log('🔍 Validating game state...');

    if (!gameState || gameState.deviceMode !== 'multi') {
        showNotification('Falscher Spielmodus', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return false;
    }

    if (!gameState.playerName || gameState.playerName.trim() === '') {
        showNotification('Kein Spielername gesetzt', 'error');
        setTimeout(() => window.location.href = 'multiplayer-lobby.html', 2000);
        return false;
    }

    log('✅ Game state valid');
    return true;
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    const backBtn = document.querySelector('.back-button');
    const proceedBtn = document.getElementById('proceed-button');

    if (backBtn) backBtn.addEventListener('click', goBack);
    if (proceedBtn) proceedBtn.addEventListener('click', proceed);

    log('✅ Event listeners setup');
}

// ===== AGE & PREMIUM =====
function checkAgeVerification() {
    try {
        const ageData = localStorage.getItem('nocap_age_verification');
        if (ageData) {
            const verification = JSON.parse(ageData);
            isAdult = verification.isAdult || false;
            log(isAdult ? '✅ FSK 18 unlocked' : '🔒 FSK 18 locked');
        }
    } catch (error) {
        log(`Age verification error: ${error.message}`, 'error');
    }
}

async function checkPremiumStatus() {
    try {
        if (!firebaseService.isConnected || !firebaseService.auth.currentUser) return;

        const userId = firebaseService.auth.currentUser.uid;
        const purchaseRef = firebaseService.database.ref(`users/${userId}/purchases/special`);
        const snapshot = await purchaseRef.once('value');

        hasPremium = snapshot.exists();
        log(hasPremium ? '✅ Premium unlocked' : '🔒 Premium locked');
    } catch (error) {
        log(`Premium check error: ${error.message}`, 'warning');
    }
}

async function loadQuestionCounts() {
    try {
        const questionsRef = firebaseService.database.ref('questions');
        const snapshot = await questionsRef.once('value');

        if (snapshot.exists()) {
            const questions = snapshot.val();
            Object.keys(categoryData).forEach(key => {
                if (questions[key] && Array.isArray(questions[key])) {
                    questionCounts[key] = questions[key].length;
                }
            });
        }
    } catch (error) {
        log(`Question counts error: ${error.message}`, 'warning');
    }
}

// ===== RENDER CARDS =====
function renderCategoryCards() {
    const grid = document.getElementById('categories-grid');
    if (!grid) return;

    grid.innerHTML = '';

    Object.entries(categoryData).forEach(([key, cat]) => {
        const card = document.createElement('div');
        card.className = 'category-card';
        card.dataset.category = key;

        const locked = (key === 'fsk18' && !isAdult) || (key === 'special' && !hasPremium);
        if (locked) card.classList.add('locked');

        let overlay = '';
        if (key === 'fsk18' && !isAdult) {
            overlay = '<div class="locked-overlay"><div class="lock-icon">🔒</div><p class="lock-message">Nur für Erwachsene (18+)</p></div>';
        } else if (key === 'special' && !hasPremium) {
            overlay = '<div class="premium-badge">👑 PREMIUM</div><div class="locked-overlay"><div class="lock-icon">🔒</div><p class="lock-message">Premium Inhalt</p><button class="unlock-btn" data-premium-unlock>💎 Freischalten</button></div>';
        }

        const examples = cat.examples.map(ex => `<div class="example-question">${DOMPurify.sanitize(ex)}</div>`).join('');

        // SECURITY: DOMPurify.sanitize() protects all dynamic content
        card.innerHTML = DOMPurify.sanitize(`
            ${overlay}
            <div class="category-header">
                <div class="category-icon">${cat.icon}</div>
                <div class="fsk-badge ${key}-badge">${cat.fsk}</div>
            </div>
            <h3 class="category-title">${cat.name}</h3>
            <p class="category-description">${cat.description}</p>
            <div class="category-examples"><div class="example-questions">${examples}</div></div>
            <div class="category-footer">
                <span class="age-range">${cat.ageRange}</span>
                <span class="question-count">~${questionCounts[key]} Fragen</span>
            </div>
        `, {
            ALLOWED_TAGS: ['div', 'h3', 'p', 'span', 'button'],
            ALLOWED_ATTR: ['class', 'data-premium-unlock']
        });

        if (!locked) {
            card.addEventListener('click', () => toggleCategory(key));
        } else if (key === 'fsk18') {
            card.addEventListener('click', () => showNotification('Du musst 18+ sein', 'warning'));
        } else if (key === 'special') {
            card.addEventListener('click', e => {
                if (e.target.closest('[data-premium-unlock]')) {
                    e.stopPropagation();
                    showPremiumInfo();
                }
            });
        }

        grid.appendChild(card);
    });

    log('✅ Cards rendered');
}

// ===== CATEGORY SELECTION =====
function toggleCategory(key) {
    const card = document.querySelector(`[data-category="${key}"]`);
    if (!card || card.classList.contains('locked')) return;

    if (selectedCategories.includes(key)) {
        selectedCategories = selectedCategories.filter(c => c !== key);
        card.classList.remove('selected');
    } else {
        selectedCategories.push(key);
        card.classList.add('selected');
    }

    updateSelectionSummary();
    gameState.selectedCategories = selectedCategories;
    gameState.save();
    syncWithFirebase();
}

function updateSelectionSummary() {
    const summary = document.getElementById('selection-summary');
    const title = document.getElementById('summary-title');
    const list = document.getElementById('selected-categories');
    const total = document.getElementById('total-questions');
    const btn = document.getElementById('proceed-button');

    if (selectedCategories.length > 0) {
        summary.classList.add('show');
        btn.classList.add('enabled');

        title.textContent = `${selectedCategories.length} Kategorie${selectedCategories.length > 1 ? 'n' : ''} ausgewählt`;

        // SECURITY: DOMPurify.sanitize() on each item
        list.innerHTML = selectedCategories.map(c => {
            const d = categoryData[c];
            return DOMPurify.sanitize(`<div class="selected-category-tag"><span>${d.icon}</span><span>${d.name}</span></div>`);
        }).join('');

        const totalQ = selectedCategories.reduce((sum, c) => sum + questionCounts[c], 0);
        total.textContent = totalQ;
    } else {
        summary.classList.remove('show');
        btn.classList.remove('enabled');
    }
}

async function syncWithFirebase() {
    if (!firebaseService.currentGameId) return;

    try {
        await firebaseService.database.ref(`games/${firebaseService.currentGameId}/settings/categories`)
            .set(selectedCategories);
    } catch (error) {
        log(`Sync error: ${error.message}`, 'error');
    }
}

// ===== NAVIGATION =====
function proceed() {
    if (selectedCategories.length === 0) {
        showNotification('Wähle mindestens eine Kategorie', 'warning');
        return;
    }

    gameState.selectedCategories = selectedCategories;
    gameState.save();

    showNotification('Kategorien gespeichert!', 'success');
    setTimeout(() => {
        window.location.href = 'multiplayer-difficulty-selection.html';
    }, 500);
}

function goBack() {
    if (firebaseService) {
        firebaseService.cleanup();
    }
    window.location.href = 'multiplayer-lobby.html';
}

// ===== PREMIUM =====
function showPremiumInfo() {
    showNotification('Premium-Funktion kommt bald!', 'info');
}

// ===== UTILITIES =====
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const sanitizedMessage = String(message).replace(/<[^>]*>/g, '');
    notification.textContent = sanitizedMessage;

    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function log(message, type = 'info') {
    const colors = { info: '#4488ff', warning: '#ffaa00', error: '#ff4444', success: '#00ff00' };
    console.log(`%c[MultiCategorySelect] ${message}`, `color: ${colors[type] || colors.info}`);
}

// ===== DEBUG =====
window.debugMultiCategorySelection = function() {
    console.log('🔍 === MULTI CATEGORY SELECTION DEBUG ===');
    console.log('GameState:', gameState?.getDebugInfo?.());
    console.log('Selected:', selectedCategories);
    console.log('isAdult:', isAdult);
    console.log('hasPremium:', hasPremium);
    console.log('Firebase:', {
        initialized: firebaseService?.isInitialized,
        connected: firebaseService?.isConnected
    });
};

log('✅ Multiplayer Category Selection v8.1 - Loaded!');