/**
 * No-Cap Multiplayer Category Selection
 * Handles category selection for multiplayer games with Firebase sync
 *
 * @version 8.0.0
 * @requires GameState.js
 * @requires Firebase SDK
 * @requires DOMPurify
 */

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

    async createGame(gameData) {
        if (!this.isConnected) return null;

        try {
            const gameId = gameData.gameId || this.generateGameId();
            const hostPlayerId = this.generatePlayerId(gameData.hostName, true);

            const gameObject = {
                gameId: gameId,
                gameState: 'lobby',
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP,
                categories: gameData.categories || [],
                difficulty: gameData.difficulty || 'medium',
                maxPlayers: 8,
                currentRound: 0,
                hostId: hostPlayerId,

                players: {
                    [hostPlayerId]: {
                        id: hostPlayerId,
                        name: gameData.hostName,
                        isHost: true,
                        isReady: true,
                        isOnline: true,
                        joinedAt: firebase.database.ServerValue.TIMESTAMP
                    }
                },

                settings: {
                    questionsPerGame: 10,
                    timePerQuestion: 30,
                    showResults: true,
                    allowSpectators: false
                }
            };

            const gameRef = this.database.ref(`games/${gameId}`);
            await gameRef.set(gameObject);

            this.currentGameId = gameId;
            this.log(`✅ Spiel erstellt: ${gameId}`);

            return { gameId, playerId: hostPlayerId, gameRef };

        } catch (error) {
            this.log(`❌ Fehler beim Erstellen: ${error.message}`, 'error');
            return null;
        }
    }

    generateGameId() {
        return Math.random().toString(36).substr(2, 6).toUpperCase();
    }

    generatePlayerId(playerName, isHost = false) {
        const prefix = isHost ? 'host' : 'guest';
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 4);
        const safeName = playerName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        return `${prefix}_${safeName}_${timestamp}_${random}`;
    }

    cleanup() {
        this.log('🧹 Cleanup...');
        this.listeners.forEach(({ ref }) => {
            try {
                ref.off();
            } catch (error) {}
        });
        this.listeners = [];
        this.currentGameId = null;
    }

    get isReady() {
        return this.isInitialized && this.isConnected;
    }

    log(message, type = 'info') {
        const colors = { info: '#4488ff', warning: '#ffaa00', error: '#ff4444', success: '#00ff00' };
        console.log(`%c[Firebase] ${message}`, `color: ${colors[type] || colors.info}`);
    }
}

// ===== GLOBAL VARIABLES =====
let gameState = null;
let firebaseService = null;
let selectedCategories = [];
let isAdult = false;
let hasPremium = false;
let questionCounts = { fsk0: 0, fsk16: 0, fsk18: 0, special: 0 };

const categoryData = {
    fsk0: {
        name: 'Familie & Freunde', icon: '👨‍👩‍👧‍👦', color: '#4CAF50', fsk: 'FSK 0', ageRange: 'Ab 0 Jahren',
        description: 'Harmlose und lustige Fragen für alle Altersgruppen.',
        examples: ['"Warst du schon mal im Ausland?"', '"Hast du schon mal ein Buch zu Ende gelesen?"', '"Warst du schon mal auf einem Konzert?"']
    },
    fsk16: {
        name: 'Party Time', icon: '🎉', color: '#FF9800', fsk: 'FSK 16', ageRange: 'Ab 16 Jahren',
        description: 'Etwas frechere Fragen für Jugendliche und junge Erwachsene.',
        examples: ['"Hattest du schon mal einen Kater?"', '"Hast du schon mal bei einer Prüfung geschummelt?"', '"Warst du schon mal heimlich verliebt?"']
    },
    fsk18: {
        name: 'Heiß & Gewagt', icon: '🔥', color: '#F44336', fsk: 'FSK 18', ageRange: 'Nur Erwachsene',
        description: 'Intime und tabulos Fragen nur für Erwachsene.',
        examples: ['"Hattest du schon mal einen One-Night-Stand?"', '"Hast du schon mal etwas Illegales gemacht?"', '"Warst du schon mal in jemand anderem verliebt?"']
    },
    special: {
        name: 'Special Edition', icon: '⭐', color: '#FFD700', fsk: 'SPECIAL', ageRange: 'Premium Only',
        description: 'Exklusive und einzigartige Fragen für besondere Momente.',
        examples: ['"Würdest du für 1 Million € auf Social Media verzichten?"', '"Hast du schon mal jemanden geghostet?"', '"Würdest du lieber Zeit- oder Gedankenreisen können?"']
    }
};

// ===== GUARDS & VALIDATION =====
function validateGameState() {
    log('🔍 Validating game state...');

    if (!gameState.deviceMode || gameState.deviceMode !== 'multi') {
        log('❌ Invalid device mode', 'error');
        showNotification('Kein Multiplayer-Modus aktiv!', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return false;
    }

    const ageVerification = localStorage.getItem('nocap_age_verification');
    if (!ageVerification) {
        log('⚠️ Age verification missing', 'warning');
        showNotification('Altersverifizierung erforderlich!', 'warning');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return false;
    }

    log('✅ Game state valid');
    return true;
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', initMultiplayerCategorySelection);

async function initMultiplayerCategorySelection() {
    log('🌐 Init...');
    showLoading();

    try {
        if (typeof GameState === 'undefined') {
            log('❌ GameState not loaded', 'error');
            showNotification('Fehler beim Laden', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }

        gameState = new GameState();
        firebaseService = new FirebaseGameService();

        if (!validateGameState()) {
            hideLoading();
            return;
        }

        await firebaseService.initialize();

        if (!gameState.isHost) {
            gameState.isHost = true;
            gameState.save();
        }

        if (!gameState.gameId) {
            gameState.gameId = Math.random().toString(36).substr(2, 6).toUpperCase();
            gameState.save();
        }

        checkAgeVerification();
        await checkPremiumStatus();
        await loadQuestionCounts();
        renderCategoryCards();
        setupEventListeners();

        hideLoading();

        if (!gameState.playerName || !gameState.playerName.trim()) {
            showHostNameModal();
        } else {
            await continueWithExistingName();
        }

    } catch (error) {
        log(`❌ Init failed: ${error.message}`, 'error');
        showNotification('Initialisierungsfehler', 'error');
        hideLoading();
    }
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    document.getElementById('back-button')?.addEventListener('click', goBack);
    document.getElementById('proceed-button')?.addEventListener('click', proceedWithCategories);

    const nameInput = document.getElementById('host-name-input');
    if (nameInput) {
        nameInput.addEventListener('input', validateHostName);
        nameInput.addEventListener('keypress', e => {
            if (e.key === 'Enter' && !document.getElementById('confirm-name-btn').disabled) {
                confirmHostName();
            }
        });
    }

    document.getElementById('confirm-name-btn')?.addEventListener('click', confirmHostName);
    document.getElementById('cancel-name-btn')?.addEventListener('click', goBack);
    document.getElementById('close-premium-btn')?.addEventListener('click', closePremiumModal);
    document.getElementById('later-premium-btn')?.addEventListener('click', closePremiumModal);
    document.getElementById('purchase-premium-btn')?.addEventListener('click', purchasePremium);

    log('✅ Event listeners setup');
}

// ===== AGE & PREMIUM =====
function checkAgeVerification() {
    try {
        const verification = localStorage.getItem('nocap_age_verification');
        if (verification) {
            isAdult = JSON.parse(verification).isAdult || false;
            log(isAdult ? '✅ FSK 18 unlocked' : '🔒 FSK 18 locked');
        }
    } catch (error) {
        log(`❌ Age check error: ${error.message}`, 'error');
    }
}

async function checkPremiumStatus() {
    try {
        if (!firebaseService.isReady) return;

        const userId = firebaseService.auth.currentUser?.uid;
        if (!userId) return;

        const snapshot = await firebaseService.database.ref(`users/${userId}/purchases/special`).once('value');
        hasPremium = snapshot.exists();
        log(hasPremium ? '✅ Premium unlocked' : '🔒 Premium locked');
    } catch (error) {
        log(`❌ Premium check error: ${error.message}`, 'error');
    }
}

async function loadQuestionCounts() {
    const fallback = { fsk0: 200, fsk16: 300, fsk18: 250, special: 150 };

    if (!firebaseService.isReady) {
        Object.assign(questionCounts, fallback);
        return;
    }

    for (const cat of Object.keys(fallback)) {
        try {
            const snapshot = await firebaseService.database.ref(`questions/${cat}`).once('value');
            questionCounts[cat] = snapshot.exists() ? Object.keys(snapshot.val()).length : fallback[cat];
        } catch {
            questionCounts[cat] = fallback[cat];
        }
    }

    const specialEl = document.getElementById('special-question-count');
    if (specialEl) specialEl.textContent = `${questionCounts.special}+`;
}

// ===== CATEGORY RENDERING =====
function renderCategoryCards() {
    const grid = document.getElementById('category-grid');
    if (!grid) return;

    grid.innerHTML = '';

    Object.keys(categoryData).forEach(key => {
        const cat = categoryData[key];
        const locked = (key === 'fsk18' && !isAdult) || (key === 'special' && !hasPremium);

        const card = document.createElement('div');
        card.className = `category-card ${key}${locked ? ' locked' : ''}`;
        card.dataset.category = key;

        let overlay = '';
        if (key === 'fsk18' && !isAdult) {
            overlay = '<div class="locked-overlay"><div class="lock-icon">🔒</div><p class="lock-message">Nur für Erwachsene (18+)</p></div>';
        } else if (key === 'special' && !hasPremium) {
            overlay = '<div class="premium-badge">👑 PREMIUM</div><div class="locked-overlay"><div class="lock-icon">🔒</div><p class="lock-message">Premium Inhalt</p><button class="unlock-btn" data-premium-unlock>💎 Freischalten</button></div>';
        }

        const examples = cat.examples.map(ex => `<div class="example-question">${DOMPurify.sanitize(ex)}</div>`).join('');

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
        `);

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
    if (firebaseService?.isReady && gameState.playerId) {
        try {
            await firebaseService.database.ref(`games/${gameState.gameId}`).update({
                categories: selectedCategories,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (error) {
            log(`❌ Sync failed: ${error.message}`, 'error');
        }
    }
}

// ===== HOST NAME =====
function showHostNameModal() {
    document.getElementById('host-name-modal').classList.add('show');
    setTimeout(() => document.getElementById('host-name-input')?.focus(), 300);
}

function validateHostName() {
    const input = document.getElementById('host-name-input');
    const btn = document.getElementById('confirm-name-btn');
    const name = input.value.trim();
    const valid = name.length >= 2 && name.length <= 20 && /^[a-zA-Z0-9\s]+$/.test(name);

    btn.disabled = !valid;
    input.style.borderColor = name.length ? (valid ? '#4CAF50' : '#f44336') : '#ddd';
}

function confirmHostName() {
    const name = document.getElementById('host-name-input').value.trim();

    if (name.length < 2 || !/^[a-zA-Z0-9\s]+$/.test(name)) {
        showNotification('Ungültiger Name', 'warning');
        return;
    }

    gameState.playerName = name;
    gameState.save();
    document.getElementById('host-name-modal').classList.remove('show');
    continueWithExistingName();
    showNotification(`Willkommen, ${name}! 👑`, 'success');
}

async function continueWithExistingName() {
    document.getElementById('host-name').textContent = gameState.playerName;
    document.getElementById('game-id-display').textContent = gameState.gameId;

    if (firebaseService.isReady && !gameState.playerId) {
        const result = await firebaseService.createGame({
            gameId: gameState.gameId,
            hostName: gameState.playerName,
            categories: gameState.selectedCategories || [],
            difficulty: gameState.difficulty || 'medium'
        });

        if (result) {
            gameState.gameId = result.gameId;
            gameState.playerId = result.playerId;
            gameState.save();
            document.getElementById('game-id-display').textContent = result.gameId;
        }
    }

    if (gameState.selectedCategories?.length > 0) {
        selectedCategories = [...gameState.selectedCategories];
        selectedCategories.forEach(c => {
            document.querySelector(`[data-category="${c}"]`)?.classList.add('selected');
        });
        updateSelectionSummary();
    }
}

// ===== PREMIUM =====
function showPremiumInfo() {
    document.getElementById('premium-modal').classList.add('show');
}

function closePremiumModal() {
    document.getElementById('premium-modal').classList.remove('show');
}

async function purchasePremium() {
    try {
        const userId = firebaseService.auth.currentUser?.uid;
        if (!userId) {
            showNotification('Bitte Account erstellen', 'warning');
            return;
        }

        await firebaseService.database.ref(`users/${userId}/purchases/special`).set({
            id: 'special_edition',
            name: 'Special Edition',
            price: 2.99,
            currency: 'EUR',
            timestamp: Date.now()
        });

        hasPremium = true;
        closePremiumModal();
        showNotification('Premium freigeschaltet! 🎉', 'success');
        renderCategoryCards();
    } catch (error) {
        showNotification('Fehler beim Kauf', 'error');
    }
}

// ===== NAVIGATION =====
async function proceedWithCategories() {
    if (!selectedCategories.length) {
        showNotification('Wähle mindestens eine Kategorie', 'warning');
        return;
    }

    showLoading();

    gameState.selectedCategories = selectedCategories;
    gameState.gamePhase = 'difficulty_selection';
    gameState.save();

    if (firebaseService?.isReady) await syncWithFirebase();

    setTimeout(() => window.location.href = 'multiplayer-difficulty-selection.html', 500);
}

function goBack() {
    firebaseService?.cleanup();
    showLoading();
    setTimeout(() => window.location.href = 'index.html', 300);
}

// ===== UTILITIES =====
function showLoading() {
    document.getElementById('loading')?.classList.add('show');
}

function hideLoading() {
    document.getElementById('loading')?.classList.remove('show');
}

function showNotification(message, type = 'success') {
    const notif = document.getElementById('notification');
    if (notif) {
        notif.textContent = DOMPurify.sanitize(message);
        notif.className = `notification ${type} show`;
        setTimeout(() => notif.classList.remove('show'), 3000);
    }
}

function log(message, type = 'info') {
    const colors = { info: '#4488ff', warning: '#ffaa00', error: '#ff4444', success: '#00ff00' };
    console.log(`%c[Category] ${message}`, `color: ${colors[type] || colors.info}`);
}

// ===== CLEANUP =====
window.addEventListener('beforeunload', () => firebaseService?.cleanup());

// ===== DEBUG =====
window.debugMultiplayerCategories = () => {
    console.log('🔍 === DEBUG ===');
    console.log('GameState:', gameState);
    console.log('Firebase:', { init: firebaseService?.isInitialized, conn: firebaseService?.isConnected });
    console.log('Categories:', selectedCategories);
    console.log('Counts:', questionCounts);
    console.log('Adult:', isAdult, 'Premium:', hasPremium);
};

log('✅ No-Cap Multiplayer Category Selection v8.0 loaded!');