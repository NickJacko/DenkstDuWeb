/**
 * No-Cap Multiplayer Imposter Gameplay
 * Phase machine: waiting → word → (local) voting → ended
 */

(function(window) {
    'use strict';

    const Logger = window.NocapUtils?.Logger || {
        debug: () => {},
        info: () => {},
        warn: console.warn,
        error: console.error
    };

    // ───────────────────────────────────────────────
    // MODULE STATE
    // ───────────────────────────────────────────────
    const mod = {
        gameState: null,
        isDev: window.location.hostname === 'localhost' ||
               window.location.hostname === '127.0.0.1' ||
               window.location.hostname.includes('192.168.')
    };

    let currentGameId   = null;
    let isHost          = false;
    let myUid           = null;
    let myName          = 'Spieler';
    let isImposter      = false;
    let currentPhase    = 'waiting'; // waiting | word | voting | ended
    let currentRound    = null;      // snapshot of imposterRound
    let allPlayers      = {};        // { uid: { name, ... } }
    let totalSchlucke   = {};        // { uid: count }
    let imposterCount   = 1;
    let difficulty      = 'medium';  // easy | medium | hard
    let hasClickedWeiter = false;
    let hasVoted        = false;
    let hasDecided      = false;
    let selectedVotes   = [];        // UIDs selected for voting
    let gameListener    = null;
    let roundListener   = null;
    let connectedRef    = null;
    let connectedCb     = null;

    // ───────────────────────────────────────────────
    // 200 IMPOSTER WORDS
    // ───────────────────────────────────────────────
    const IMPOSTER_WORDS = [
        "Petting","Dreier","Gangbang","Orgie","Fetisch","BDSM","Bondage","Dominant","Submissiv",
        "Roleplay","Dirty Talk","Squirting","Deepthroat","Teabagging","Rimming","Pegging",
        "Edging","Ruined Orgasm","Cuckolding","Voyeurismus","Exhibitionismus","Swinger",
        "Polyamorie","Fremdgehen","Affäre","Seitensprung","One Night Stand","Friends with Benefits",
        "Sexting","Nudes","Camgirl","OnlyFans","Pornhub","Erotikfilm","Hentai","Doujin",
        "Creampie","Facial","Bukakke","Glory Hole","Gangbang","Strip Club","Lapdance",
        "Pole Dance","Erotikshop","Vibrator","Dildo","Butt Plug","Fisting","Golden Shower",
        "Watersports","Scat","Crush","Footjob","Handjob","Blowjob","Titjob","Rimjob",
        "Cunnilingus","Fellatio","Analingus","Vaginalverkehr","Analverkehr","Doppelpenetration",
        "Spitroasting","Daisy Chain","Masturbation","Orgasmus","Ejakulation","Vorzeitiger Samenerguss",
        "Erektionsstörung","Anorgasmie","Libidoverlust","Aphrodisiakum","Testosteron","Östrogen",
        "Kondommuffel","Verhütungspanne","Morgen danach Pille","Abtreibung","One-Night-Stand-Reue",
        "Booty Call","Netflix and Chill","Situationship","Ghosting nach Sex","Beziehungsangst",
        "Toxische Beziehung","Gaslighting","Love Bombing","Breadcrumbing","Benching",
        "Orbiting","Zombie-Ex","Rekontakt nach Trennung","Eifersucht","Fremdflirten",
        "Micro-Cheating","Emotionale Affäre","Sexsucht","Pornosucht","Beziehungsunfähigkeit",
        "Attachment Disorder","Anxious Attachment","Avoidant Attachment","Trauma Bonding",
        "Co-Abhängigkeit","Narzissmus in Beziehungen","Manipulation","Silent Treatment",
        "Stonewalling","Scheidung wegen Untreue","Rachesex","Versöhnungssex","Makeup Sex",
        "Beziehungspause","Offene Beziehung","Polygamie","Monogamie","Ehe ohne Sex",
        "Sexuelle Frustration","Körperkomplexe beim Sex","Unsicherer Körper","Selfie vor Sex",
        "Sex unter Alkohol","Sex unter Drogen","Sexuelle Nötigung","Einverständnis",
        "Safe Word","Aftercare","Consent Talk","Körpersprache beim Flirten","Augenspiel",
        "Verführung","Anmachspruch","Flirtzone","Dating App","Tinder Match","Swipe Right",
        "Tinder Superlike","Catfishing","Fake Profil","Date Vorbereitung","Erstes Date",
        "Zweites Date","Kussmoment","Erster Kuss verpatzt","Zungenkuss","Nacken küssen",
        "Ohrläppchen beißen","Hals küssen","Körper erkunden","Ausgezogen werden","Stripperin",
        "Erotik Massage","Happy Ending","Rotlichtbezirk","Prostitution","Escort Service",
        "Bordell","Zuhälter","Milf","Cougar","Sugar Daddy","Sugar Baby","Age Gap Beziehung",
        "Lehrer Schüler Fantasie","Chef Angestellte Fantasie","Arzt Patientin Fantasie",
        "Verbotene Frucht","Tabu-Fantasie","Inzest Tabu","Stiefschwester Fantasie",
        "Ex-Partner Fantasie","Rival Fantasie","Gruppentherapie-Dating","Rebound Beziehung",
        "Sex auf der Arbeit","Kollegenaffäre","Büro-Flirt","Betriebsfeier Kuss",
        "Sex im Aufzug","Sex im Flugzeug","Sex in der Umkleide","Sex im Kino",
        "Sex am Strand","Sex im Wald","Sex in der Sauna","Sex im Pool","Sex auf dem Dach",
        "Outdoor Sex","Public Sex","Exhibitionismus im Urlaub","Sexurlaub","Sex Resort",
        "Swinger Club Besuch","Swingerparty","Orgienparty","Sexparty","Dogging",
        "Tantra Sex","Yoni Massage","Lingam Massage","Sexuelle Energie","Karezza",
        "Edging Technik","Orgasm Denial","Multiple Orgasmus","Prostatamassage",
        "G-Punkt Stimulation","Klitoris-Orgasmus","Vaginalorgasmus","Blended Orgasmus"
    ];

    // ───────────────────────────────────────────────
    // SECURITY: DOMPurify wrapper
    // ───────────────────────────────────────────────
    function sanitize(input) {
        if (!input) return '';
        if (typeof DOMPurify !== 'undefined') {
            return DOMPurify.sanitize(String(input), { ALLOWED_TAGS: [] });
        }
        return String(input).replace(/<[^>]*>/g, '').substring(0, 200);
    }

    function setText(el, text) {
        if (!el) return;
        el.textContent = sanitize(text);
    }

    // ───────────────────────────────────────────────
    // UI HELPERS
    // ───────────────────────────────────────────────
    function showPhase(phase) {
        ['waiting', 'word', 'voting', 'ended'].forEach(p => {
            const el = document.getElementById(`phase-${p}`);
            if (el) el.classList.toggle('hidden', p !== phase);
        });
        currentPhase = phase;
    }

    function showLoading() {
        const el = document.getElementById('loading');
        if (el) el.style.display = 'flex';
    }

    function hideLoading() {
        const el = document.getElementById('loading');
        if (el) el.style.display = 'none';
    }

    function showNotification(msg, type = 'info', duration = 4000) {
        if (window.NocapUtils?.showNotification) {
            window.NocapUtils.showNotification(sanitize(msg), type, duration);
            return;
        }
        const container = document.getElementById('notification-container');
        if (!container) return;
        const n = document.createElement('div');
        n.className = `notification notification-${type}`;
        n.textContent = sanitize(msg);
        container.appendChild(n);
        setTimeout(() => n.remove(), duration);
    }

    function updateConnectionUI(connected) {
        const el = document.getElementById('connection-indicator');
        if (!el) return;
        el.classList.toggle('connected', connected);
        el.classList.toggle('disconnected', !connected);
        el.textContent = connected ? '🟢 Verbunden' : '🔴 Offline';
    }

    // ───────────────────────────────────────────────
    // HOST / GUEST VISIBILITY
    // ───────────────────────────────────────────────
    function applyRoleVisibility() {
        document.querySelectorAll('.host-only').forEach(el => {
            el.style.display = isHost ? '' : 'none';
        });
    }

    // ───────────────────────────────────────────────
    // INITIALIZATION
    // ───────────────────────────────────────────────
    async function initialize() {
        showLoading();

        if (typeof DOMPurify === 'undefined') {
            alert('Sicherheitsfehler: DOMPurify nicht geladen.');
            return;
        }

        if (!window.FirebaseConfig) {
            showNotification('Firebase nicht verfügbar', 'error');
            hideLoading();
            setTimeout(() => { window.location.href = 'index.html'; }, 2000);
            return;
        }

        try {
            if (!window.FirebaseConfig.isInitialized?.()) {
                await window.FirebaseConfig.initialize();
            }
            if (window.FirebaseConfig.waitForFirebase) {
                await window.FirebaseConfig.waitForFirebase(10000);
            }
        } catch (e) {
            Logger.error('Firebase init failed:', e);
            showNotification('Firebase nicht verfügbar', 'error');
            hideLoading();
            setTimeout(() => { window.location.href = 'index.html'; }, 2000);
            return;
        }

        // Restore game state
        const saved = restoreSavedState();
        if (!saved || !saved.gameId) {
            showNotification('Kein Spielstand gefunden!', 'error');
            hideLoading();
            setTimeout(() => { window.location.href = 'index.html'; }, 2000);
            return;
        }

        currentGameId = saved.gameId;
        isHost        = saved.isHost || false;
        myName        = saved.playerName || 'Spieler';
        difficulty    = saved.difficulty || 'medium';
        imposterCount = saved.imposterCount || 1;

        // Wait for auth
        await waitForAuth();
        myUid = firebase.auth().currentUser?.uid;

        if (!myUid) {
            showNotification('Authentifizierungsfehler', 'error');
            hideLoading();
            return;
        }

        // Sync host role from DB
        try {
            const hostSnap = await firebase.database().ref(`games/${currentGameId}/hostId`).once('value');
            if (hostSnap.val() === myUid) isHost = true;
        } catch (_) {}

        // Ensure player entry exists
        await ensurePlayerEntry();

        // Read full game settings once
        try {
            const settingsSnap = await firebase.database().ref(`games/${currentGameId}/settings`).once('value');
            const s = settingsSnap.val() || {};
            difficulty    = s.difficulty    || difficulty;
            imposterCount = s.imposterCount || imposterCount;
        } catch (_) {}

        // Read totalSchlucke
        try {
            const tsSnap = await firebase.database().ref(`games/${currentGameId}/totalSchlucke`).once('value');
            totalSchlucke = tsSnap.val() || {};
        } catch (_) {}

        // Read players
        try {
            const pSnap = await firebase.database().ref(`games/${currentGameId}/players`).once('value');
            allPlayers = pSnap.val() || {};
        } catch (_) {}

        applyRoleVisibility();
        updateHeader();
        setupEventListeners();
        setupConnectionMonitoring();
        setupGameListener();

        hideLoading();
    }

    function restoreSavedState() {
        // Try NocapUtils first
        if (window.NocapUtils?.getLocalStorage) {
            const s = window.NocapUtils.getLocalStorage('nocap_game_state');
            if (s?.gameId) return s;
        }
        // Try localStorage directly
        try {
            const raw = localStorage.getItem('nocap_game_state');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed?.gameId) return parsed;
            }
        } catch (_) {}
        // Try sessionStorage
        try {
            const raw = sessionStorage.getItem('nocap_game_state');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed?.gameId) return parsed;
            }
        } catch (_) {}
        // Try URL param
        const urlGameId = new URLSearchParams(window.location.search).get('gameId');
        if (urlGameId) return { gameId: urlGameId };
        return null;
    }

    async function waitForAuth(timeoutMs = 5000) {
        if (firebase.auth().currentUser) return;
        await new Promise(resolve => {
            let done = false;
            const unsub = firebase.auth().onAuthStateChanged(() => {
                if (done) return;
                done = true;
                try { unsub(); } catch (_) {}
                resolve();
            });
            setTimeout(() => { if (!done) { done = true; resolve(); } }, timeoutMs);
        });
    }

    async function ensurePlayerEntry() {
        if (!myUid || !currentGameId) return;
        try {
            const ref = firebase.database().ref(`games/${currentGameId}/players/${myUid}`);
            const snap = await ref.once('value');
            if (!snap.exists()) {
                await ref.set({ name: myName, playerId: myUid, isHost, isGuest: !isHost, joinedAt: Date.now(), online: true });
            } else {
                await ref.update({ online: true, rejoinedAt: Date.now() });
            }
        } catch (e) {
            Logger.warn('ensurePlayerEntry failed:', e.message);
        }
    }

    // ───────────────────────────────────────────────
    // CONNECTION MONITORING
    // ───────────────────────────────────────────────
    function setupConnectionMonitoring() {
        const db = window.FirebaseConfig?.getFirebaseInstances?.()?.database;
        if (!db?.ref) return;
        connectedRef = db.ref('.info/connected');
        connectedCb = snap => updateConnectionUI(snap.val() === true);
        connectedRef.on('value', connectedCb);
    }

    // ───────────────────────────────────────────────
    // FIREBASE LISTENERS
    // ───────────────────────────────────────────────
    function setupGameListener() {
        if (!currentGameId) return;
        if (gameListener) {
            firebase.database().ref(`games/${currentGameId}`).off('value', gameListener);
        }
        gameListener = firebase.database().ref(`games/${currentGameId}`).on('value', snap => {
            const game = snap.val();
            if (!game) return;

            // Update players list
            if (game.players) allPlayers = game.players;
            if (game.settings?.imposterCount) imposterCount = game.settings.imposterCount;
            if (game.settings?.difficulty) difficulty = game.settings.difficulty;
            if (game.totalSchlucke) totalSchlucke = game.totalSchlucke;

            handleImposterRound(game.imposterRound);
            handleGameEnded(game);
        });
    }

    function handleGameEnded(game) {
        if (game.status === 'ended' || game.phase === 'ended') {
            window.location.href = 'multiplayer-results.html';
        }
    }

    function handleImposterRound(round) {
        if (!round) {
            // No round started yet → show waiting
            if (currentPhase !== 'waiting') {
                showPhase('waiting');
            }
            updateWaitingUI();
            return;
        }

        currentRound = round;
        isImposter = Array.isArray(round.imposters) && round.imposters.includes(myUid);

        if (round.phase === 'ended') {
            // Host computes schlucke if not yet written (e.g., non-host imposter triggered end)
            if (isHost && round.resolution && !round.schlucke) {
                computeAndWriteSchlucke(round.resolution);
            }
            if (currentPhase !== 'ended') {
                showPhase('ended');
                renderResults(round);
            }
            return;
        }

        if (round.phase === 'word' || round.phase === 'waiting') {
            // If user already clicked Weiter locally, stay in voting
            if (currentPhase === 'voting') return;
            showPhase('word');
            renderWordPhase(round);
            return;
        }
    }

    // ───────────────────────────────────────────────
    // WAITING PHASE
    // ───────────────────────────────────────────────
    function updateWaitingUI() {
        const subtitle = document.getElementById('waiting-subtitle');
        setText(subtitle, isHost ? 'Starte die erste Runde!' : 'Warte auf den Host...');

        const hostControls = document.getElementById('waiting-host-controls');
        if (hostControls) hostControls.hidden = !isHost;

        const startBtn = document.getElementById('start-round-btn');
        if (startBtn) setText(startBtn, currentRound ? '▶ Nächste Runde' : '🎮 Erste Runde starten');

        renderSchluckeBoard('waiting-schlucke-board', 'waiting-schlucke-list');
    }

    function renderSchluckeBoard(boardId, listId) {
        const board = document.getElementById(boardId);
        const list  = document.getElementById(listId);
        if (!board || !list) return;

        const entries = buildSchluckeEntries();
        if (entries.length === 0) {
            board.hidden = true;
            return;
        }
        board.hidden = false;
        list.innerHTML = '';
        entries.forEach(({ name, count }) => {
            const li = document.createElement('li');
            li.className = 'schlucke-item';
            li.innerHTML = `<span class="schlucke-name">${sanitize(name)}</span><span class="schlucke-count">${count} 🍺</span>`;
            list.appendChild(li);
        });
    }

    function buildSchluckeEntries() {
        return Object.entries(totalSchlucke)
            .map(([uid, count]) => ({
                name: allPlayers[uid]?.name || uid,
                count
            }))
            .sort((a, b) => b.count - a.count);
    }

    // ───────────────────────────────────────────────
    // HOST: START ROUND
    // ───────────────────────────────────────────────
    async function startRound() {
        if (!isHost) return;

        const startBtn = document.getElementById('start-round-btn');
        if (startBtn) startBtn.disabled = true;

        // Pick random word
        const word = IMPOSTER_WORDS[Math.floor(Math.random() * IMPOSTER_WORDS.length)];

        // Pick imposters
        const playerUids = Object.keys(allPlayers).filter(uid => allPlayers[uid]);
        if (playerUids.length < 2) {
            showNotification('Zu wenige Spieler!', 'warning');
            if (startBtn) startBtn.disabled = false;
            return;
        }
        const shuffled = [...playerUids].sort(() => Math.random() - 0.5);
        const imposters = shuffled.slice(0, Math.min(imposterCount, playerUids.length - 1));

        // Pick random starter (any player)
        const starter = playerUids[Math.floor(Math.random() * playerUids.length)];

        // Reset per-round local flags
        hasClickedWeiter = false;
        hasVoted         = false;
        hasDecided       = false;
        selectedVotes    = [];

        const roundData = {
            phase: 'word',
            word,
            imposters,
            starter,
            roundNumber: (currentRound?.roundNumber || 0) + 1,
            wordSeenBy: {},
            votes: {},
            schlucke: {}
        };

        try {
            await firebase.database().ref(`games/${currentGameId}/imposterRound`).set(roundData);
            await firebase.database().ref(`games/${currentGameId}/settings/imposterCount`).set(imposterCount);
        } catch (e) {
            Logger.error('startRound failed:', e);
            showNotification('Fehler beim Starten!', 'error');
        }

        if (startBtn) startBtn.disabled = false;
    }

    // ───────────────────────────────────────────────
    // WORD PHASE
    // ───────────────────────────────────────────────
    function renderWordPhase(round) {
        const normalDiv   = document.getElementById('word-display-normal');
        const imposterDiv = document.getElementById('word-display-imposter');
        const starter     = document.getElementById('starter-notice');
        const roundDisp   = document.getElementById('round-display');

        if (roundDisp) setText(roundDisp, `Runde ${round.roundNumber || 1}`);

        if (isImposter) {
            if (normalDiv)   normalDiv.hidden   = true;
            if (imposterDiv) imposterDiv.hidden = false;
        } else {
            if (normalDiv)   normalDiv.hidden   = false;
            if (imposterDiv) imposterDiv.hidden = true;
            const wordText = document.getElementById('word-text');
            setText(wordText, round.word || '');
        }

        if (starter) {
            starter.hidden = round.starter !== myUid;
        }

        const weiterBtn = document.getElementById('weiter-btn');
        if (weiterBtn) weiterBtn.disabled = hasClickedWeiter;
    }

    async function clickWeiter() {
        if (hasClickedWeiter || !currentRound) return;
        hasClickedWeiter = true;

        const weiterBtn = document.getElementById('weiter-btn');
        if (weiterBtn) weiterBtn.disabled = true;

        // Record that this player has seen the word
        try {
            await firebase.database()
                .ref(`games/${currentGameId}/imposterRound/wordSeenBy/${myUid}`)
                .set(true);
        } catch (e) {
            Logger.warn('wordSeenBy write failed:', e.message);
        }

        // Transition locally to voting
        showPhase('voting');
        renderVotingPhase();
    }

    // ───────────────────────────────────────────────
    // VOTING PHASE
    // ───────────────────────────────────────────────
    function renderVotingPhase() {
        const normalCard   = document.getElementById('voting-normal');
        const imposterCard = document.getElementById('voting-imposter');

        if (isImposter) {
            if (normalCard)   normalCard.hidden   = true;
            if (imposterCard) imposterCard.hidden = false;
            // Reset decision buttons
            const erwBtn = document.getElementById('erwischt-btn');
            const nichtBtn = document.getElementById('nicht-erwischt-btn');
            if (erwBtn)   erwBtn.disabled   = hasDecided;
            if (nichtBtn) nichtBtn.disabled = hasDecided;
        } else {
            if (normalCard)   normalCard.hidden   = false;
            if (imposterCard) imposterCard.hidden = true;
            renderPlayerVoteGrid();
            updateVoteSubmitButton();
        }

        // Update required count
        const reqDisplay = document.getElementById('required-count-display');
        if (reqDisplay) reqDisplay.textContent = imposterCount;
    }

    function renderPlayerVoteGrid() {
        const grid = document.getElementById('player-vote-grid');
        if (!grid) return;
        grid.innerHTML = '';

        Object.entries(allPlayers).forEach(([uid, player]) => {
            if (uid === myUid) return; // Can't vote for yourself
            const btn = document.createElement('button');
            btn.className = 'player-vote-btn';
            btn.type = 'button';
            btn.dataset.uid = uid;
            btn.setAttribute('aria-pressed', 'false');
            btn.textContent = sanitize(player.name || uid);

            if (selectedVotes.includes(uid)) {
                btn.classList.add('selected');
                btn.setAttribute('aria-pressed', 'true');
            }

            btn.addEventListener('click', () => toggleVote(uid, btn));
            grid.appendChild(btn);
        });
    }

    function toggleVote(uid, btn) {
        if (hasVoted) return;

        if (selectedVotes.includes(uid)) {
            selectedVotes = selectedVotes.filter(id => id !== uid);
            btn.classList.remove('selected');
            btn.setAttribute('aria-pressed', 'false');
        } else {
            if (selectedVotes.length >= imposterCount) {
                showNotification(`Wähle genau ${imposterCount} Person(en)!`, 'warning', 2000);
                return;
            }
            selectedVotes.push(uid);
            btn.classList.add('selected');
            btn.setAttribute('aria-pressed', 'true');
        }
        updateVoteSubmitButton();
    }

    function updateVoteSubmitButton() {
        const btn = document.getElementById('submit-vote-btn');
        if (!btn) return;
        const ready = selectedVotes.length === imposterCount && !hasVoted;
        btn.disabled = !ready;
        btn.setAttribute('aria-disabled', String(!ready));
    }

    async function submitVote() {
        if (hasVoted || selectedVotes.length !== imposterCount) return;
        hasVoted = true;

        const submitBtn = document.getElementById('submit-vote-btn');
        if (submitBtn) submitBtn.disabled = true;

        try {
            await firebase.database()
                .ref(`games/${currentGameId}/imposterRound/votes/${myUid}`)
                .set(selectedVotes);
        } catch (e) {
            Logger.error('submitVote failed:', e);
            hasVoted = false;
            if (submitBtn) submitBtn.disabled = false;
            showNotification('Fehler beim Abstimmen!', 'error');
            return;
        }

        // Show waiting message
        const msg = document.getElementById('vote-submitted-msg');
        if (msg) msg.classList.remove('hidden');

        document.querySelectorAll('.player-vote-btn').forEach(b => b.disabled = true);
    }

    // ───────────────────────────────────────────────
    // IMPOSTER: DECISION
    // ───────────────────────────────────────────────
    async function makeDecision(decision) {
        if (!isImposter || hasDecided) return;
        hasDecided = true;

        const erwBtn  = document.getElementById('erwischt-btn');
        const nichtBtn = document.getElementById('nicht-erwischt-btn');
        if (erwBtn)   erwBtn.disabled   = true;
        if (nichtBtn) nichtBtn.disabled = true;

        const resolution = {
            imposterUid: myUid,
            decision,    // 'erwischt' | 'nicht_erwischt'
            clickedAt: firebase.database.ServerValue.TIMESTAMP
        };

        try {
            // Write resolution first
            await firebase.database()
                .ref(`games/${currentGameId}/imposterRound/resolution`)
                .set(resolution);

            // Host computes schlucke immediately; non-host host will see 'ended' via gameListener
            if (isHost) {
                await computeAndWriteSchlucke(resolution);
            }

            // Set phase ended last — all clients transition when they see this
            await firebase.database()
                .ref(`games/${currentGameId}/imposterRound/phase`)
                .set('ended');

        } catch (e) {
            Logger.error('makeDecision failed:', e);
            hasDecided = false;
            if (erwBtn)   erwBtn.disabled   = false;
            if (nichtBtn) nichtBtn.disabled = false;
            showNotification('Fehler!', 'error');
        }
    }

    // ───────────────────────────────────────────────
    // SCHLÜCKE CALCULATION (host only)
    // ───────────────────────────────────────────────
    async function computeAndWriteSchlucke(resolution) {
        if (!isHost) return;

        const round  = currentRound;
        if (!round)  return;

        const imposters    = Array.isArray(round.imposters) ? round.imposters : [];
        const votes        = round.votes || {};
        const schlucke     = {}; // { uid: count }

        if (resolution.decision === 'erwischt') {
            // Only the deciding imposter gets schlucke
            const count = difficulty === 'easy' ? 1 : difficulty === 'hard' ? 3 : 2;
            schlucke[resolution.imposterUid] = count;

        } else {
            // Nicht erwischt: evaluate votes
            const nonImposters = Object.keys(allPlayers).filter(uid => !imposters.includes(uid));

            // Check if ALL non-imposters voted ALL correct imposters
            let allCorrect = true;
            nonImposters.forEach(uid => {
                const vote = votes[uid];
                if (!vote) { allCorrect = false; return; }
                const votedArr = Array.isArray(vote) ? vote : [];
                // A voter is correct if their vote set equals the imposters set exactly
                const correct =
                    votedArr.length === imposters.length &&
                    imposters.every(imp => votedArr.includes(imp)) &&
                    votedArr.every(v => imposters.includes(v));
                if (!correct) allCorrect = false;
            });

            if (difficulty === 'easy') {
                // Only wrong voters get 1 Schluck
                nonImposters.forEach(uid => {
                    const vote = votes[uid] || [];
                    const votedArr = Array.isArray(vote) ? vote : [];
                    const correct =
                        votedArr.length === imposters.length &&
                        imposters.every(imp => votedArr.includes(imp)) &&
                        votedArr.every(v => imposters.includes(v));
                    if (!correct) schlucke[uid] = 1;
                });
            } else if (difficulty === 'medium') {
                if (!allCorrect) {
                    nonImposters.forEach(uid => { schlucke[uid] = 1; });
                }
            } else {
                // hard
                if (!allCorrect) {
                    nonImposters.forEach(uid => { schlucke[uid] = 2; });
                }
            }
        }

        // Write round schlucke
        try {
            await firebase.database()
                .ref(`games/${currentGameId}/imposterRound/schlucke`)
                .set(schlucke);

            // Update totalSchlucke
            const newTotal = { ...totalSchlucke };
            Object.entries(schlucke).forEach(([uid, count]) => {
                newTotal[uid] = (newTotal[uid] || 0) + count;
            });
            totalSchlucke = newTotal;
            await firebase.database()
                .ref(`games/${currentGameId}/totalSchlucke`)
                .set(newTotal);

        } catch (e) {
            Logger.error('computeAndWriteSchlucke failed:', e);
        }
    }

    // ───────────────────────────────────────────────
    // RESULTS PHASE
    // ───────────────────────────────────────────────
    function renderResults(round) {
        if (!round) return;

        // Round number
        const roundDisp = document.getElementById('round-display');
        if (roundDisp) setText(roundDisp, `Runde ${round.roundNumber || 1}`);

        // Imposter names
        const imposterNamesEl = document.getElementById('imposter-names-display');
        if (imposterNamesEl) {
            const names = (round.imposters || [])
                .map(uid => sanitize(allPlayers[uid]?.name || uid))
                .join(', ');
            imposterNamesEl.textContent = names || '?';
        }

        // Decision info
        const decisionEl = document.getElementById('decision-info');
        if (decisionEl && round.resolution) {
            const deciderName = sanitize(allPlayers[round.resolution.imposterUid]?.name || 'Imposter');
            if (round.resolution.decision === 'erwischt') {
                decisionEl.textContent = `✋ ${deciderName} hat sich erwischt gegeben!`;
                decisionEl.className = 'decision-info erwischt';
            } else {
                decisionEl.textContent = `🎭 ${deciderName} hat versucht durchzukommen!`;
                decisionEl.className = 'decision-info nicht-erwischt';
            }
        }

        // Word reveal
        const wordRevealEl = document.getElementById('revealed-word-text');
        setText(wordRevealEl, round.word || '?');

        // Vote results
        renderVoteResults(round);

        // Round schlucke
        renderRoundSchlucke(round.schlucke || {});

        // Total schlucke
        renderTotalSchlucke();

        // Host controls
        const hostControls = document.getElementById('round-host-controls');
        if (hostControls) hostControls.hidden = !isHost;

        const guestWaiting = document.getElementById('guest-waiting-next');
        if (guestWaiting) guestWaiting.hidden = isHost;

        const nextBtn = document.getElementById('next-round-btn');
        if (nextBtn) setText(nextBtn, '▶ Nächste Runde');
    }

    function renderVoteResults(round) {
        const section = document.getElementById('vote-results-section');
        const list    = document.getElementById('vote-results-list');
        if (!section || !list) return;

        const votes = round.votes || {};
        if (Object.keys(votes).length === 0) {
            section.hidden = true;
            return;
        }
        section.hidden = false;
        list.innerHTML = '';

        Object.entries(votes).forEach(([uid, voted]) => {
            const voterName = sanitize(allPlayers[uid]?.name || uid);
            const votedArr  = Array.isArray(voted) ? voted : [];
            const votedNames = votedArr.map(v => sanitize(allPlayers[v]?.name || v)).join(', ');
            const imposters  = Array.isArray(round.imposters) ? round.imposters : [];
            const correct    =
                votedArr.length === imposters.length &&
                imposters.every(imp => votedArr.includes(imp)) &&
                votedArr.every(v => imposters.includes(v));

            const li = document.createElement('li');
            li.className = `vote-result-item ${correct ? 'correct' : 'wrong'}`;
            li.innerHTML = `<span class="voter-name">${voterName}</span>` +
                           `<span class="voted-for">${votedNames || '–'}</span>` +
                           `<span class="vote-icon">${correct ? '✅' : '❌'}</span>`;
            list.appendChild(li);
        });
    }

    function renderRoundSchlucke(schlucke) {
        const list = document.getElementById('round-schlucke-list');
        if (!list) return;
        list.innerHTML = '';

        const entries = Object.entries(schlucke);
        if (entries.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'Niemand bekommt Schlücke 🎉';
            list.appendChild(li);
            return;
        }
        entries.sort((a, b) => b[1] - a[1]).forEach(([uid, count]) => {
            const name = sanitize(allPlayers[uid]?.name || uid);
            const li = document.createElement('li');
            li.className = 'schlucke-item';
            li.innerHTML = `<span class="schlucke-name">${name}</span><span class="schlucke-count">${count} 🍺</span>`;
            list.appendChild(li);
        });
    }

    function renderTotalSchlucke() {
        const list = document.getElementById('total-schlucke-list');
        if (!list) return;
        list.innerHTML = '';

        const entries = buildSchluckeEntries();
        if (entries.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'Noch keine Schlücke verteilt';
            list.appendChild(li);
            return;
        }
        entries.forEach(({ name, count }) => {
            const li = document.createElement('li');
            li.className = 'schlucke-item';
            li.innerHTML = `<span class="schlucke-name">${sanitize(name)}</span><span class="schlucke-count">${count} 🍺</span>`;
            list.appendChild(li);
        });
    }

    // ───────────────────────────────────────────────
    // HOST: NEXT ROUND
    // ───────────────────────────────────────────────
    async function nextRound() {
        if (!isHost) return;

        // Reset per-round local flags for host too
        hasClickedWeiter = false;
        hasVoted         = false;
        hasDecided       = false;
        selectedVotes    = [];

        await startRound();
    }

    // ───────────────────────────────────────────────
    // END GAME
    // ───────────────────────────────────────────────
    async function endGame() {
        if (!isHost) return;
        try {
            await firebase.database().ref(`games/${currentGameId}`).update({
                status: 'ended',
                endedAt: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (e) {
            Logger.error('endGame failed:', e);
            showNotification('Fehler beim Beenden!', 'error');
        }
    }

    // ───────────────────────────────────────────────
    // HEADER
    // ───────────────────────────────────────────────
    function updateHeader() {
        const nameEl = document.getElementById('my-name-display');
        setText(nameEl, myName);

        const diffEl = document.getElementById('difficulty-badge');
        const diffMap = { easy: '😊 Easy', medium: '😤 Medium', hard: '💀 Hard' };
        setText(diffEl, diffMap[difficulty] || difficulty);
    }

    // ───────────────────────────────────────────────
    // EVENT LISTENERS
    // ───────────────────────────────────────────────
    function setupEventListeners() {
        // Weiter button (word phase)
        const weiterBtn = document.getElementById('weiter-btn');
        if (weiterBtn) weiterBtn.addEventListener('click', clickWeiter);

        // Submit vote
        const submitVoteBtn = document.getElementById('submit-vote-btn');
        if (submitVoteBtn) submitVoteBtn.addEventListener('click', submitVote);

        // Imposter decision
        const erwischtBtn = document.getElementById('erwischt-btn');
        if (erwischtBtn) erwischtBtn.addEventListener('click', () => makeDecision('erwischt'));

        const nichtErwischtBtn = document.getElementById('nicht-erwischt-btn');
        if (nichtErwischtBtn) nichtErwischtBtn.addEventListener('click', () => makeDecision('nicht_erwischt'));

        // Host: start round (waiting phase)
        const startRoundBtn = document.getElementById('start-round-btn');
        if (startRoundBtn) startRoundBtn.addEventListener('click', startRound);

        // Host: next round (results phase)
        const nextRoundBtn = document.getElementById('next-round-btn');
        if (nextRoundBtn) nextRoundBtn.addEventListener('click', nextRound);

        // Host: end game buttons
        const endGameBtnWaiting = document.getElementById('end-game-btn-waiting');
        if (endGameBtnWaiting) endGameBtnWaiting.addEventListener('click', endGame);

        const endGameBtnResults = document.getElementById('end-game-btn-results');
        if (endGameBtnResults) endGameBtnResults.addEventListener('click', endGame);
    }

    // ───────────────────────────────────────────────
    // BOOT
    // ───────────────────────────────────────────────
    function boot() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialize);
        } else {
            // Scripts already deferred → wait one tick so Firebase SDK is ready
            setTimeout(initialize, 0);
        }
    }

    boot();

})(window);
