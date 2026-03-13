/**
 * No-Cap Multiplayer Gameplay
 * Version 3.1 - BUGFIX: Module Pattern & addEventListener
 *
 * CRITICAL: Complex 4-phase gameplay with Firebase real-time synchronization
 * - Phase 1: Question & Answer
 * - Phase 2: Waiting for others
 * - Phase 3: Round Results
 * - Phase 4: Overall Results
 */

(function(window) {
    'use strict';


    const Logger = window.NocapUtils?.Logger || {
        debug: (...args) => {},
        info: (...args) => {},
        warn: console.warn,
        error: console.error
    };

    const MultiplayerGameplayModule = {
        state: {
            gameState: null,
            firebaseService: null,
            eventListenerCleanup: [],
            isDevelopment: window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.includes('192.168.')
        },

        get gameState() { return this.state.gameState; },
        set gameState(val) { this.state.gameState = val; },

        get firebaseService() { return this.state.firebaseService; },
        set firebaseService(val) { this.state.firebaseService = val; },

        get isDevelopment() { return this.state.isDevelopment; }
    };

    Object.seal(MultiplayerGameplayModule.state);

    function throttle(func, wait = 100) {
        let timeout = null;
        let previous = 0;
        return function(...args) {
            const now = Date.now();
            const remaining = wait - (now - previous);
            if (remaining <= 0 || remaining > wait) {
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }
                previous = now;
                func.apply(this, args);
            } else if (!timeout) {
                timeout = setTimeout(() => {
                    previous = Date.now();
                    timeout = null;
                    func.apply(this, args);
                }, remaining);
            }
        };
    }

    function debounce(func, wait = 300) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function addTrackedEventListener(el, evt, handler, opts = {}) {
        if (!el) return;
        el.addEventListener(evt, handler, opts);
        MultiplayerGameplayModule.state.eventListenerCleanup.push({
            element: el,
            event: evt,
            handler,
            options: opts
        });
    }

    // ===========================
    // CONSTANTS & FALLBACK QUESTIONS
    // ===========================
    const questionsDatabase = {
        fsk0: [
"Ich habe schon mal einen Dreier gehabt",
            "Ich habe schon mal Analsex gehabt",
            "Ich habe schon mal Sex an einem öffentlichen Ort gehabt",
            "Ich habe schon mal jemanden betrogen",
            "Ich habe schon mal eine Affäre gehabt",
            "Ich habe schon mal jemanden nur wegen des Aussehens mit nach Hause genommen",
            "Ich habe schon mal Sex im Auto gehabt",
            "Ich habe schon mal eine Nacktaufnahme von mir verschickt",
            "Ich habe schon mal auf einer Party jemanden geküsst, dessen Namen ich nicht kannte",
            "Ich habe schon mal Sex mit jemandem gehabt, der oder die in einer Beziehung war",
            "Ich habe schon mal einen One-Night-Stand gehabt",
            "Ich habe schon mal Sexspielzeug benutzt",
            "Ich habe schon mal eine Sexfantasie ausgelebt, für die ich mich danach geschämt habe",
            "Ich habe schon mal beim Sex an jemand anderen gedacht",
            "Ich habe schon mal Pornos mit jemandem zusammen geschaut",
            "Ich habe schon mal Sex im Freien gehabt",
            "Ich habe schon mal Sexting betrieben",
            "Ich habe schon mal so getan, als hätte ich einen Orgasmus gehabt",
            "Ich habe schon mal jemanden beim Sex nach dem Namen einer anderen Person gerufen",
            "Ich habe schon mal mit einem viel älteren oder viel jüngeren Menschen geschlafen",
            "Ich habe schon mal Sex auf dem ersten Date gehabt",
            "Ich habe schon mal nackt in einem See, Meer oder Pool geschwommen",
            "Ich habe schon mal Strippen oder Lapdance ausprobiert",
            "Ich habe schon mal Sex im Büro oder an meinem Arbeitsplatz gehabt",
            "Ich habe schon mal zwei Personen gleichzeitig gedatet ohne dass die es wussten",
            "Ich habe schon mal auf Tinder oder einer anderen App jemanden getroffen und direkt geschlafen",
            "Ich habe schon mal auf einer Hochzeit jemanden aufgerissen",
            "Ich habe schon mal Sex gehabt, während jemand anderes im selben Raum geschlafen hat",
            "Ich habe schon mal eine Beziehung nur wegen Sex aufrechterhalten",
            "Ich habe schon mal nackt getanzt, aber nicht alleine",
            "Ich habe schon mal jemanden nach dem Sex direkt nach Hause geschickt",
            "Ich habe schon mal eine sexuelle Erfahrung gehabt, die ich noch niemandem erzählt habe",
            "Ich habe schon mal unter der Dusche oder in der Badewanne mit jemandem anderen gebadet",
            "Ich habe schon mal Sex an einem Ort gehabt, an dem wir leicht hätten erwischt werden können",
            "Ich habe schon mal eine Nacht mit jemandem verbracht, den ich erst wenige Stunden kannte",
            "Ich habe schon mal Rollenspiele im Bett ausprobiert",
            "Ich habe schon mal eine Beziehung beendet, weil der Sex nicht gut war",
            "Ich habe schon mal Sex auf einer Reise mit jemandem gehabt, den ich nie wieder gesehen habe",
            "Ich habe schon mal jemanden im betrunkenen Zustand geküsst, den ich nüchtern nie geküsst hätte",
            "Ich habe schon mal Bondage oder Fesseln ausprobiert",
            "Ich habe schon mal mit jemandem geschlafen, den ich eigentlich nicht leiden konnte",
            "Ich habe schon mal Sex auf einem Festival oder Campingplatz gehabt",
            "Ich habe schon mal jemanden verführt, nur um zu sehen ob ich es kann",
            "Ich habe schon mal eine Wette um sexuelle Handlungen abgeschlossen",
            "Ich habe schon mal Sexfotos von mir selbst gemacht",
            "Ich habe schon mal Sex in einem Aufzug gehabt",
            "Ich habe schon mal jemanden durch ein Kostüm oder Rollenspiel verführt",
            "Ich habe schon mal Sex auf einer Hausparty gehabt, während andere Leute anwesend waren",
            "Ich habe schon mal einen Freund meines Partners oder eine Freundin meiner Partnerin geküsst",
            "Ich habe schon mal Sex in einem Zug, Flugzeug oder Bus gehabt",
            "Ich habe schon mal jemanden verführt, um etwas von ihm oder ihr zu bekommen",
            "Ich habe schon mal eine geheime Affäre über mehrere Monate geführt",
            "Ich habe schon mal mit dem besten Freund oder der besten Freundin meines Ex geschlafen",
            "Ich habe schon mal Sex im Schlafzimmer meiner Eltern gehabt",
            "Ich habe schon mal eine Person absichtlich wachgeküsst um Sex zu haben",
            "Ich habe schon mal Sex nach einem Streit gehabt",
            "Ich habe schon mal eine Massage gegeben oder bekommen, die mehr war als nur eine Massage",
            "Ich habe schon mal mit jemandem geschlafen, nur um über einen Ex hinwegzukommen",
            "Ich habe schon mal Sex in der Natur gehabt, also Wald, Wiese oder Berge",
            "Ich habe schon mal einem Fremden im Club etwas ins Ohr geflüstert, um ihn oder sie anzumachen",
            "Ich habe schon mal mit jemandem geschlafen, dessen Nachnamen ich nicht kannte",
            "Ich habe schon mal Sex bei offenem Fenster oder offener Tür gehabt",
            "Ich habe schon mal eine Affäre mit jemandem gehabt, der mir eigentlich egal war",
            "Ich habe schon mal mit jemandem geschlafen, nur weil ich betrunken und einsam war",
            "Ich habe schon mal auf einer Betriebsfeier jemanden geküsst oder mehr",
            "Ich habe schon mal jemanden angetextet nach dem Motto: Ich bin gerade alleine zuhause",
            "Ich habe schon mal mit jemandem geschlafen, der mit einem meiner Freunde zusammen war",
            "Ich habe schon mal Sex mit zwei verschiedenen Personen am selben Tag gehabt",
            "Ich habe schon mal auf einem Familienfest jemanden geküsst, der nicht mein Partner war",
            "Ich habe schon mal Sex im Dunkeln gehabt, weil ich nicht wollte, dass man mich sieht",
            "Ich habe schon mal jemanden durch einen Film-Abend verführt",
            "Ich habe schon mal Sex mit einem Kollegen oder einer Kollegin gehabt",
            "Ich habe schon mal auf einem Schulausflug oder einer Klassenfahrt mit jemandem geschlafen",
            "Ich habe schon mal Sex mit einem Nachbarn oder einer Nachbarin gehabt",
            "Ich habe schon mal auf einer Silvesterparty mit jemandem mehr als nur den Mitternachtskuss geteilt",
            "Ich habe schon mal jemanden durch eine Autofahrt verführt",
            "Ich habe schon mal etwas sexuell ausprobiert, das ich aus Neugier wollte aber nicht nochmal will",
            "Ich habe schon mal Sex in einem Schwimmbad, einer Sauna oder einem Whirlpool gehabt",
            "Ich habe schon mal mit zwei Personen aus derselben Freundesgruppe geschlafen",
            "Ich habe schon mal jemanden verführt, dem ich eigentlich geholfen habe",
            "Ich habe schon mal Sex auf einem Dach oder einer Aussichtsplattform gehabt",
            "Ich habe schon mal eine Person nur durch Flirten dazu gebracht, ihre Beziehung zu hinterfragen",
            "Ich habe schon mal Sex in einem Kino oder Theater gehabt",
            "Ich habe schon mal mit jemandem geschlafen, der mit einem meiner Geschwister befreundet war",
            "Ich habe schon mal jemanden beim Tanzen so nah an mich gezogen, dass es klar war was ich will",
            "Ich habe schon mal eine Sexszene in einem Film oder einer Serie nachgespielt",
            "Ich habe schon mal Sex im Freien bei Regen gehabt",
            "Ich habe schon mal mit jemandem geschlafen, den ich eigentlich überhaupt nicht attraktiv fand",
            "Ich habe schon mal Sex in einer Bibliothek, einem Museum oder einem anderen stillen Ort gehabt",
            "Ich habe schon mal jemanden durch eine Nachricht um Mitternacht aus dem Bett geholt",
            "Ich habe schon mal Sex in einem Aufenthaltsraum oder einer Gemeinschaftsküche gehabt",
            "Ich habe schon mal jemanden durch Flüstern ins Ohr verführt",
            "Ich habe schon mal Sex auf einer Schaukel, Hängematte oder einem ungewöhnlichen Möbelstück gehabt",
            "Ich habe schon mal jemanden verführt, der eigentlich mit mir nur befreundet sein wollte",
            "Ich habe schon mal mit jemandem geschlafen, dessen Beziehungsstatus mir egal war",
            "Ich habe schon mal Sex gehabt und es danach so beschrieben, dass es besser klang als es war",
            "Ich habe schon mal jemanden durch gezieltes Ignorieren so weit gebracht, dass er oder sie die Initiative ergriffen hat",
            "Ich habe schon mal Sex mit jemandem gehabt, den ich mir schon lange heimlich gewünscht habe",
            "Ich habe schon mal eine Person durch einen Witz oder Humor ins Bett gebracht",
            "Ich habe schon mal jemanden so geküsst, dass er oder sie danach nicht mehr klar denken konnte",
            "Ich habe schon mal mit jemandem geschlafen und ihm oder ihr danach gesagt, es war ein Versehen",
            "Ich habe schon mal Sex gehabt und gehofft, dass niemand aus meinem Umfeld es je erfährt",
            "Ich habe schon mal jemanden verführt, der oder die eigentlich eine Beziehung beenden wollte",
            "Ich habe schon mal Sex gehabt, der so gut war, dass ich danach nicht schlafen konnte",
            "Ich habe schon mal mit jemandem geschlafen und ihm oder ihr danach die Nummer einer anderen Person gegeben",
            "Ich habe schon mal jemanden nach dem Sex nie wieder angeschrieben",
            "Ich habe schon mal Sex in einem Hotelpool nachts gehabt",
            "Ich habe schon mal absichtlich jemanden durch Körperkontakt verführt",
            "Ich habe schon mal einen Ex nach Mitternacht angeschrieben",
            "Ich habe schon mal eine Verabredung nur deswegen abgebrochen, weil jemand Attraktiveres aufgetaucht ist",
            "Ich habe schon mal absichtlich einen Freund oder eine Freundin meines Partners angemacht",
            "Ich habe schon mal Sex gehabt, direkt nachdem ich jemand anderen getroffen habe",
            "Ich habe schon mal jemanden so lange verführt, bis er oder sie seine oder ihre Grundsätze aufgegeben hat",
            "Ich habe schon mal Sex auf einem Balkon oder einer Terrasse gehabt",
            "Ich habe schon mal mit jemandem geschlafen und erst danach herausgefunden, dass wir uns schon kannten",
            "Ich habe schon mal eine Sexfantasie, die ich meinem aktuellen Partner oder meiner Partnerin nie erzählt habe",
            "Ich habe schon mal einen Fremden auf einer Reise mit ins Hotelzimmer genommen",
            "Ich habe schon mal Sex am Strand gehabt",
            "Ich habe schon mal gleichzeitig mit zwei verschiedenen Personen etwas laufen gehabt",
            "Ich habe schon mal Sex in einer Umkleidekabine gehabt",
            "Ich habe schon mal jemanden durch einen Kuss überrascht und er oder sie hat mitgemacht",
            "Ich habe schon mal Sex während eines Urlaubs gehabt, über den ich zuhause nie gesprochen habe",
            "Ich habe schon mal mit jemandem geschlafen und es war so schlecht, dass ich es jemandem erzählt habe",
            "Ich habe schon mal jemanden durch ein einziges Outfit komplett um den Finger gewickelt",
            "Ich habe schon mal absichtlich jemanden so lange angeschaut, bis er oder sie rot geworden ist",
            "Ich habe schon mal Sex gehabt und dabei an etwas komplett anderes gedacht",
            "Ich habe schon mal jemanden für eine Nacht eingeladen und morgens bereut",
            "Ich habe schon mal mit jemandem geschlafen, den ich erst eine Stunde zuvor kennengelernt habe",
            "Ich habe schon mal jemanden beim ersten Kuss sofort mit nach Hause genommen",
            "Ich habe schon mal Sex gehabt und es danach jemandem erzählt, dem ich es nicht erzählen sollte",
            "Ich habe schon mal einen Menschen verführt, der eigentlich nicht auf mein Geschlecht steht",
            "Ich habe schon mal Sex während eines Telefonats mit jemand anderem gehabt",
            "Ich habe schon mal auf einem Konzert oder einer Party jemanden von hinten angemacht",
            "Ich habe schon mal eine Affäre angefangen, weil ich in meiner Beziehung unglücklich war",
            "Ich habe schon mal jemanden durch gezielten Augenkontakt verführt",
            "Ich habe schon mal mit jemandem geschlafen, den ich danach nie wieder sehen wollte",
            "Ich habe schon mal jemanden durch ein einziges Kompliment ins Bett gebracht",
            "Ich habe schon mal eine intime Situation absichtlich verlängert, obwohl sie hätte enden sollen",
            "Ich habe schon mal mit jemandem geschlafen, der oder die ein Geheimnis von mir kannte",
            "Ich habe schon mal mit jemandem geschlafen, nur weil er oder sie mir ein Kompliment gemacht hat",
            "Ich habe schon mal mit jemandem geschlafen, dem ich danach nicht in die Augen schauen konnte",
            "Ich habe schon mal Sex nach einem Spieleabend oder einer Partyspielrunde gehabt",
            "Ich habe schon mal Sex gehabt und es als Fehler bezeichnet",
            "Ich habe schon mal jemanden um Mitternacht nach Hause eingeladen mit einer klaren Absicht",
            "Ich habe schon mal Sex gehabt und gehofft es bleibt für immer ein Geheimnis",
            "Ich habe schon mal mit jemandem geschlafen, den ich eigentlich meinem besten Freund oder meiner besten Freundin vorstellen wollte",
            "Ich habe schon mal Sex in einem fremden Bett gehabt, das mir nicht gehörte",
            "Ich habe schon mal jemanden so lange angeschrieben, bis er oder sie nachgegeben hat",
            "Ich habe schon mal mit jemandem geschlafen und ihn oder sie am nächsten Morgen rausgeworfen",
            "Ich habe schon mal eine Nacht mit jemandem verbracht und so getan als wäre nichts gewesen",
            "Ich habe schon mal Sex gehabt, nur weil ich gelangweilt war",
            "Ich habe schon mal absichtlich eine Situation herbeigeführt, um jemanden zu berühren",
            "Ich habe schon mal ein Geheimnis über das Sexleben eines anderen weitergegeben",
            "Ich habe schon mal jemanden mit Handschellen oder Ähnlichem gefesselt oder mich fesseln lassen",
            "Ich habe schon mal Sex am Strand bei Nacht gehabt",
            "Ich habe schon mal Sex in einer Sauna oder einem Dampfbad gehabt",
            "Ich habe schon mal jemanden verführt, der oder die eigentlich gerade jemand anderen mochte",
            "Ich habe schon mal mit jemandem geschlafen und es danach bereut, weil es die Freundschaft zerstört hat",
            "Ich habe schon mal Sex gehabt und dabei so laut gewesen, dass es peinlich war",
            "Ich habe schon mal jemanden nach dem Sex nach Hause geschickt, bevor er oder sie einschlafen konnte",
            "Ich habe schon mal absichtlich freizügige Fotos verschickt, um jemanden auf Trab zu halten",
            "Ich habe schon mal Sex gehabt und es so gut gefunden, dass ich sofort nochmal wollte",
            "Ich habe schon mal jemanden durch einen langen Blick so nervös gemacht, dass er oder sie nicht mehr sprechen konnte",
            "Ich habe schon mal Sex gehabt, der so schlecht war, dass ich mitten drin aufgehört habe",
            "Ich habe schon mal mit jemandem geschlafen, den ich eigentlich hasse",
            "Ich habe schon mal Sex gehabt und dabei so getan als wäre ich jemand anderes",
            "Ich habe schon mal jemanden durch eine einzige Nachricht so weit gebracht, dass er oder sie sofort vorbeigekommen ist",
            "Ich habe schon mal mit jemandem geschlafen, der oder die eigentlich vergeben war und es mir vorher gesagt hat",
            "Ich habe schon mal Sex in einem Zelt oder Wohnmobil gehabt",
            "Ich habe schon mal jemanden verführt, der oder die eigentlich gerade Schluss gemacht hatte",
            "Ich habe schon mal mit jemandem geschlafen, nur weil ich gewinnen wollte",
            "Ich habe schon mal Sex gehabt und danach gemerkt, dass wir uns nie wirklich mochten",
            "Ich habe schon mal jemanden nach dem Sex angelogen, um ihn oder sie loszuwerden",
            "Ich habe schon mal Sex gehabt und dabei das Gefühl gehabt, beobachtet zu werden",
            "Ich habe schon mal mit jemandem geschlafen, dem ich vorher noch nie richtig ins Gesicht geschaut habe",
            "Ich habe schon mal Sex gehabt, der so intensiv war, dass ich danach geweint habe",
            "Ich habe schon mal jemanden verführt, nur um zu beweisen, dass ich es kann",
            "Ich habe schon mal mit jemandem geschlafen und ihn oder sie am nächsten Morgen nicht erkannt",
            "Ich habe schon mal Sex gehabt und dabei das Handy nicht weglegen können",
            "Ich habe schon mal Sex gehabt, der so gut war, dass ich die Person danach nicht mehr loslassen konnte",
            "Ich habe schon mal mit jemandem geschlafen und es danach als Experiment bezeichnet",
            "Ich habe schon mal Sex gehabt und dabei so getan, als hätte ich Gefühle, die ich nicht hatte",
            "Ich habe schon mal jemanden verführt, dem ich eigentlich etwas anderes versprochen hatte",
            "Ich habe schon mal mit jemandem geschlafen und danach so getan als wäre er oder sie nur ein Freund oder eine Freundin",
            "Ich habe schon mal Sex gehabt und den Namen der Person danach vergessen",
            "Ich habe schon mal jemanden durch eine Wette ins Bett gebracht",
            "Ich habe schon mal mit jemandem geschlafen, nur weil alle anderen auch jemanden hatten",
            "Ich habe schon mal Sex gehabt, der so unbequem war, dass ich mittendrin lachen musste",
            "Ich habe schon mal jemanden verführt, den ich danach nie wieder sehen wollte",
            "Ich habe schon mal mit jemandem geschlafen, der oder die mein Chef oder meine Chefin war",
            "Ich habe schon mal Sex in einem geparkten Auto auf einem öffentlichen Parkplatz gehabt",
            "Ich habe schon mal jemanden durch ein einziges Foto auf Social Media angemacht",
            "Ich habe schon mal mit jemandem geschlafen und dabei an die Konsequenzen gedacht und es trotzdem getan",
            "Ich habe schon mal Sex gehabt und direkt danach so getan als wäre ich müde, um alleine zu sein",
            "Ich habe schon mal jemanden verführt, der oder die eigentlich gerade frisch getrennt war",
            "Ich habe schon mal mit jemandem geschlafen und es danach als Versehen abgetan",
            "Ich habe schon mal Sex gehabt und mir vorher ausgemalt, dass es anders wird",
            "Ich habe schon mal jemanden durch eine gemeinsame Übernachtung verführt, ohne dass es geplant war",
            "Ich habe schon mal mit jemandem geschlafen, nur weil die Stimmung und der Alkohol es so wollten",
            "Ich habe schon mal Sex gehabt und hinterher nicht gewusst wie ich nach Hause komme"
        ],
        fsk16: [
"Ich würde meinen linken Nachbarn oder meine linke Nachbarin heute Nacht gerne küssen",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin ist im Bett besser als man denkt",
            "Ich würde mit jemandem aus dieser Runde heute Nacht gerne schlafen",
            "Ich glaube, ich habe den größten oder die größte in dieser Runde",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin hat den größten oder die größte hier",
            "Ich finde jemanden aus dieser Runde so attraktiv, dass ich kaum zuhören kann",
            "Ich würde mit meinem rechten Nachbarn oder meiner rechten Nachbarin tauschen wollen, nur für eine Nacht",
            "Ich glaube, jemand aus dieser Runde denkt gerade dasselbe wie ich",
            "Ich würde meinem linken Nachbarn oder meiner linken Nachbarin gerne zeigen, was ich kann",
            "Ich glaube, ich bin der beste Küsser oder die beste Küsserin in dieser Runde",
            "Ich würde mit jemandem aus dieser Runde gerne ein Sexspiel spielen",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin würde mich gerne küssen",
            "Ich würde jemanden aus dieser Runde gerne einmal im Bett erleben",
            "Ich glaube, jemand hier hat die schönsten Lippen der Runde",
            "Ich würde meinen linken Nachbarn oder meine linke Nachbarin heute Nacht gerne mit nach Hause nehmen",
            "Ich glaube, ich bin der oder die Heißeste in dieser Runde",
            "Ich würde mit jemandem aus dieser Runde gerne Wahrheit oder Pflicht spielen, aber nur zu zweit",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin würde mich nicht enttäuschen",
            "Ich würde jemanden aus dieser Runde gerne einmal richtig küssen, nur um zu sehen wie er oder sie reagiert",
            "Ich glaube, jemand hier hat den attraktivsten Körper der Runde",
            "Ich würde meinem rechten Nachbarn oder meiner rechten Nachbarin gerne etwas ins Ohr flüstern",
            "Ich glaube, jemand aus dieser Runde würde im Bett laut werden",
            "Ich würde mit meinem linken Nachbarn oder meiner linken Nachbarin gerne alleine in einem Zimmer eingeschlossen werden",
            "Ich glaube, ich bin besser im Bett als alle hier denken",
            "Ich würde jemanden aus dieser Runde gerne einmal nackt sehen",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin hat die attraktivsten Lippen hier",
            "Ich würde meinen linken Nachbarn oder meine linke Nachbarin gerne massieren oder massiert werden",
            "Ich glaube, jemand aus dieser Runde hat mich heute bereits auf eine Art angeschaut, die ich nicht vergessen werde",
            "Ich würde mit jemandem aus dieser Runde gerne eine Nacht in einem Hotel verbringen",
            "Ich glaube, ich hätte mit jemandem aus dieser Runde die beste Chemie im Bett",
            "Ich würde meinem rechten Nachbarn oder meiner rechten Nachbarin gerne beweisen, was ich kann",
            "Ich glaube, jemand hier würde sich über eine Nachricht von mir um Mitternacht freuen",
            "Ich würde jemanden aus dieser Runde gerne nach seiner oder ihrer Fantasie fragen",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin denkt gerade etwas, das er oder sie nicht sagen würde",
            "Ich würde mit jemandem aus dieser Runde gerne etwas ausprobieren, das ich noch nie gemacht habe",
            "Ich glaube, ich wäre der beste One-Night-Stand für jemanden aus dieser Runde",
            "Ich würde meinen rechten Nachbarn oder meine rechte Nachbarin gerne fragen, was er oder sie im Bett mag",
            "Ich glaube, jemand hier hat eine Fantasie über mich",
            "Ich würde jemanden aus dieser Runde gerne beim Tanzen sehr nah an mich heranziehen",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin ist der oder die Heißeste heute Abend",
            "Ich würde mit jemandem aus dieser Runde gerne nackt schwimmen gehen",
            "Ich glaube, jemand hier würde nicht Nein sagen, wenn ich ihn oder sie küsse",
            "Ich würde meinem rechten Nachbarn oder meiner rechten Nachbarin gerne eine Fantasie gestehen",
            "Ich glaube, ich hätte mit meinem linken Nachbarn oder meiner linken Nachbarin die meiste Spannung",
            "Ich würde jemanden aus dieser Runde gerne einmal wirklich verführen",
            "Ich glaube, jemand hier würde im Bett Dinge machen, die keiner erwartet",
            "Ich würde meinen linken Nachbarn oder meine linke Nachbarin gerne beim Aufwachen neben mir sehen",
            "Ich glaube, ich bin der oder die Mutigste im Bett in dieser Runde",
            "Ich würde mit jemandem aus dieser Runde gerne ein Spiel spielen, bei dem Kleidung verloren geht",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin würde mich nicht enttäuschen",
            "Ich würde jemanden aus dieser Runde gerne fragen, was seine oder ihre schlimmste Sexgeschichte ist",
            "Ich glaube, jemand aus dieser Runde hat das beste Lächeln um jemanden ins Bett zu bekommen",
            "Ich würde meinen linken Nachbarn oder meine linke Nachbarin gerne um Mitternacht anschreiben",
            "Ich glaube, ich habe heute die beste Figur in dieser Runde",
            "Ich würde mit meinem rechten Nachbarn oder meiner rechten Nachbarin gerne ein Taxi nach Hause teilen und dann noch etwas länger",
            "Ich glaube, jemand hier würde sich über ein anzügliches Kompliment von mir freuen",
            "Ich würde jemanden aus dieser Runde gerne in einer dunklen Ecke küssen",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin ist im Bett wilder als er oder sie aussieht",
            "Ich würde mit jemandem aus dieser Runde gerne eine Flasche Wein trinken, alleine",
            "Ich glaube, ich wäre für jemanden aus dieser Runde eine unvergessliche Nacht",
            "Ich würde meinem rechten Nachbarn oder meiner rechten Nachbarin gerne zeigen, wie ich küsse",
            "Ich glaube, jemand hier denkt gerade an Sex",
            "Ich würde jemanden aus dieser Runde gerne fragen, wo er oder sie am liebsten Sex hat",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin hat die schönsten Augen um jemanden zu verführen",
            "Ich würde mit jemandem aus dieser Runde gerne die Nacht durchmachen, aber nicht zum Reden",
            "Ich glaube, ich bin der oder die Beste im Küssen hier",
            "Ich würde meinen rechten Nachbarn oder meine rechte Nachbarin gerne fragen, was er oder sie sich für heute Nacht vorstellt",
            "Ich glaube, jemand hier würde mich nach diesem Abend gerne nochmal sehen, in einem anderen Kontext",
            "Ich würde jemanden aus dieser Runde gerne bei einem Rollenspiel überraschen",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin denkt gerade etwas Anzügliches",
            "Ich würde mit meinem linken Nachbarn oder meiner linken Nachbarin gerne etwas tun, worüber wir danach nicht reden",
            "Ich glaube, jemand hier hätte Lust, mich heute Nacht zu verführen",
            "Ich würde jemanden aus dieser Runde gerne nach seiner oder ihrer heißesten Nacht fragen",
            "Ich glaube, ich wäre im Bett die angenehmste Überraschung für jemanden aus dieser Runde",
            "Ich würde meinem rechten Nachbarn oder meiner rechten Nachbarin gerne etwas zeigen, das er oder sie noch nicht kennt",
            "Ich glaube, jemand hier hätte nichts dagegen, wenn ich ihn oder sie heute Nacht küsse",
            "Ich würde mit jemandem aus dieser Runde gerne in einem Pool oder See nackt schwimmen",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin hat die schönste Stimme um jemanden anzumachen",
            "Ich würde jemanden aus dieser Runde gerne einmal richtig verwöhnen",
            "Ich glaube, ich hätte heute Nacht die wildesten Ideen von allen hier",
            "Ich würde meinen linken Nachbarn oder meine linke Nachbarin gerne auf eine Art küssen, die er oder sie nicht erwartet",
            "Ich glaube, jemand aus dieser Runde hat schon mal an mich gedacht, auf eine bestimmte Art",
            "Ich würde mit jemandem aus dieser Runde gerne Strip-Poker spielen",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin ist heißer als er oder sie zugibt",
            "Ich würde jemanden aus dieser Runde gerne fragen, was er oder sie sich von mir wünscht",
            "Ich glaube, ich würde jemanden aus dieser Runde richtig überraschen, wenn wir alleine wären",
            "Ich würde meinem linken Nachbarn oder meiner linken Nachbarin gerne eine Nacht geben, die er oder sie nicht vergisst",
            "Ich glaube, jemand hier schaut mich heute Abend an und denkt sich mehr dabei als er oder sie zeigt",
            "Ich würde mit jemandem aus dieser Runde gerne die Klamotten tauschen und dann sehen was passiert",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin wäre ein perfekter One-Night-Stand",
            "Ich würde jemandem aus dieser Runde gerne ins Ohr flüstern, was ich mir für heute Nacht vorstelle",
            "Ich glaube, jemand hier würde im Bett keine Grenzen kennen",
            "Ich würde meinen rechten Nachbarn oder meine rechte Nachbarin gerne nach Hause einladen, mit einer klaren Absicht",
            "Ich glaube, ich wäre für meinen linken Nachbarn oder meine linke Nachbarin eine Versuchung",
            "Ich würde jemanden aus dieser Runde gerne fragen, wie lange er oder sie schon Single ist und warum",
            "Ich glaube, jemand hier hat heute Nacht Lust auf mehr als nur dieses Spiel",
            "Ich würde mit meinem linken Nachbarn oder meiner linken Nachbarin gerne die Nacht verbringen",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin wäre im Bett sehr leidenschaftlich",
            "Ich würde jemanden aus dieser Runde gerne heimlich beobachten wie er oder sie tanzt",
            "Ich glaube, ich bin heute der oder die Attraktivste in dieser Runde",
            "Ich würde meinen linken Nachbarn oder meine linke Nachbarin gerne nach seiner oder ihrer wildesten Fantasie fragen",
            "Ich glaube, jemand aus dieser Runde würde nichts dagegen haben, wenn ich ihn oder sie heute verführe",
            "Ich würde mit jemandem aus dieser Runde gerne etwas ausprobieren, das wir beide noch nie gemacht haben",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin hat heute Nacht Lust auf mich",
            "Ich würde meinem rechten Nachbarn oder meiner rechten Nachbarin gerne zeigen, was ein guter Kuss wirklich ist",
            "Ich glaube, jemand hier würde auch ohne Alkohol mit mir flirten",
            "Ich würde jemanden aus dieser Runde gerne fragen, ob er oder sie schon mal an mich gedacht hat",
            "Ich glaube, ich könnte jemanden aus dieser Runde heute Nacht verführen wenn ich wollte",
            "Ich würde meinen linken Nachbarn oder meine linke Nachbarin gerne nach seinem oder ihrem Lieblingskuss fragen",
            "Ich glaube, jemand hier würde mich morgen früh nicht gehen lassen wollen",
            "Ich würde mit jemandem aus dieser Runde gerne spontan irgendwo hinverschwinden",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin hätte heute Nacht Lust auf ein Abenteuer",
            "Ich würde jemanden aus dieser Runde gerne fragen, was er oder sie unter einer perfekten Nacht versteht",
            "Ich glaube, ich bin in dieser Runde derjenige oder diejenige mit den meisten Fantasien",
            "Ich würde meinen linken Nachbarn oder meine linke Nachbarin gerne beim ersten Kuss überraschen",
            "Ich glaube, jemand hier würde für mich heute Nacht eine Ausnahme machen",
            "Ich würde mit jemandem aus dieser Runde gerne wetten und als Einsatz eine Nacht vorschlagen",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin weiß genau wie er oder sie jemanden verrückt machen kann",
            "Ich würde jemanden aus dieser Runde gerne fragen, was er oder sie in dieser Sekunde denkt",
            "Ich glaube, ich würde als One-Night-Stand in dieser Runde am meisten begehrt werden",
            "Ich würde meinem linken Nachbarn oder meiner linken Nachbarin gerne heute Nacht beweisen, dass ich unvergesslich bin",
            "Ich glaube, jemand hier schaut mich an und fragt sich, wie ich küsse",
            "Ich würde mit jemandem aus dieser Runde gerne ein Spiel spielen, bei dem Ehrlichkeit bestraft wird",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin würde mich nach diesem Abend vermissen",
            "Ich würde jemandem aus dieser Runde gerne zeigen, was ich nachts so mache",
            "Ich glaube, ich könnte jemanden aus dieser Runde allein durch einen Blick nervös machen",
            "Ich würde meinen rechten Nachbarn oder meine rechte Nachbarin gerne nach seinem oder ihrem Körper fragen, direkt",
            "Ich glaube, jemand hier würde heute Nacht gerne mit mir verschwinden",
            "Ich würde jemanden aus dieser Runde gerne um eine Massage bitten und dann sehen was draus wird",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin hat eine Seite, die keiner hier kennt",
            "Ich würde mit meinem linken Nachbarn oder meiner linken Nachbarin gerne Geheimnisse austauschen, die wir niemandem sonst sagen",
            "Ich glaube, jemand hier hat heute schon an Sex gedacht und zwar nicht allein",
            "Ich würde jemanden aus dieser Runde gerne fragen, was er oder sie trägt, wenn er oder sie schläft",
            "Ich glaube, ich wäre für meinen rechten Nachbarn oder meine rechte Nachbarin eine angenehme Überraschung",
            "Ich würde meinem linken Nachbarn oder meiner linken Nachbarin gerne sagen, was ich wirklich von ihm oder ihr denke",
            "Ich glaube, jemand hier würde mir heute Nacht nicht Nein sagen",
            "Ich würde mit jemandem aus dieser Runde gerne eine Wette eingehen, bei der ich auf jeden Fall gewinne",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin ist besser im Bett als mein letzter Ex oder meine letzte Ex",
            "Ich würde jemanden aus dieser Runde gerne fragen, wie lange es her ist, dass er oder sie jemanden geküsst hat",
            "Ich glaube, ich bin heute Abend am meisten in der Stimmung von allen hier",
            "Ich würde meinem rechten Nachbarn oder meiner rechten Nachbarin gerne zeigen, wie eine echte Umarmung geht",
            "Ich glaube, jemand hier würde heute Nacht gerne mit mir tauschen",
            "Ich würde mit jemandem aus dieser Runde gerne einen Abend verbringen, über den wir beide schweigen",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin hat heute das schönste Lächeln um jemanden zu verführen",
            "Ich würde jemanden aus dieser Runde gerne fragen, was er oder sie anhat wenn er oder sie nachts allein ist",
            "Ich glaube, ich könnte jemanden aus dieser Runde durch einen einzigen Satz ins Bett bringen",
            "Ich würde meinen linken Nachbarn oder meine linke Nachbarin gerne fragen, wie oft er oder sie pro Woche Sex hat",
            "Ich glaube, jemand hier würde sich heute Nacht über eine Einladung von mir freuen",
            "Ich würde mit jemandem aus dieser Runde gerne eine Nacht verbringen, die keiner je erfahren soll",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin würde sich über ein anzügliches Kompliment von mir freuen",
            "Ich würde jemandem aus dieser Runde gerne sagen, was ich mir für heute Nacht vorstelle, aber nur wenn wir allein sind",
            "Ich glaube, jemand hier hat heute die knappste Unterwäsche an",
            "Ich würde meinen rechten Nachbarn oder meine rechte Nachbarin gerne fragen, was er oder sie am lautesten macht",
            "Ich glaube, ich hätte mit jemandem aus dieser Runde die intensivste Nacht meines Lebens",
            "Ich würde jemanden aus dieser Runde gerne bei einer Situation erwischen, die er oder sie nicht erklären kann",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin denkt gerade darüber nach wie ich küsse",
            "Ich würde mit meinem rechten Nachbarn oder meiner rechten Nachbarin gerne eine Stunde alleine verbringen, ohne Handy",
            "Ich glaube, jemand hier wäre im Bett die größte Überraschung des Abends",
            "Ich würde jemanden aus dieser Runde gerne nach seiner oder ihrer wildesten Nacht fragen",
            "Ich glaube, ich bin heute Abend der oder die Einzige hier, der oder die wirklich weiß was er oder sie will",
            "Ich würde meinem linken Nachbarn oder meiner linken Nachbarin gerne sagen, dass er oder sie heute unwiderstehlich aussieht",
            "Ich glaube, jemand aus dieser Runde würde für mich eine Ausnahme von seinen oder ihren Regeln machen",
            "Ich würde mit jemandem aus dieser Runde gerne eine Nacht verbringen, die wir beide nie vergessen",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin wäre beim Sex lauter als alle anderen hier",
            "Ich würde jemanden aus dieser Runde gerne fragen, bei wem er oder sie heute Nacht schlafen würde wenn er oder sie könnte",
            "Ich glaube, ich würde meinen linken Nachbarn oder meine linke Nachbarin nicht enttäuschen",
            "Ich würde mit jemandem aus dieser Runde gerne etwas machen, das wir niemandem erzählen",
            "Ich glaube, jemand hier hat heute die attraktivste Art sich zu bewegen",
            "Ich würde meinem rechten Nachbarn oder meiner rechten Nachbarin gerne eine Nacht geben, die er oder sie verdient",
            "Ich glaube, ich bin der oder die, den oder die jemand aus dieser Runde heute Nacht mit nach Hause nehmen würde",
            "Ich würde jemanden aus dieser Runde gerne um Mitternacht nach Hause begleiten und mehr",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin hat heute die knappste Unterwäsche an",
            "Ich würde mit meinem rechten Nachbarn oder meiner rechten Nachbarin gerne tauschen, nur für eine Nacht",
            "Ich glaube, jemand hier würde heute Nacht gerne nicht alleine schlafen",
            "Ich würde jemanden aus dieser Runde gerne nach seinem oder ihrem letzten One-Night-Stand fragen",
            "Ich glaube, ich bin in dieser Runde derjenige oder diejenige mit den wenigsten Hemmungen",
            "Ich würde meinem linken Nachbarn oder meiner linken Nachbarin gerne erklären, was ein perfekter Kuss ist, praktisch",
            "Ich glaube, jemand hier hat heute Abend den meisten Sexappeal",
            "Ich würde mit jemandem aus dieser Runde gerne das Spiel unterbrechen und einfach verschwinden",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin würde sich über ein anzügliches Geständnis von mir freuen",
            "Ich würde jemanden aus dieser Runde gerne fragen, was er oder sie macht, wenn er oder sie alleine ist",
            "Ich glaube, ich hätte mit meinem rechten Nachbarn oder meiner rechten Nachbarin die meiste Spannung",
            "Ich würde meinem linken Nachbarn oder meiner linken Nachbarin heute Nacht gerne alles zeigen was ich kann",
            "Ich glaube, jemand aus dieser Runde denkt gerade darüber nach, mich zu küssen",
            "Ich würde mit jemandem aus dieser Runde gerne eine Nacht einschließen und sehen was passiert",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin wäre mein Typ, wenn ich ehrlich bin",
            "Ich würde jemandem aus dieser Runde gerne sagen was ich an ihm oder ihr körperlich am attraktivsten finde",
            "Ich glaube, jemand hier würde mich nach diesem Spiel gerne alleine sprechen",
            "Ich würde meinen rechten Nachbarn oder meine rechte Nachbarin gerne fragen, was er oder sie anzieht wenn er oder sie jemanden verführen will",
            "Ich glaube, ich bin heute der oder die, für den oder die jemand in dieser Runde eine Ausnahme machen würde",
            "Ich würde jemanden aus dieser Runde gerne fragen, mit wem aus dieser Runde er oder sie heute Nacht schlafen würde",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin ist heiß genug um meine Regeln zu brechen",
            "Ich würde mit meinem linken Nachbarn oder meiner linken Nachbarin gerne herausfinden, ob die Chemie stimmt",
            "Ich glaube, jemand hier würde mich auch ohne dieses Spiel irgendwann angesprochen haben",
            "Ich würde jemanden aus dieser Runde gerne nach dem Abend auf einen Absacker einladen, bei mir zuhause",
            "Ich glaube, ich bin derjenige oder diejenige aus dieser Runde, der oder die heute Nacht am wenigsten alleine schlafen will",
            "Ich würde meinem linken Nachbarn oder meiner linken Nachbarin gerne beweisen, dass der Abend erst anfängt",
            "Ich glaube, jemand hier würde heute Nacht alles für ein Abenteuer mit mir stehen lassen",
            "Ich würde mit jemandem aus dieser Runde gerne eine Geschichte beginnen, die niemand sonst je erfährt",
            "Ich glaube, nach diesem Spiel werden zwei Leute aus dieser Runde zusammen nach Hause gehen"
        ],
        fsk18: [
            "Ich habe schon mal... an einem öffentlichen Ort geküsst",
            "Ich habe schon mal... eine peinliche Nachricht an die falsche Person geschickt",
            "Ich habe schon mal... in einer Beziehung gelogen"
        ]
    };

    const categoryNames = {
        'fsk0': '👨‍👩‍👧‍👦 Familie & Freunde',
        'fsk16': '🎉 Party Time',
        'fsk18': '🔥 Heiß & Gewagt',
        'special': '⭐ Special Edition'
    };

    const difficultyMultipliers = {
        'easy': 1,
        'medium': 1,
        'hard': 2
    };

    // ===========================
    // GLOBAL STATE
    // ===========================
    let gameListener = null;
    let roundListener = null;
    let roundListenerRef = null; // Store the Firebase ref for proper cleanup
    let currentGameData = null;
    let currentRoundData = null;
    let currentPlayers = {};
    let currentQuestion = null;
    let userAnswer = null;
    let userEstimation = null;
    let totalPlayers = 0;
    let currentQuestionNumber = 0;
    let currentPhase = 'question';
    let hasSubmittedThisRound = false; // P0: Anti-cheat
    let resultsDebounceTimer = null;   // Track results timeout so it can be cancelled
    let isLoadingRound = false;        // Prevent parallel loadRoundFromFirebase calls
    let timerSyncRef = null;
    let timerSyncCb = null;

    let connectedRef = null;
    let connectedCb = null;

    // Overall stats tracking
    let overallStats = {
        totalRounds: 0,
        playerStats: {}
    };

    // ✅ P2 PERFORMANCE: Track event listeners for cleanup
    const _phaseListeners = new Map(); // Listeners specific to each phase

    // ✅ P1 STABILITY: Reconnection and offline support
    let connectionState = 'connected';
    let reconnectAttempts = 0;
    let maxReconnectAttempts = 5;
    let offlineGameState = null; // Cached state for reconnection

    // ✅ P1 UI/UX: Timer management with server sync
    let questionTimer = null;
    let timerAnimationFrame = null;
    let timerStartTime = null;
    let timerDuration = 30000; // 30 seconds default (ms internally)
    let isPaused = false;
    let pausedTimeRemaining = 0;

    // ✅ P1 DSGVO: Data cleanup tracking
    let answerCleanupScheduled = false;
    const ANSWER_RETENTION_TIME = 10 * 60 * 1000; // 10 minutes (safe margin after round ends)

    

    // ===========================
    // ✅ P1 STABILITY: ERROR HANDLING
    // ===========================

    /**
     * ✅ P1 STABILITY: Monitor Firebase connection status
     */
    function setupConnectionMonitoring() {
        const _db = window.FirebaseConfig?.getFirebaseInstances?.()?.database;
        if (!_db?.ref) return;
        connectedRef = _db.ref('.info/connected');
        connectedCb = (snapshot) => {
            if (snapshot.val() === true) {
                if (connectionState === 'disconnected') {
                    console.log('✅ Reconnected to Firebase');
                    handleReconnection();
                }
                connectionState = 'connected';
                reconnectAttempts = 0;
                updateConnectionUI(true);
            } else {
                console.warn('⚠️ Disconnected from Firebase');
                connectionState = 'disconnected';
                handleDisconnection();
                updateConnectionUI(false);
            }
        };
        connectedRef.on('value', connectedCb);
    }

    /**
     * ✅ P1 STABILITY: Handle disconnection - save state offline
     */
    function handleDisconnection() {
        // Cache current game state for recovery
        offlineGameState = {
            gameId: MultiplayerGameplayModule.gameState.gameId,
            playerId: MultiplayerGameplayModule.gameState.playerId,
            playerName: MultiplayerGameplayModule.gameState.playerName,
            isHost: MultiplayerGameplayModule.gameState.isHost,
            currentQuestionNumber,
            currentPhase,
            userAnswer,
            userEstimation,
            hasSubmittedThisRound,
            currentQuestion,
            timestamp: Date.now()
        };

        // Save to localStorage
        if (window.NocapUtils && window.NocapUtils.setLocalStorage) {
            window.NocapUtils.setLocalStorage('nocap_offline_state', offlineGameState);
        } else {
            try {
                localStorage.setItem('nocap_offline_state', JSON.stringify(offlineGameState));
            } catch (e) {
                console.warn('⚠️ Could not save offline state:', e);
            }
        }

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('💾 Offline state saved:', offlineGameState);
        }

        showNotification('Verbindung unterbrochen - Daten werden lokal gespeichert', 'warning', 5000);
    }

    /**
     * ✅ P1 STABILITY: Handle reconnection - restore state
     */
    async function handleReconnection() {
        showNotification('Verbindung wiederhergestellt! Synchronisiere...', 'info', 3000);

        // Try to restore from cached state
        if (!offlineGameState) {
            // Load from localStorage
            if (window.NocapUtils && window.NocapUtils.getLocalStorage) {
                offlineGameState = window.NocapUtils.getLocalStorage('nocap_offline_state');
            } else {
                try {
                    const stored = localStorage.getItem('nocap_offline_state');
                    if (stored) {
                        offlineGameState = JSON.parse(stored);
                    }
                } catch (e) {
                    console.warn('⚠️ Could not load offline state:', e);
                }
            }
        }

        if (offlineGameState) {
            // Check if state is still valid (less than 10 minutes old)
            const age = Date.now() - offlineGameState.timestamp;
            if (age < 10 * 60 * 1000) {
                // Restore state
                currentQuestionNumber = offlineGameState.currentQuestionNumber;
                currentPhase = offlineGameState.currentPhase;
                userAnswer = offlineGameState.userAnswer;
                userEstimation = offlineGameState.userEstimation;
                hasSubmittedThisRound = offlineGameState.hasSubmittedThisRound;
                currentQuestion = offlineGameState.currentQuestion;

                if (MultiplayerGameplayModule.isDevelopment) {
                    console.log('✅ Restored from offline state:', offlineGameState);
                }

                // Reload current round from Firebase
                await loadRoundFromFirebase(currentQuestionNumber);

                // Restore UI
                updateGameDisplay();
                showPhase(currentPhase);

                showNotification('Spielstand wiederhergestellt! ✅', 'success', 3000);
            } else {
                console.warn('⚠️ Offline state too old, discarding');
                offlineGameState = null;
            }
        }

        // Clear offline state
        if (window.NocapUtils && window.NocapUtils.removeLocalStorage) {
            window.NocapUtils.removeLocalStorage('nocap_offline_state');
        } else {
            try {
                localStorage.removeItem('nocap_offline_state');
            } catch (e) {
                console.warn('[WARNING] Could not remove offline state from localStorage:', e.message);
            }
        }
    }

    /**
     * ✅ P1 UI/UX: Update connection indicator
     */
    function updateConnectionUI(isConnected) {
        const indicator = document.getElementById('connection-indicator');
        if (!indicator) return;

        if (isConnected) {
            indicator.classList.remove('disconnected');
            indicator.classList.add('connected');
            indicator.textContent = '🟢 Verbunden';
            indicator.setAttribute('aria-label', 'Mit Server verbunden');
        } else {
            indicator.classList.remove('connected');
            indicator.classList.add('disconnected');
            indicator.textContent = '🔴 Offline';
            indicator.setAttribute('aria-label', 'Vom Server getrennt');
        }
    }

    /**
     * ✅ P1 STABILITY: Handle Firebase errors with user-friendly UI feedback
     * @param {Error} error - The error object
     * @param {string} operation - Description of the operation that failed
     * @param {boolean} fatal - Whether this is a fatal error (redirects to lobby)
     */
    function handleFirebaseError(error, operation = 'Firebase operation', fatal = false) {
        console.error(`❌ ${operation} failed:`, error);

        // Get user-friendly error message
        const message = getFirebaseErrorMessage(error, operation);

        // Show notification to user
        if (window.NocapUtils && window.NocapUtils.showNotification) {
            window.NocapUtils.showNotification(message, 'error', fatal ? 10000 : 5000);
        } else {
            alert(message);
        }

        // Log to telemetry if available
        if (window.NocapUtils && window.NocapUtils.logError && !MultiplayerGameplayModule.isDevelopment) {
            window.NocapUtils.logError('MultiplayerGameplay', error, {
                operation,
                gameId: MultiplayerGameplayModule.gameState.gameId,
                isHost: MultiplayerGameplayModule.gameState.isHost
            });
        }

        // Handle fatal errors
        if (fatal) {
            setTimeout(() => {
                window.location.href = '/multiplayer-lobby.html';
            }, 3000);
        }
    }

    /**
     * Get user-friendly error message for Firebase errors
     */
    function getFirebaseErrorMessage(error, operation) {
        const errorCode = error?.code || '';

        const messages = {
            'PERMISSION_DENIED': 'Keine Berechtigung für diese Aktion',
            'permission-denied': 'Keine Berechtigung für diese Aktion',
            'NETWORK_ERROR': 'Netzwerkfehler - Prüfe deine Internetverbindung',
            'network-request-failed': 'Netzwerkfehler - Prüfe deine Internetverbindung',
            'TIMEOUT': `${operation} dauert zu lange`,
            'timeout': `${operation} dauert zu lange`,
            'NOT_FOUND': 'Spiel nicht gefunden',
            'not-found': 'Spiel nicht gefunden',
            'UNAVAILABLE': 'Firebase nicht verfügbar',
            'unavailable': 'Firebase nicht verfügbar'
        };

        return messages[errorCode] || `${operation} fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`;
    }

    // ===========================
    // P0 FIX: INPUT SANITIZATION
    // ===========================

    /**
     * ✅ P0 SECURITY: Sanitize with DOMPurify (required for XSS protection)
     * @param {string} input - The input to sanitize
     * @param {boolean} allowHtml - Whether to allow safe HTML (default: false)
     * @returns {string} Sanitized text
     */
    function sanitizeWithDOMPurify(input, allowHtml = false) {
        if (!input) return '';

        if (typeof DOMPurify === 'undefined') {
            console.error('❌ CRITICAL: DOMPurify not available!');
            // Fallback to aggressive stripping
            return String(input).replace(/<[^>]*>/g, '').substring(0, 500);
        }

        if (allowHtml) {
            // Allow only safe HTML tags
            return DOMPurify.sanitize(input, {
                ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'span'],
                ALLOWED_ATTR: []
            });
        }

        // Strip all HTML
        return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
    }

    function sanitizeText(input) {
        if (!input) return '';

        // Use DOMPurify first
        const purified = sanitizeWithDOMPurify(input, false);

        // Additional fallback with NocapUtils
        if (window.NocapUtils && window.NocapUtils.sanitizeInput) {
            return window.NocapUtils.sanitizeInput(purified).substring(0, 500);
        }

        return purified.substring(0, 500);
    }

    function sanitizePlayerName(name) {
        if (!name) return 'Spieler';

        // Use DOMPurify first
        const purified = sanitizeWithDOMPurify(name, false);

        // Additional fallback with NocapUtils
        if (window.NocapUtils && window.NocapUtils.sanitizeInput) {
            return window.NocapUtils.sanitizeInput(purified).substring(0, 20);
        }

        return purified.substring(0, 20);
    }
    function getPlayerKey() {
        // Always use live auth.uid — must match $uid in DB Rules
        const uid = firebase.auth().currentUser?.uid;
        if (uid) return uid;
        return MultiplayerGameplayModule.gameState?.playerId || null;
    }


    // ===========================
    // INITIALIZATION
    // ===========================

    async function initialize() {
        if (window.NocapUtils && window.NocapUtils.ensureGatesAccepted) {
            await window.NocapUtils.ensureGatesAccepted();
        }

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('🎮 Initializing multiplayer gameplay...');
        }

        showLoading();

        // P0 FIX: Check DOMPurify
        if (typeof DOMPurify === 'undefined') {
            console.error('❌ CRITICAL: DOMPurify not loaded!');
            alert('Sicherheitsfehler: Die Anwendung kann nicht gestartet werden.');
            return;
        }

        // Check dependencies
        if (typeof window.GameState === 'undefined') {
            console.error('❌ MultiplayerGameplayModule.gameState not loaded');
            showNotification('Fehler beim Laden', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }
// ✅ Ensure Firebase is initialized (consistent with other pages)
        try {
            if (!window.FirebaseConfig) {
                throw new Error('FirebaseConfig missing - firebase-config.js not loaded?');
            }
            if (!window.FirebaseConfig.isInitialized?.()) {
                await window.FirebaseConfig.initialize();
            }
            if (window.FirebaseConfig.waitForFirebase) {
                await window.FirebaseConfig.waitForFirebase(10000);
            }

        } catch (e) {
            console.error('❌ Firebase not initialized:', e);
            showNotification('Firebase nicht verfügbar', 'error');
            hideLoading();
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }

        // P1 FIX: Wait for dependencies
        if (window.NocapUtils && window.NocapUtils.waitForDependencies) {
            await window.NocapUtils.waitForDependencies(['GameState', 'FirebaseConfig', 'firebase']);
        }

        MultiplayerGameplayModule.gameState = new window.GameState();

        // ✅ CRITICAL FIX: Restore MultiplayerGameplayModule.gameState from multiple sources
        let stateRestored = false;

        // Method 1: Try NocapUtils
        if (window.NocapUtils && window.NocapUtils.getLocalStorage) {
            const savedState = window.NocapUtils.getLocalStorage('nocap_game_state');
            if (savedState && typeof savedState === 'object' && savedState.gameId) {
                if (MultiplayerGameplayModule.isDevelopment) {
                    console.log('🔄 Restoring from NocapUtils:', savedState);
                }
                restoreGameState(savedState);
                stateRestored = true;
            }
        }

        // Method 2: Try direct localStorage
        if (!stateRestored) {
            try {
                const savedStateStr = localStorage.getItem('nocap_game_state');
                if (savedStateStr) {
                    const savedState = JSON.parse(savedStateStr);
                    if (savedState && savedState.gameId) {
                        if (MultiplayerGameplayModule.isDevelopment) {
                            console.log('🔄 Restoring from localStorage:', savedState);
                        }
                        restoreGameState(savedState);
                        stateRestored = true;
                    }
                }
            } catch (e) {
                console.warn('⚠️ Could not parse localStorage:', e);
            }
        }

        // Method 3: Try MultiplayerGameplayModule.gameState's own properties (might be set already)
        if (!stateRestored && MultiplayerGameplayModule.gameState.gameId && MultiplayerGameplayModule.gameState.deviceMode) {
            if (MultiplayerGameplayModule.isDevelopment) {
                console.log('✅ MultiplayerGameplayModule.gameState already initialized');
            }
            stateRestored = true;
        }

        // ✅ FALLBACK: If still no state, try to recover from sessionStorage or URL
        if (!stateRestored) {
            console.warn('⚠️ No saved state found - attempting recovery');

            // Try sessionStorage nocap_game_state first (lobby writes full state here)
            try {
                const sessionFullState = sessionStorage.getItem('nocap_game_state');
                if (sessionFullState) {
                    const parsed = JSON.parse(sessionFullState);
                    if (parsed && parsed.gameId) {
                        restoreGameState(parsed);
                        stateRestored = true;
                        console.log('📝 Recovered full state from sessionStorage nocap_game_state');
                    }
                }
            } catch (e) {}

            // Try sessionStorage individual keys
            try {
                const sessionState = sessionStorage.getItem('nocap_game_id');
                if (sessionState) {
                    MultiplayerGameplayModule.gameState.gameId = sessionState;
                    MultiplayerGameplayModule.gameState.setDeviceMode('multi');
                    console.log('📝 Recovered gameId from sessionStorage:', sessionState);
                    stateRestored = true;
                }
                // Also recover playerName and isHost from sessionStorage
                const sessionName = sessionStorage.getItem('nocap_player_name');
                const sessionIsHost = sessionStorage.getItem('nocap_is_host');
                if (sessionName) MultiplayerGameplayModule.gameState.playerName = sessionName;
                if (sessionIsHost !== null) {
                    MultiplayerGameplayModule.gameState.isHost = sessionIsHost === 'true';
                    MultiplayerGameplayModule.gameState.isGuest = sessionIsHost !== 'true';
                }
            } catch (e) {
                console.warn('[WARNING] Could not recover state from sessionStorage:', e.message);
            }

            // Try URL params
            if (!stateRestored) {
                const urlParams = new URLSearchParams(window.location.search);
                const urlGameId = urlParams.get('gameId');
                if (urlGameId) {
                    MultiplayerGameplayModule.gameState.gameId = urlGameId;
                    MultiplayerGameplayModule.gameState.setDeviceMode('multi');
                    console.log('📝 Recovered gameId from URL:', urlGameId);
                    stateRestored = true;
                }
            }
        }

        // ✅ ABSOLUTE FALLBACK: If nothing worked, just set multi mode (will fail validation)
        if (!MultiplayerGameplayModule.gameState.deviceMode) {
            console.warn('⚠️ Setting deviceMode to multi as absolute fallback');
            MultiplayerGameplayModule.gameState.setDeviceMode('multi');
        }

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('✅ MultiplayerGameplayModule.gameState after restore:', {
                deviceMode: MultiplayerGameplayModule.gameState.deviceMode,
                gameId: MultiplayerGameplayModule.gameState.gameId,
                isHost: MultiplayerGameplayModule.gameState.isHost,
                playerId: MultiplayerGameplayModule.gameState.playerId,
                stateRestored: stateRestored
            });
        }

        // Helper function to restore state
        function restoreGameState(savedState) {
            if (savedState.gameId) MultiplayerGameplayModule.gameState.gameId = savedState.gameId;
            if (savedState.playerId) MultiplayerGameplayModule.gameState.playerId = savedState.playerId;
            if (savedState.playerName) MultiplayerGameplayModule.gameState.playerName = savedState.playerName;
            if (savedState.isHost !== undefined) MultiplayerGameplayModule.gameState.isHost = savedState.isHost;
            if (savedState.isGuest !== undefined) MultiplayerGameplayModule.gameState.isGuest = savedState.isGuest;
            if (savedState.gamePhase) MultiplayerGameplayModule.gameState.gamePhase = savedState.gamePhase;
            if (savedState.selectedCategories) MultiplayerGameplayModule.gameState.selectedCategories = savedState.selectedCategories;
            if (savedState.difficulty) MultiplayerGameplayModule.gameState.difficulty = savedState.difficulty;
            if (savedState.deviceMode) MultiplayerGameplayModule.gameState.setDeviceMode(savedState.deviceMode);
        }

        // Validate state
        if (!validateGameState()) {
            hideLoading();
            return;
        }

        // P0 FIX: Use global firebaseGameService
        if (typeof window.FirebaseService !== 'undefined') {
            MultiplayerGameplayModule.firebaseService = window.FirebaseService;

        } else {
            console.error('❌ Firebase service not available');
            showNotification('Firebase nicht verfügbar', 'error');
            hideLoading();
            return;
        }
        // ✅ Ensure auth is ready (otherwise currentUser can be null on first load)
        await new Promise((resolve) => {
            try {
                const unsub = firebase.auth().onAuthStateChanged(() => {
                    try { unsub(); } catch (_) {}
                    resolve();
                });
                // safety timeout
                setTimeout(resolve, 3000);
            } catch (_) {
                resolve();
            }
        });

// ✅ FIX: Recover missing playerId from Firebase Auth (needed after sessionStorage recovery)
        // Wait for auth state to be ready (currentUser can be null during init)
        let authedUser = firebase.auth().currentUser;
        if (!authedUser) {
            try {
                authedUser = await new Promise((resolve) => {
                    const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
                        unsubscribe();
                        resolve(user);
                    });
                    setTimeout(() => resolve(null), 5000); // 5s timeout
                });
            } catch (e) {
                console.warn('⚠️ Auth state wait failed:', e.message);
            }
        }

        if (authedUser && authedUser.uid) {
            MultiplayerGameplayModule.gameState.playerId = authedUser.uid;
        }

        // ✅ FIX: Re-register player in DB if missing (after auth UID change on reload)
        try {
            const u = authedUser;
            if (u && MultiplayerGameplayModule.gameState.gameId) {
                const gameId = MultiplayerGameplayModule.gameState.gameId;

                // Read hostId from DB to determine role
                const hostSnap = await firebase.database()
                    .ref(`games/${gameId}/hostId`).once('value');
                const hostId = hostSnap.val();
                let isHost = hostId === u.uid;

                // Check if we were the host via saved state (UID may have changed after reload)
                let wasHostByLocalStorage = false;
                if (!isHost) {
                    // Check localStorage
                    try {
                        const savedState = JSON.parse(localStorage.getItem('nocap_game_state') || '{}');
                        if (savedState.isHost === true && savedState.gameId === gameId) {
                            wasHostByLocalStorage = true;
                            isHost = true;
                        }
                    } catch (_) {}
                    // Check sessionStorage nocap_game_state (lobby writes full state here)
                    if (!wasHostByLocalStorage) {
                        try {
                            const ssState = JSON.parse(sessionStorage.getItem('nocap_game_state') || '{}');
                            if (ssState.isHost === true && ssState.gameId === gameId) {
                                wasHostByLocalStorage = true;
                                isHost = true;
                            }
                        } catch (_) {}
                    }
                    // Check sessionStorage nocap_is_host key
                    if (!wasHostByLocalStorage) {
                        try {
                            if (sessionStorage.getItem('nocap_is_host') === 'true') {
                                wasHostByLocalStorage = true;
                                isHost = true;
                            }
                        } catch (_) {}
                    }
                }

                // Update gameState role now (before setupFirebaseListeners)
                MultiplayerGameplayModule.gameState.isHost = isHost;
                MultiplayerGameplayModule.gameState.isGuest = !isHost;

                // Read player name
                let playerName = MultiplayerGameplayModule.gameState.playerName;
                if (!playerName) {
                    try {
                        const ss = sessionStorage.getItem('nocap_player_name');
                        if (ss) { playerName = ss; }
                        else {
                            const savedState = JSON.parse(localStorage.getItem('nocap_game_state') || '{}');
                            playerName = savedState.playerName || (isHost ? 'Host' : 'Spieler');
                        }
                        MultiplayerGameplayModule.gameState.playerName = playerName;
                    } catch (_) { playerName = isHost ? 'Host' : 'Spieler'; }
                }

                // STEP 1: Write /players/$uid FIRST (auth.uid === $playerId always allowed)
                const playerRef = firebase.database().ref(`games/${gameId}/players/${u.uid}`);
                const snap = await playerRef.once('value');
                if (!snap.exists()) {
                    await playerRef.set({
                        name: playerName,
                        playerId: u.uid,
                        isHost,
                        isGuest: !isHost,
                        joinedAt: Date.now(),
                        rejoinedAt: Date.now(),
                        online: true
                    });
                    console.log('✅ Player re-registered in DB as', isHost ? 'host' : 'guest');
                } else {
                    const existingName = snap.val().name;
                    if (!existingName || existingName === 'Spieler' || existingName === 'Host') {
                        await playerRef.update({ name: playerName });
                    }
                }

                // STEP 2: Update hostId AFTER player entry with isHost:true exists
                if (wasHostByLocalStorage) {
                    await firebase.database().ref(`games/${gameId}`).update({ hostId: u.uid });
                    console.log('✅ Host UID updated in Firebase after reload');
                }
            }
        } catch (e) {
            console.warn('⚠️ Re-register failed:', e.message);
        }

        // Setup Firebase listeners
        await setupFirebaseListeners();

        // ✅ P1 STABILITY: Setup connection monitoring
        setupConnectionMonitoring();

        // Initialize UI
        updateGameDisplay();
        createNumberGrid();
        updateSubmitButton();

        // Setup event listeners
        setupEventListeners();

        // Show/hide role-based controls
        updateUIForRole();

        hideLoading();
        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('✅ Gameplay initialized');
        }
    }

    // ===========================
    // VALIDATION
    // ===========================

    function validateGameState() {
        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('🔍 Validating game state...');
        }

        if (!MultiplayerGameplayModule.gameState || MultiplayerGameplayModule.gameState.deviceMode !== 'multi') {
            console.error('❌ Invalid device mode:', MultiplayerGameplayModule.gameState?.deviceMode);
            showNotification('Kein Multiplayer-Spiel aktiv!', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        if (!MultiplayerGameplayModule.gameState.gameId) {
            console.error('❌ No game ID');
            showNotification('Keine Spiel-ID gefunden!', 'error');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return false;
        }

        // ✅ FSK18-SYSTEM: Simplified validation - no kick in gameplay
        // Just log warnings about FSK18 content
        try {
            const rawSelected = MultiplayerGameplayModule.gameState.selectedCategories || [];
            const selectedCategories = Array.isArray(rawSelected)
                ? rawSelected
                : (rawSelected ? Object.values(rawSelected) : []);

            const hasFSK18 = selectedCategories.includes('fsk18');

            if (hasFSK18 && MultiplayerGameplayModule.isDevelopment) {
                console.log('🔒 FSK18 content in game - questions will be validated per-question');
            }
        } catch (e) {
            console.warn('⚠️ Could not check categories:', e);
        }

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('✅ Game state valid');
        }

        return true;
    }
    // ===========================
    // EVENT LISTENERS
    // ===========================

    function setupEventListeners() {
        // Answer buttons
        const yesBtn = document.getElementById('yes-btn');
        const noBtn = document.getElementById('no-btn');

        if (yesBtn) addTrackedEventListener(yesBtn, 'click', () => selectAnswer(true));
        if (noBtn) addTrackedEventListener(noBtn, 'click', () => selectAnswer(false));

        // Submit button
        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn) {
            addTrackedEventListener(submitBtn, 'click', submitAnswers);
        }

        // Host controls
        const nextQuestionBtn = document.getElementById('next-question-btn');
        if (nextQuestionBtn) {
            addTrackedEventListener(nextQuestionBtn, 'click', nextQuestion);
        }

        const showOverallBtn = document.getElementById('show-overall-btn');
        if (showOverallBtn) {
            addTrackedEventListener(showOverallBtn, 'click', showOverallResults);
        }

        // Pause button
        const pauseTimerBtn = document.getElementById('pause-timer-btn');
        if (pauseTimerBtn) {
            addTrackedEventListener(pauseTimerBtn, 'click', pauseTimer);
        }

        // Overall results controls
        const continueGameBtn = document.getElementById('continue-game-btn');
        if (continueGameBtn) {
            addTrackedEventListener(continueGameBtn, 'click', continueGame);
        }

        const endGameBtn = document.getElementById('end-game-btn');
        if (endGameBtn) {
            addTrackedEventListener(endGameBtn, 'click', endGameForAll);
        }

        // ✅ P1 UI/UX: Keyboard shortcuts
        setupKeyboardShortcuts();

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('✅ Event listeners setup');
        }
    }

    /**
     * ✅ P1 UI/UX: Setup keyboard shortcuts for accessibility
     */
    function setupKeyboardShortcuts() {
        addTrackedEventListener(document, 'keydown', (e) => {
            // Only in question phase
            if (currentPhase !== 'question' || hasSubmittedThisRound) return;

            // Number keys 0-9 for estimation
            if (e.key >= '0' && e.key <= '9') {
                const number = parseInt(e.key);
                const maxPlayers = totalPlayers || 8;
                if (number <= maxPlayers) {
                    selectNumber(number);
                    e.preventDefault();
                }
            }

            // Y for Yes
            if (e.key.toLowerCase() === 'y' || e.key.toLowerCase() === 'j') {
                selectAnswer(true);
                e.preventDefault();
            }

            // N for No
            if (e.key.toLowerCase() === 'n') {
                selectAnswer(false);
                e.preventDefault();
            }

            // Enter to submit
            if (e.key === 'Enter' && userAnswer !== null && userEstimation !== null) {
                submitAnswers();
                e.preventDefault();
            }
        });

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('⌨️ Keyboard shortcuts enabled');
        }
    }

    // ===========================
    // ✅ P2 PERFORMANCE: LISTENER MANAGEMENT
    // ===========================

    /**
     * ✅ P2 PERFORMANCE: Cleanup listeners for a specific phase
     * @param {string} phase - The phase to cleanup listeners for
     */
    function cleanupPhaseListeners(phase) {
        const listeners = _phaseListeners.get(phase);
        if (!listeners) return;

        listeners.forEach(({ element, event, handler }) => {
            if (element && element.removeEventListener) {
                element.removeEventListener(event, handler);
            }
        });

        _phaseListeners.delete(phase);

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log(`🧹 Cleaned up ${listeners.length} listeners for phase: ${phase}`);
        }
    }

    /**
     * ✅ P2 PERFORMANCE: Add phase-specific event listener
     * @param {string} phase - The phase this listener belongs to
     * @param {Element} element - DOM element
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     */
    function addPhaseListener(phase, element, event, handler) {
        if (!element) return;

        addTrackedEventListener(element, event, handler);

        if (!_phaseListeners.has(phase)) {
            _phaseListeners.set(phase, []);
        }

        _phaseListeners.get(phase).push({ element, event, handler });

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log(`📌 Added ${event} listener for phase: ${phase}`);
        }
    }

    // ===========================
    // ✅ P1 UI/UX: TIMER MANAGEMENT WITH SERVER SYNC
    // ===========================

    /**
     * ✅ P1 UI/UX: Start countdown timer with server timestamp
     * @param {number} serverStartTime - Server timestamp when timer started
     * @param {number} duration - Duration in milliseconds
     */
    function startTimer(serverStartTime, duration = timerDuration) {
        stopTimer(); // Clear any existing timer

        timerStartTime = serverStartTime || Date.now();
        timerDuration = duration;
        isPaused = false;

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('⏱️ Starting timer:', { serverStartTime, duration });
        }

        updateTimerDisplay();
    }

    /**
     * ✅ P2 PERFORMANCE: Update timer using requestAnimationFrame
     */
    function updateTimerDisplay() {
        if (isPaused) return;

        const now = Date.now();
        const elapsed = now - timerStartTime;
        const remaining = Math.max(0, timerDuration - elapsed);

        // Update progress bar
        const progressBar = document.getElementById('timer-progress');
        if (progressBar) {
            const percentage = (remaining / timerDuration) * 100;
            progressBar.style.width = `${percentage}%`;

            // Color coding
            if (percentage > 50) {
                progressBar.style.backgroundColor = '#4caf50'; // green
            } else if (percentage > 25) {
                progressBar.style.backgroundColor = '#ff9800'; // orange
            } else {
                progressBar.style.backgroundColor = '#f44336'; // red
            }
        }

        // Update text display
        const timerText = document.getElementById('timer-text');
        if (timerText) {
            const seconds = Math.ceil(remaining / 1000);
            timerText.textContent = `${seconds}s`;
        }

        // Timer expired
        if (remaining <= 0) {
            stopTimer();
            handleTimerExpired();
            return;
        }

        // Continue animation
        timerAnimationFrame = requestAnimationFrame(updateTimerDisplay);
    }

    /**
     * ✅ P1 UI/UX: Stop timer
     */
    function stopTimer() {
        if (timerAnimationFrame) {
            cancelAnimationFrame(timerAnimationFrame);
            timerAnimationFrame = null;
        }

        if (questionTimer) {
            clearTimeout(questionTimer);
            questionTimer = null;
        }
    }

    /**
     * ✅ P1 UI/UX: Pause timer (HOST ONLY)
     */
    async function pauseTimer() {
        if (!validateHostRole('Timer pausieren')) {
            return;
        }

        if (isPaused) {
            // Resume
            isPaused = false;
            timerStartTime = Date.now() - (timerDuration - pausedTimeRemaining);

            try {
                await firebase.database().ref(`games/${MultiplayerGameplayModule.gameState.gameId}`).update({
                    timerPaused: false,
                    timerStartTime: firebase.database.ServerValue.TIMESTAMP,
                    timerRemaining: pausedTimeRemaining
                });

                showNotification('Timer fortgesetzt ▶️', 'info', 2000);
                updateTimerDisplay();
            } catch (error) {
                handleFirebaseError(error, 'Timer fortsetzen', false);
            }
        } else {
            // Pause
            isPaused = true;
            const now = Date.now();
            const elapsed = now - timerStartTime;
            pausedTimeRemaining = Math.max(0, timerDuration - elapsed);

            stopTimer();

            try {
                await firebase.database().ref(`games/${MultiplayerGameplayModule.gameState.gameId}`).update({
                    timerPaused: true,
                    timerRemaining: pausedTimeRemaining
                });

                showNotification('Timer pausiert ⏸️', 'warning', 2000);
            } catch (error) {
                handleFirebaseError(error, 'Timer pausieren', false);
            }
        }

        updatePauseButton();
    }

    /**
     * ✅ P1 UI/UX: Update pause button state
     */
    function updatePauseButton() {
        const pauseBtn = document.getElementById('pause-timer-btn');
        if (!pauseBtn) return;

        if (isPaused) {
            pauseBtn.textContent = '▶️ Fortsetzen';
            pauseBtn.classList.add('paused');
        } else {
            pauseBtn.textContent = '⏸️ Pausieren';
            pauseBtn.classList.remove('paused');
        }
    }

    /**
     * ✅ P1 UI/UX: Handle timer expiration
     */
    function handleTimerExpired() {
        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('⏱️ Timer expired!');
        }

        showNotification('Zeit abgelaufen! ⏰', 'warning', 3000);

        // Auto-submit if not submitted yet
        if (!hasSubmittedThisRound && userAnswer !== null && userEstimation !== null) {
            submitAnswers();
        } else if (!hasSubmittedThisRound) {
            showNotification('Du hast nicht rechtzeitig geantwortet!', 'error', 3000);
            // Submit empty answer to not block others
            if (userAnswer === null) userAnswer = false;
            if (userEstimation === null) userEstimation = 0;
            submitAnswers();
        }
    }

    // ===========================
    // ✅ P0 SECURITY: HOST VALIDATION
    // ===========================

    /**
     * ✅ P0 SECURITY: Validate that current user is the host before executing host-only operations
     * @param {string} operation - Description of the operation (for error messages)
     * @returns {boolean} True if user is host, false otherwise
     */
    function validateHostRole(operation = 'Diese Aktion') {
        if (!MultiplayerGameplayModule.gameState.isHost) {
            console.warn(`⚠️ Guest attempted host operation: ${operation}`);

            if (window.NocapUtils && window.NocapUtils.showNotification) {
                window.NocapUtils.showNotification(
                    'Nur der Host kann diese Aktion ausführen',
                    'warning',
                    3000
                );
            } else {
                alert('Nur der Host kann diese Aktion ausführen');
            }

            // Log security event in production
            if (window.NocapUtils && window.NocapUtils.logError && !MultiplayerGameplayModule.isDevelopment) {
                window.NocapUtils.logError('MultiplayerGameplay',
                    new Error(`Unauthorized host operation: ${operation}`), {
                    operation,
                    gameId: MultiplayerGameplayModule.gameState.gameId,
                    playerId: MultiplayerGameplayModule.gameState.playerId
                });
            }

            return false;
        }

        return true;
    }

    // ===========================
    // ✅ P1 DSGVO: DATA MINIMIZATION & CLEANUP
    // ===========================

    /**
     * ✅ P1 DSGVO: Schedule automatic deletion of answer data
     * @param {number} roundNumber - The round number to clean up
     */
    function scheduleAnswerCleanup(roundNumber) {
        if (answerCleanupScheduled) return;
        if (!MultiplayerGameplayModule.gameState.isHost) return; // Only host performs cleanup

        answerCleanupScheduled = true;

        setTimeout(async () => {
            try {
                const roundRef = firebase.database().ref(
                    `games/${MultiplayerGameplayModule.gameState.gameId}/rounds/round_${roundNumber}/answers`
                );

                // Get answers for aggregation
                const snapshot = await roundRef.once('value');
                if (snapshot.exists()) {
                    const answers = snapshot.val();

                    // Create anonymized summary
                    const summary = {
                        totalAnswers: Object.keys(answers).length,
                        yesCount: Object.values(answers).filter(a => a.answer === true).length,
                        aggregatedAt: Date.now()
                    };

                    // Save summary
                    await firebase.database()
                        .ref(`games/${MultiplayerGameplayModule.gameState.gameId}/rounds/round_${roundNumber}/summary`)
                        .set(summary);

                    // Delete individual answers (DSGVO data minimization)
                    await roundRef.remove();

                    if (MultiplayerGameplayModule.isDevelopment) {
                        console.log(`🗑️ Cleaned up answers for round ${roundNumber}`);
                    }
                }

                answerCleanupScheduled = false;
            } catch (error) {
                console.error('❌ Error cleaning up answers:', error);
                answerCleanupScheduled = false;
            }
        }, ANSWER_RETENTION_TIME);
    }

    /**
     * ✅ FSK18-SYSTEM: Verify age for FSK18 questions with server validation
     * - FSK0 & FSK16: Always allowed
     * - FSK18: Requires server validation via GameState.canAccessFSK()
     * @param {string} category - Question category
     * @returns {Promise<boolean>} True if user is allowed to see this question
     */
    async function verifyAgeForQuestion(category) {
        // FSK0 & FSK16: Always allowed
        if (category !== 'fsk18') {
            return true;
        }

        // FSK18: Server validation required
        if (!window.FirebaseConfig?.isInitialized?.()) {
            // Fail closed - no Firebase = no FSK18
            return false;
        }

        try {
            // Use GameState's server validation
            const hasAccess = await MultiplayerGameplayModule.gameState.canAccessFSK('fsk18', true);

            if (!hasAccess && MultiplayerGameplayModule.isDevelopment) {
                console.log('❌ FSK18 access denied for question');
            }

            return hasAccess;
        } catch (error) {
            console.error('❌ FSK18 validation error:', error);
            return false; // Fail closed on error
        }
    }

    // ===========================
    // FIREBASE LISTENERS - REAL-TIME SYNC
    // ===========================

    async function setupFirebaseListeners() {
        if (!MultiplayerGameplayModule.firebaseService || !MultiplayerGameplayModule.gameState.gameId) {
            console.error('❌ Cannot setup listeners - missing service or gameId');
            handleFirebaseError(
                new Error('Service or GameID missing'),
                'Listener-Setup',
                true // fatal
            );
            return;
        }

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('🎧 Setting up Firebase listeners...');
        }

        try {
            const gameRef = firebase.database().ref(`games/${MultiplayerGameplayModule.gameState.gameId}`);

            // ✅ P1 STABILITY: Error handler for listener
            gameRef.on('value', (snapshot) => {
                try {
                    if (!snapshot.exists()) {
                        console.warn('⚠️ Game not found');
                        handleFirebaseError(new Error('Game not found'), 'Spiel-Synchronisation', false);
                        cleanup();
                        setTimeout(() => window.location.href = 'index.html', 2000);
                        return;
                    }

                    currentGameData = snapshot.val();
                    currentPlayers = currentGameData.players || {};
                    updatePlayersCount();

                    // ✅ FIX: Determine role from DB — only update when uid is reliably known
                    try {
                        const uid = firebase.auth().currentUser?.uid || MultiplayerGameplayModule.gameState.playerId;
                        if (uid && currentGameData.hostId) {
                            const isHostNow = currentGameData.hostId === uid;
                            // Only write isHost/isGuest when uid is confirmed — never overwrite with stale null
                            MultiplayerGameplayModule.gameState.isHost = isHostNow;
                            MultiplayerGameplayModule.gameState.isGuest = !isHostNow;
                            MultiplayerGameplayModule.gameState.playerId = uid;

                            // ✅ Recover categories from DB if missing
                            if (!MultiplayerGameplayModule.gameState.selectedCategories?.length && currentGameData.settings?.categories) {
                                const cats = currentGameData.settings.categories;
                                MultiplayerGameplayModule.gameState.selectedCategories =
                                    Array.isArray(cats) ? cats : Object.values(cats);
                            }
                            if (!MultiplayerGameplayModule.gameState.difficulty && currentGameData.settings?.difficulty) {
                                MultiplayerGameplayModule.gameState.difficulty = currentGameData.settings.difficulty;
                            }

                            // ✅ Persist (MERGE, not overwrite)
                            try {
                                const existing = JSON.parse(localStorage.getItem('nocap_game_state') || '{}');
                                localStorage.setItem('nocap_game_state', JSON.stringify({
                                    ...existing,
                                    gameId: MultiplayerGameplayModule.gameState.gameId,
                                    playerId: uid,
                                    isHost: isHostNow,
                                    isGuest: !isHostNow,
                                    deviceMode: 'multi',
                                    selectedCategories: MultiplayerGameplayModule.gameState.selectedCategories,
                                    difficulty: MultiplayerGameplayModule.gameState.difficulty
                                }));
                            } catch (_) {}
                        }
                        // If uid is null/unknown: keep existing isHost value — do NOT reset to false
                    } catch (e) {
                        console.warn('⚠️ Could not determine host role:', e.message);
                    }

                    // Overall results
                    if (currentGameData.showOverallResults && currentPhase !== 'overall-results') {
                        if (currentGameData.overallStats) overallStats = currentGameData.overallStats;
                        displayOverallResults();
                    }

                    // Continue after overall
                    if (currentGameData.showOverallResults === false && currentPhase === 'overall-results') {
                        handleNewRound(currentGameData.currentRound);
                    }

                    // Game end
                    if (currentGameData.gameState === 'finished') {
                        showNotification('Spiel beendet! 👋', 'info', 3000);
                        setTimeout(() => {
                            cleanup();
                            window.location.href = 'index.html';
                        }, 3000);
                        return;
                    }

                    // ✅ Round sync (fix for guests loading before host sets currentRound)
                    if (currentGameData.currentRound && currentPhase !== 'overall-results') {
                        const round = Number(currentGameData.currentRound) || 0;

                        // Never go backwards — if host already incremented locally, ignore stale lower round from Firebase
                        if (round < currentQuestionNumber) {
                            // stale update, ignore
                        } else {
                            // Host already initiated this round via nextQuestion() — skip to avoid race
                            const isHostAndAlreadyInitiated = MultiplayerGameplayModule.gameState.isHost && round === currentQuestionNumber;
                            if (!isHostAndAlreadyInitiated && (!currentQuestion || round !== currentQuestionNumber)) {
                                handleNewRound(round);
                            }
                        }
                    }
                } catch (error) {
                    handleFirebaseError(error, 'Spiel-Update verarbeiten', false);
                }
            }, (error) => {
                handleFirebaseError(error, 'Echtzeit-Synchronisation', true);
            });


            gameListener = gameRef;

            // Load initial game data
            const initialData = await gameRef.once('value');
            if (initialData.exists()) {
                currentGameData = initialData.val();
                currentPlayers = currentGameData.players || {};
// ✅ FIX: Determine role from DB (source of truth) after recovery
                try {
                    const uid = firebase.auth().currentUser?.uid || MultiplayerGameplayModule.gameState.playerId;
                    if (uid && currentGameData.hostId) {
                        const isHostNow = currentGameData.hostId === uid;
                        MultiplayerGameplayModule.gameState.isHost = isHostNow;
                        MultiplayerGameplayModule.gameState.isGuest = !isHostNow;
                        MultiplayerGameplayModule.gameState.playerId = uid;

                        // ✅ Recover selectedCategories + difficulty from DB settings if missing
                        if (!MultiplayerGameplayModule.gameState.selectedCategories?.length && currentGameData.settings) {
                            const cats = currentGameData.settings.categories;
                            if (cats) {
                                MultiplayerGameplayModule.gameState.selectedCategories =
                                    Array.isArray(cats) ? cats : Object.values(cats);
                            }
                        }
                        if (!MultiplayerGameplayModule.gameState.difficulty && currentGameData.settings?.difficulty) {
                            MultiplayerGameplayModule.gameState.difficulty = currentGameData.settings.difficulty;
                        }

                        // Persist for next reload
                        try {
                            const existing = JSON.parse(localStorage.getItem('nocap_game_state') || '{}');
                            localStorage.setItem('nocap_game_state', JSON.stringify({
                                ...existing,
                                gameId: MultiplayerGameplayModule.gameState.gameId,
                                playerId: uid,
                                isHost: isHostNow,
                                isGuest: !isHostNow,
                                deviceMode: 'multi',
                                selectedCategories: MultiplayerGameplayModule.gameState.selectedCategories,
                                difficulty: MultiplayerGameplayModule.gameState.difficulty
                            }));
                        } catch (_) {}
                        // Also persist to sessionStorage for reliable recovery
                        try {
                            sessionStorage.setItem('nocap_game_id', MultiplayerGameplayModule.gameState.gameId);
                            sessionStorage.setItem('nocap_is_host', String(isHostNow));
                            if (MultiplayerGameplayModule.gameState.playerName) {
                                sessionStorage.setItem('nocap_player_name', MultiplayerGameplayModule.gameState.playerName);
                            } else if (currentGameData.players?.[uid]?.name) {
                                const nameFromDB = currentGameData.players[uid].name;
                                sessionStorage.setItem('nocap_player_name', nameFromDB);
                                MultiplayerGameplayModule.gameState.playerName = nameFromDB;
                            }
                        } catch (_) {}
                    }
                } catch (e) {
                    console.warn('⚠️ Could not determine host role:', e.message);
                }

                // Check if game is actually in playing status
                if (currentGameData.status !== 'playing') {
                    console.warn('⚠️ Game not in playing status');
                    showNotification('Spiel wurde noch nicht gestartet!', 'warning');
                    setTimeout(() => window.location.href = 'multiplayer-lobby.html', 2000);
                    return;
                }

                updatePlayersCount();

                if (currentGameData.currentRound) {
                    // Check if round actually exists in DB - if not, host must create it
                    const roundSnap = await firebase.database()
                        .ref(`games/${MultiplayerGameplayModule.gameState.gameId}/rounds/round_${currentGameData.currentRound}`)
                        .once('value');

                    if (roundSnap.exists()) {
                        handleNewRound(currentGameData.currentRound);
                    } else if (MultiplayerGameplayModule.gameState.isHost) {
                        currentQuestionNumber = Number(currentGameData.currentRound) || 1;
                        await startNewRound();
                    } else {
                        // Guest: wait for host to create the round
                        handleNewRound(currentGameData.currentRound);
                    }
                } else if (MultiplayerGameplayModule.gameState.isHost) {
                    // ✅ Host starts first round
                    currentQuestionNumber = 1;        // set round number
                    await startNewRound();            // creates /rounds/round_1 + sets currentRound
                } else {
                    // ✅ Guest: wait until host sets currentRound (gameRef.on('value') will call handleNewRound)
                    if (MultiplayerGameplayModule.isDevelopment) {
                        console.log('⏳ Waiting for host to start the first round...');
                    }
                }

            } else {
                console.error('❌ Game data not found');
                showNotification('Spiel nicht gefunden!', 'error');
                setTimeout(() => window.location.href = 'index.html', 2000);
                return;
            }

            if (MultiplayerGameplayModule.isDevelopment) {
                console.log('✅ Firebase listeners setup');
            }
        } catch (error) {
            console.error('❌ Error setting up listeners:', error);
            showNotification('Verbindungsfehler!', 'error');
            setTimeout(() => window.location.href = 'index.html', 3000);
        }
    }
    async function loadRoundFromFirebase(roundNumber) {
        // Stale guard: abort if round has already moved on
        if (roundNumber < currentQuestionNumber) {
            console.warn(`⚠️ Ignoring stale loadRound(${roundNumber}), currentRound=${currentQuestionNumber}`);
            return;
        }
        // Prevent parallel loads for the same round
        if (isLoadingRound) return;
        isLoadingRound = true;
        try {
            if (MultiplayerGameplayModule.isDevelopment) {
                console.log(`📥 Loading round ${roundNumber}...`);
            }

            const roundRef = firebase.database().ref(`games/${MultiplayerGameplayModule.gameState.gameId}/rounds/round_${roundNumber}`);
            const snapshot = await roundRef.once('value');

            // Re-check after await — round may have changed
            if (roundNumber < currentQuestionNumber) return;

            if (!snapshot.exists()) {
                console.warn(`⚠️ Round ${roundNumber} not in DB yet - retrying in 1s...`);
                isLoadingRound = false;
                setTimeout(() => loadRoundFromFirebase(roundNumber), 1000);
                return;
            }

            const roundData = snapshot.val();
            if (!roundData || !roundData.question) {
                console.warn('⚠️ Round exists but no question yet - retrying in 1s...');
                isLoadingRound = false;
                setTimeout(() => loadRoundFromFirebase(roundNumber), 1000);
                return;
            }

            currentQuestion = roundData.question;

            // FSK18 check
            if (currentQuestion && currentQuestion.category === 'fsk18') {
                const hasAccess = await verifyAgeForQuestion('fsk18');
                if (!hasAccess) {
                    currentQuestion = { text: 'Diese Frage ist für dein Alter nicht freigegeben', category: 'fsk0' };
                }
            }

            // Final stale check before touching UI
            if (roundNumber < currentQuestionNumber) return;

            displayQuestion(currentQuestion);
            setupRoundListener(roundNumber);

            // Sync timer from server
            const gameSnapshot = await firebase.database()
                .ref(`games/${MultiplayerGameplayModule.gameState.gameId}`)
                .once('value');

            if (gameSnapshot.exists()) {
                const gameData = gameSnapshot.val();
                if (gameData.timerPaused) {
                    isPaused = true;
                    pausedTimeRemaining = gameData.timerRemaining || 0;
                    updatePauseButton();
                } else if (gameData.timerStartTime && roundData.timerDuration) {
                    startTimer(gameData.timerStartTime, roundData.timerDuration);
                }
            }

            if (MultiplayerGameplayModule.isDevelopment) {
                console.log('✅ Round loaded');
            }
        } catch (error) {
            if (error.code === 'PERMISSION_DENIED' || (error.message && error.message.includes('permission'))) {
                console.warn('⚠️ Round read permission denied - retrying...');
                isLoadingRound = false;
                setTimeout(() => loadRoundFromFirebase(roundNumber), 1500);
            } else {
                console.error('❌ Error loading round:', error);
            }
        } finally {
            isLoadingRound = false;
        }
    }

    function setupRoundListener(roundNumber) {
        // Remove old listener using stored reference
        if (roundListener && roundListenerRef) {
            try {
                roundListenerRef.off('value', roundListener);
                if (MultiplayerGameplayModule.isDevelopment) {
                    console.log('[DEBUG] Removed previous round listener');
                }
            } catch (e) {
                console.warn('[WARNING] Could not remove previous round listener:', e.message);
            }
        }

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log(`🎧 Setting up round listener for round ${roundNumber}`);
        }

        const roundRef = firebase.database().ref(`games/${MultiplayerGameplayModule.gameState.gameId}/rounds/round_${roundNumber}`);
        roundListenerRef = roundRef; // Store reference for cleanup

        roundListener = roundRef.on('value', (snapshot) => {
            // Stale listener guard: ignore if this listener is for a different round
            if (roundNumber !== currentQuestionNumber) return;

            if (snapshot.exists()) {
                currentRoundData = snapshot.val();

                const answers = currentRoundData.answers || {};
                const answerCount = Object.keys(answers).length;
                const playerCount = getActivePlayerCount();

                if (MultiplayerGameplayModule.isDevelopment) {
                    console.log(`📊 Round update: ${answerCount}/${playerCount} answers`);
                }

// ✅ Always update waiting UI when applicable
                if (currentPhase === 'waiting') {
                    updateWaitingStatus(answers);
                }

// ✅ CRITICAL: If I have submitted and all answers are in, show results (independent of currentPhase)
                const myKey = getPlayerKey();
                const iHaveAnswered = !!(myKey && answers && answers[myKey]);

// ✅ recovery: if my answer exists in DB, treat as submitted (after reload)
                if (iHaveAnswered && !hasSubmittedThisRound) {
                    hasSubmittedThisRound = true;
                    try { updateSubmitButton(); } catch(_) {}
                }


                if (hasSubmittedThisRound && iHaveAnswered && answerCount >= playerCount && playerCount >= 2) {
                    currentRoundData = currentRoundData || {};
                    currentRoundData.answers = answers;

                    // Cancel any previous pending results timeout
                    if (resultsDebounceTimer) clearTimeout(resultsDebounceTimer);

                    // Snapshot roundNumber at scheduling time — if round changes before 250ms, abort
                    const scheduledRound = roundNumber;
                    resultsDebounceTimer = setTimeout(() => {
                        resultsDebounceTimer = null;
                        // Only show results if we're still on the same round
                        if (scheduledRound !== currentQuestionNumber) return;
                        if (currentPhase !== 'results' && currentPhase !== 'overall-results') {
                            calculateAndShowResults();
                        }
                    }, 250);
                }

            }
        });

// ✅ P1 UI/UX: Listen for timer pause events (REGISTER ONCE)
        if (!timerSyncRef) {
            timerSyncRef = firebase.database().ref(`games/${MultiplayerGameplayModule.gameState.gameId}`);
            timerSyncCb = (snapshot) => {
                if (snapshot.exists() && !MultiplayerGameplayModule.gameState.isHost) {
                    const gameData = snapshot.val();

                    if (gameData.timerPaused !== isPaused) {
                        if (gameData.timerPaused) {
                            isPaused = true;
                            pausedTimeRemaining = gameData.timerRemaining || 0;
                            stopTimer();
                            showNotification('⏸️ Timer pausiert vom Host', 'info', 2000);
                        } else if (gameData.timerStartTime) {
                            isPaused = false;
                            startTimer(gameData.timerStartTime, gameData.timerRemaining || timerDuration);
                            showNotification('▶️ Timer fortgesetzt', 'info', 2000);
                        }
                        updatePauseButton();
                    }
                }
            };

            timerSyncRef.on('value', timerSyncCb);
        }


        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('✅ Round listener active');
        }
    }
    function handleNewRound(roundNumber) {
        const rn = Number(roundNumber) || 0;
        if (rn <= 0) return;

        const missingRoundData = !currentRoundData;
        const missingQuestion = !currentQuestion || !currentQuestion.text;
        const missingListener = !roundListenerRef;

        const shouldLoad = (rn !== currentQuestionNumber) || missingQuestion || missingRoundData || missingListener;

        if (!shouldLoad) return;

        currentQuestionNumber = rn;
        hasSubmittedThisRound = false;

        stopTimer();
        updateGameDisplay();
        resetForNewQuestion();
        showPhase('question');

        loadRoundFromFirebase(rn);
    }

    // ===========================
    // GAME FLOW
    // ===========================

    async function startNewRound() {
        if (!MultiplayerGameplayModule.gameState.isHost) return;

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log(`🎲 Starting round ${currentQuestionNumber}`);
        }

        // ✅ PHASE 3: Load question via Cloud Function (FSK18-safe)
        currentQuestion = await loadQuestionFromCloudFunction();

        // ✅ FSK18-SYSTEM: Double-check with client-side validation
        if (currentQuestion.category === 'fsk18') {
            const hasAccess = await verifyAgeForQuestion('fsk18');

            if (!hasAccess) {
                // Fallback to safe question
                currentQuestion = {
                    text: "Ich habe schon mal... etwas Lustiges erlebt",
                    category: "fsk0"
                };

                if (MultiplayerGameplayModule.isDevelopment) {
                    console.log('🔒 FSK18 question blocked for host - using fallback');
                }
            }
        }

        // Display question
        displayQuestion(currentQuestion);

        // Start round in Firebase with server timestamp
        try {
            const roundRef = firebase.database().ref(`games/${MultiplayerGameplayModule.gameState.gameId}/rounds/round_${currentQuestionNumber}`);
            await roundRef.set({
                question: currentQuestion,
                startedAt: Date.now(),
                timerDuration: timerDuration
            });

            const gameRef = firebase.database().ref(`games/${MultiplayerGameplayModule.gameState.gameId}`);
            await gameRef.update({
                currentRound: currentQuestionNumber,
                timerStartTime: firebase.database.ServerValue.TIMESTAMP,
                timerPaused: false,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            });

            // ✅ P1 UI/UX: Start timer with server sync
            const serverTime = await getServerTimestamp();
            startTimer(serverTime, timerDuration);

            setupRoundListener(currentQuestionNumber);
            if (MultiplayerGameplayModule.isDevelopment) {
                console.log('✅ New round started');
            }
        } catch (error) {
            console.error('❌ Error starting round:', error);
        }
    }

    /**
     * ✅ P1 UI/UX: Get server timestamp for timer sync
     */
    async function getServerTimestamp() {
        try {
            const ref = firebase.database().ref('.info/serverTimeOffset');
            const snapshot = await ref.once('value');
            const offset = snapshot.val() || 0;
            return Date.now() + offset;
        } catch (e) {
            return Date.now();
        }
    }

    /**
     * ✅ PHASE 3: Load questions from Cloud Function for FSK18
     * FSK0 & FSK16 can still use local fallback
     * @returns {Promise<Object>} Question object {text, category}
     */
    function generateRandomQuestionLocal(categories) {
        const fallbackQuestionsDatabase = {
            fsk0: [
"Ich habe schon mal einen Dreier gehabt",
            "Ich habe schon mal Analsex gehabt",
            "Ich habe schon mal Sex an einem öffentlichen Ort gehabt",
            "Ich habe schon mal jemanden betrogen",
            "Ich habe schon mal eine Affäre gehabt",
            "Ich habe schon mal jemanden nur wegen des Aussehens mit nach Hause genommen",
            "Ich habe schon mal Sex im Auto gehabt",
            "Ich habe schon mal eine Nacktaufnahme von mir verschickt",
            "Ich habe schon mal auf einer Party jemanden geküsst, dessen Namen ich nicht kannte",
            "Ich habe schon mal Sex mit jemandem gehabt, der oder die in einer Beziehung war",
            "Ich habe schon mal einen One-Night-Stand gehabt",
            "Ich habe schon mal Sexspielzeug benutzt",
            "Ich habe schon mal eine Sexfantasie ausgelebt, für die ich mich danach geschämt habe",
            "Ich habe schon mal beim Sex an jemand anderen gedacht",
            "Ich habe schon mal Pornos mit jemandem zusammen geschaut",
            "Ich habe schon mal Sex im Freien gehabt",
            "Ich habe schon mal Sexting betrieben",
            "Ich habe schon mal so getan, als hätte ich einen Orgasmus gehabt",
            "Ich habe schon mal jemanden beim Sex nach dem Namen einer anderen Person gerufen",
            "Ich habe schon mal mit einem viel älteren oder viel jüngeren Menschen geschlafen",
            "Ich habe schon mal Sex auf dem ersten Date gehabt",
            "Ich habe schon mal nackt in einem See, Meer oder Pool geschwommen",
            "Ich habe schon mal Strippen oder Lapdance ausprobiert",
            "Ich habe schon mal Sex im Büro oder an meinem Arbeitsplatz gehabt",
            "Ich habe schon mal zwei Personen gleichzeitig gedatet ohne dass die es wussten",
            "Ich habe schon mal auf Tinder oder einer anderen App jemanden getroffen und direkt geschlafen",
            "Ich habe schon mal auf einer Hochzeit jemanden aufgerissen",
            "Ich habe schon mal Sex gehabt, während jemand anderes im selben Raum geschlafen hat",
            "Ich habe schon mal eine Beziehung nur wegen Sex aufrechterhalten",
            "Ich habe schon mal nackt getanzt, aber nicht alleine",
            "Ich habe schon mal jemanden nach dem Sex direkt nach Hause geschickt",
            "Ich habe schon mal eine sexuelle Erfahrung gehabt, die ich noch niemandem erzählt habe",
            "Ich habe schon mal unter der Dusche oder in der Badewanne mit jemandem anderen gebadet",
            "Ich habe schon mal Sex an einem Ort gehabt, an dem wir leicht hätten erwischt werden können",
            "Ich habe schon mal eine Nacht mit jemandem verbracht, den ich erst wenige Stunden kannte",
            "Ich habe schon mal Rollenspiele im Bett ausprobiert",
            "Ich habe schon mal eine Beziehung beendet, weil der Sex nicht gut war",
            "Ich habe schon mal Sex auf einer Reise mit jemandem gehabt, den ich nie wieder gesehen habe",
            "Ich habe schon mal jemanden im betrunkenen Zustand geküsst, den ich nüchtern nie geküsst hätte",
            "Ich habe schon mal Bondage oder Fesseln ausprobiert",
            "Ich habe schon mal mit jemandem geschlafen, den ich eigentlich nicht leiden konnte",
            "Ich habe schon mal Sex auf einem Festival oder Campingplatz gehabt",
            "Ich habe schon mal jemanden verführt, nur um zu sehen ob ich es kann",
            "Ich habe schon mal eine Wette um sexuelle Handlungen abgeschlossen",
            "Ich habe schon mal Sexfotos von mir selbst gemacht",
            "Ich habe schon mal Sex in einem Aufzug gehabt",
            "Ich habe schon mal jemanden durch ein Kostüm oder Rollenspiel verführt",
            "Ich habe schon mal Sex auf einer Hausparty gehabt, während andere Leute anwesend waren",
            "Ich habe schon mal einen Freund meines Partners oder eine Freundin meiner Partnerin geküsst",
            "Ich habe schon mal Sex in einem Zug, Flugzeug oder Bus gehabt",
            "Ich habe schon mal jemanden verführt, um etwas von ihm oder ihr zu bekommen",
            "Ich habe schon mal eine geheime Affäre über mehrere Monate geführt",
            "Ich habe schon mal mit dem besten Freund oder der besten Freundin meines Ex geschlafen",
            "Ich habe schon mal Sex im Schlafzimmer meiner Eltern gehabt",
            "Ich habe schon mal eine Person absichtlich wachgeküsst um Sex zu haben",
            "Ich habe schon mal Sex nach einem Streit gehabt",
            "Ich habe schon mal eine Massage gegeben oder bekommen, die mehr war als nur eine Massage",
            "Ich habe schon mal mit jemandem geschlafen, nur um über einen Ex hinwegzukommen",
            "Ich habe schon mal Sex in der Natur gehabt, also Wald, Wiese oder Berge",
            "Ich habe schon mal einem Fremden im Club etwas ins Ohr geflüstert, um ihn oder sie anzumachen",
            "Ich habe schon mal mit jemandem geschlafen, dessen Nachnamen ich nicht kannte",
            "Ich habe schon mal Sex bei offenem Fenster oder offener Tür gehabt",
            "Ich habe schon mal eine Affäre mit jemandem gehabt, der mir eigentlich egal war",
            "Ich habe schon mal mit jemandem geschlafen, nur weil ich betrunken und einsam war",
            "Ich habe schon mal auf einer Betriebsfeier jemanden geküsst oder mehr",
            "Ich habe schon mal jemanden angetextet nach dem Motto: Ich bin gerade alleine zuhause",
            "Ich habe schon mal mit jemandem geschlafen, der mit einem meiner Freunde zusammen war",
            "Ich habe schon mal Sex mit zwei verschiedenen Personen am selben Tag gehabt",
            "Ich habe schon mal auf einem Familienfest jemanden geküsst, der nicht mein Partner war",
            "Ich habe schon mal Sex im Dunkeln gehabt, weil ich nicht wollte, dass man mich sieht",
            "Ich habe schon mal jemanden durch einen Film-Abend verführt",
            "Ich habe schon mal Sex mit einem Kollegen oder einer Kollegin gehabt",
            "Ich habe schon mal auf einem Schulausflug oder einer Klassenfahrt mit jemandem geschlafen",
            "Ich habe schon mal Sex mit einem Nachbarn oder einer Nachbarin gehabt",
            "Ich habe schon mal auf einer Silvesterparty mit jemandem mehr als nur den Mitternachtskuss geteilt",
            "Ich habe schon mal jemanden durch eine Autofahrt verführt",
            "Ich habe schon mal etwas sexuell ausprobiert, das ich aus Neugier wollte aber nicht nochmal will",
            "Ich habe schon mal Sex in einem Schwimmbad, einer Sauna oder einem Whirlpool gehabt",
            "Ich habe schon mal mit zwei Personen aus derselben Freundesgruppe geschlafen",
            "Ich habe schon mal jemanden verführt, dem ich eigentlich geholfen habe",
            "Ich habe schon mal Sex auf einem Dach oder einer Aussichtsplattform gehabt",
            "Ich habe schon mal eine Person nur durch Flirten dazu gebracht, ihre Beziehung zu hinterfragen",
            "Ich habe schon mal Sex in einem Kino oder Theater gehabt",
            "Ich habe schon mal mit jemandem geschlafen, der mit einem meiner Geschwister befreundet war",
            "Ich habe schon mal jemanden beim Tanzen so nah an mich gezogen, dass es klar war was ich will",
            "Ich habe schon mal eine Sexszene in einem Film oder einer Serie nachgespielt",
            "Ich habe schon mal Sex im Freien bei Regen gehabt",
            "Ich habe schon mal mit jemandem geschlafen, den ich eigentlich überhaupt nicht attraktiv fand",
            "Ich habe schon mal Sex in einer Bibliothek, einem Museum oder einem anderen stillen Ort gehabt",
            "Ich habe schon mal jemanden durch eine Nachricht um Mitternacht aus dem Bett geholt",
            "Ich habe schon mal Sex in einem Aufenthaltsraum oder einer Gemeinschaftsküche gehabt",
            "Ich habe schon mal jemanden durch Flüstern ins Ohr verführt",
            "Ich habe schon mal Sex auf einer Schaukel, Hängematte oder einem ungewöhnlichen Möbelstück gehabt",
            "Ich habe schon mal jemanden verführt, der eigentlich mit mir nur befreundet sein wollte",
            "Ich habe schon mal mit jemandem geschlafen, dessen Beziehungsstatus mir egal war",
            "Ich habe schon mal Sex gehabt und es danach so beschrieben, dass es besser klang als es war",
            "Ich habe schon mal jemanden durch gezieltes Ignorieren so weit gebracht, dass er oder sie die Initiative ergriffen hat",
            "Ich habe schon mal Sex mit jemandem gehabt, den ich mir schon lange heimlich gewünscht habe",
            "Ich habe schon mal eine Person durch einen Witz oder Humor ins Bett gebracht",
            "Ich habe schon mal jemanden so geküsst, dass er oder sie danach nicht mehr klar denken konnte",
            "Ich habe schon mal mit jemandem geschlafen und ihm oder ihr danach gesagt, es war ein Versehen",
            "Ich habe schon mal Sex gehabt und gehofft, dass niemand aus meinem Umfeld es je erfährt",
            "Ich habe schon mal jemanden verführt, der oder die eigentlich eine Beziehung beenden wollte",
            "Ich habe schon mal Sex gehabt, der so gut war, dass ich danach nicht schlafen konnte",
            "Ich habe schon mal mit jemandem geschlafen und ihm oder ihr danach die Nummer einer anderen Person gegeben",
            "Ich habe schon mal jemanden nach dem Sex nie wieder angeschrieben",
            "Ich habe schon mal Sex in einem Hotelpool nachts gehabt",
            "Ich habe schon mal absichtlich jemanden durch Körperkontakt verführt",
            "Ich habe schon mal einen Ex nach Mitternacht angeschrieben",
            "Ich habe schon mal eine Verabredung nur deswegen abgebrochen, weil jemand Attraktiveres aufgetaucht ist",
            "Ich habe schon mal absichtlich einen Freund oder eine Freundin meines Partners angemacht",
            "Ich habe schon mal Sex gehabt, direkt nachdem ich jemand anderen getroffen habe",
            "Ich habe schon mal jemanden so lange verführt, bis er oder sie seine oder ihre Grundsätze aufgegeben hat",
            "Ich habe schon mal Sex auf einem Balkon oder einer Terrasse gehabt",
            "Ich habe schon mal mit jemandem geschlafen und erst danach herausgefunden, dass wir uns schon kannten",
            "Ich habe schon mal eine Sexfantasie, die ich meinem aktuellen Partner oder meiner Partnerin nie erzählt habe",
            "Ich habe schon mal einen Fremden auf einer Reise mit ins Hotelzimmer genommen",
            "Ich habe schon mal Sex am Strand gehabt",
            "Ich habe schon mal gleichzeitig mit zwei verschiedenen Personen etwas laufen gehabt",
            "Ich habe schon mal Sex in einer Umkleidekabine gehabt",
            "Ich habe schon mal jemanden durch einen Kuss überrascht und er oder sie hat mitgemacht",
            "Ich habe schon mal Sex während eines Urlaubs gehabt, über den ich zuhause nie gesprochen habe",
            "Ich habe schon mal mit jemandem geschlafen und es war so schlecht, dass ich es jemandem erzählt habe",
            "Ich habe schon mal jemanden durch ein einziges Outfit komplett um den Finger gewickelt",
            "Ich habe schon mal absichtlich jemanden so lange angeschaut, bis er oder sie rot geworden ist",
            "Ich habe schon mal Sex gehabt und dabei an etwas komplett anderes gedacht",
            "Ich habe schon mal jemanden für eine Nacht eingeladen und morgens bereut",
            "Ich habe schon mal mit jemandem geschlafen, den ich erst eine Stunde zuvor kennengelernt habe",
            "Ich habe schon mal jemanden beim ersten Kuss sofort mit nach Hause genommen",
            "Ich habe schon mal Sex gehabt und es danach jemandem erzählt, dem ich es nicht erzählen sollte",
            "Ich habe schon mal einen Menschen verführt, der eigentlich nicht auf mein Geschlecht steht",
            "Ich habe schon mal Sex während eines Telefonats mit jemand anderem gehabt",
            "Ich habe schon mal auf einem Konzert oder einer Party jemanden von hinten angemacht",
            "Ich habe schon mal eine Affäre angefangen, weil ich in meiner Beziehung unglücklich war",
            "Ich habe schon mal jemanden durch gezielten Augenkontakt verführt",
            "Ich habe schon mal mit jemandem geschlafen, den ich danach nie wieder sehen wollte",
            "Ich habe schon mal jemanden durch ein einziges Kompliment ins Bett gebracht",
            "Ich habe schon mal eine intime Situation absichtlich verlängert, obwohl sie hätte enden sollen",
            "Ich habe schon mal mit jemandem geschlafen, der oder die ein Geheimnis von mir kannte",
            "Ich habe schon mal mit jemandem geschlafen, nur weil er oder sie mir ein Kompliment gemacht hat",
            "Ich habe schon mal mit jemandem geschlafen, dem ich danach nicht in die Augen schauen konnte",
            "Ich habe schon mal Sex nach einem Spieleabend oder einer Partyspielrunde gehabt",
            "Ich habe schon mal Sex gehabt und es als Fehler bezeichnet",
            "Ich habe schon mal jemanden um Mitternacht nach Hause eingeladen mit einer klaren Absicht",
            "Ich habe schon mal Sex gehabt und gehofft es bleibt für immer ein Geheimnis",
            "Ich habe schon mal mit jemandem geschlafen, den ich eigentlich meinem besten Freund oder meiner besten Freundin vorstellen wollte",
            "Ich habe schon mal Sex in einem fremden Bett gehabt, das mir nicht gehörte",
            "Ich habe schon mal jemanden so lange angeschrieben, bis er oder sie nachgegeben hat",
            "Ich habe schon mal mit jemandem geschlafen und ihn oder sie am nächsten Morgen rausgeworfen",
            "Ich habe schon mal eine Nacht mit jemandem verbracht und so getan als wäre nichts gewesen",
            "Ich habe schon mal Sex gehabt, nur weil ich gelangweilt war",
            "Ich habe schon mal absichtlich eine Situation herbeigeführt, um jemanden zu berühren",
            "Ich habe schon mal ein Geheimnis über das Sexleben eines anderen weitergegeben",
            "Ich habe schon mal jemanden mit Handschellen oder Ähnlichem gefesselt oder mich fesseln lassen",
            "Ich habe schon mal Sex am Strand bei Nacht gehabt",
            "Ich habe schon mal Sex in einer Sauna oder einem Dampfbad gehabt",
            "Ich habe schon mal jemanden verführt, der oder die eigentlich gerade jemand anderen mochte",
            "Ich habe schon mal mit jemandem geschlafen und es danach bereut, weil es die Freundschaft zerstört hat",
            "Ich habe schon mal Sex gehabt und dabei so laut gewesen, dass es peinlich war",
            "Ich habe schon mal jemanden nach dem Sex nach Hause geschickt, bevor er oder sie einschlafen konnte",
            "Ich habe schon mal absichtlich freizügige Fotos verschickt, um jemanden auf Trab zu halten",
            "Ich habe schon mal Sex gehabt und es so gut gefunden, dass ich sofort nochmal wollte",
            "Ich habe schon mal jemanden durch einen langen Blick so nervös gemacht, dass er oder sie nicht mehr sprechen konnte",
            "Ich habe schon mal Sex gehabt, der so schlecht war, dass ich mitten drin aufgehört habe",
            "Ich habe schon mal mit jemandem geschlafen, den ich eigentlich hasse",
            "Ich habe schon mal Sex gehabt und dabei so getan als wäre ich jemand anderes",
            "Ich habe schon mal jemanden durch eine einzige Nachricht so weit gebracht, dass er oder sie sofort vorbeigekommen ist",
            "Ich habe schon mal mit jemandem geschlafen, der oder die eigentlich vergeben war und es mir vorher gesagt hat",
            "Ich habe schon mal Sex in einem Zelt oder Wohnmobil gehabt",
            "Ich habe schon mal jemanden verführt, der oder die eigentlich gerade Schluss gemacht hatte",
            "Ich habe schon mal mit jemandem geschlafen, nur weil ich gewinnen wollte",
            "Ich habe schon mal Sex gehabt und danach gemerkt, dass wir uns nie wirklich mochten",
            "Ich habe schon mal jemanden nach dem Sex angelogen, um ihn oder sie loszuwerden",
            "Ich habe schon mal Sex gehabt und dabei das Gefühl gehabt, beobachtet zu werden",
            "Ich habe schon mal mit jemandem geschlafen, dem ich vorher noch nie richtig ins Gesicht geschaut habe",
            "Ich habe schon mal Sex gehabt, der so intensiv war, dass ich danach geweint habe",
            "Ich habe schon mal jemanden verführt, nur um zu beweisen, dass ich es kann",
            "Ich habe schon mal mit jemandem geschlafen und ihn oder sie am nächsten Morgen nicht erkannt",
            "Ich habe schon mal Sex gehabt und dabei das Handy nicht weglegen können",
            "Ich habe schon mal Sex gehabt, der so gut war, dass ich die Person danach nicht mehr loslassen konnte",
            "Ich habe schon mal mit jemandem geschlafen und es danach als Experiment bezeichnet",
            "Ich habe schon mal Sex gehabt und dabei so getan, als hätte ich Gefühle, die ich nicht hatte",
            "Ich habe schon mal jemanden verführt, dem ich eigentlich etwas anderes versprochen hatte",
            "Ich habe schon mal mit jemandem geschlafen und danach so getan als wäre er oder sie nur ein Freund oder eine Freundin",
            "Ich habe schon mal Sex gehabt und den Namen der Person danach vergessen",
            "Ich habe schon mal jemanden durch eine Wette ins Bett gebracht",
            "Ich habe schon mal mit jemandem geschlafen, nur weil alle anderen auch jemanden hatten",
            "Ich habe schon mal Sex gehabt, der so unbequem war, dass ich mittendrin lachen musste",
            "Ich habe schon mal jemanden verführt, den ich danach nie wieder sehen wollte",
            "Ich habe schon mal mit jemandem geschlafen, der oder die mein Chef oder meine Chefin war",
            "Ich habe schon mal Sex in einem geparkten Auto auf einem öffentlichen Parkplatz gehabt",
            "Ich habe schon mal jemanden durch ein einziges Foto auf Social Media angemacht",
            "Ich habe schon mal mit jemandem geschlafen und dabei an die Konsequenzen gedacht und es trotzdem getan",
            "Ich habe schon mal Sex gehabt und direkt danach so getan als wäre ich müde, um alleine zu sein",
            "Ich habe schon mal jemanden verführt, der oder die eigentlich gerade frisch getrennt war",
            "Ich habe schon mal mit jemandem geschlafen und es danach als Versehen abgetan",
            "Ich habe schon mal Sex gehabt und mir vorher ausgemalt, dass es anders wird",
            "Ich habe schon mal jemanden durch eine gemeinsame Übernachtung verführt, ohne dass es geplant war",
            "Ich habe schon mal mit jemandem geschlafen, nur weil die Stimmung und der Alkohol es so wollten",
            "Ich habe schon mal Sex gehabt und hinterher nicht gewusst wie ich nach Hause komme"
            ],
            fsk16: [
"Ich würde meinen linken Nachbarn oder meine linke Nachbarin heute Nacht gerne küssen",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin ist im Bett besser als man denkt",
            "Ich würde mit jemandem aus dieser Runde heute Nacht gerne schlafen",
            "Ich glaube, ich habe den größten oder die größte in dieser Runde",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin hat den größten oder die größte hier",
            "Ich finde jemanden aus dieser Runde so attraktiv, dass ich kaum zuhören kann",
            "Ich würde mit meinem rechten Nachbarn oder meiner rechten Nachbarin tauschen wollen, nur für eine Nacht",
            "Ich glaube, jemand aus dieser Runde denkt gerade dasselbe wie ich",
            "Ich würde meinem linken Nachbarn oder meiner linken Nachbarin gerne zeigen, was ich kann",
            "Ich glaube, ich bin der beste Küsser oder die beste Küsserin in dieser Runde",
            "Ich würde mit jemandem aus dieser Runde gerne ein Sexspiel spielen",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin würde mich gerne küssen",
            "Ich würde jemanden aus dieser Runde gerne einmal im Bett erleben",
            "Ich glaube, jemand hier hat die schönsten Lippen der Runde",
            "Ich würde meinen linken Nachbarn oder meine linke Nachbarin heute Nacht gerne mit nach Hause nehmen",
            "Ich glaube, ich bin der oder die Heißeste in dieser Runde",
            "Ich würde mit jemandem aus dieser Runde gerne Wahrheit oder Pflicht spielen, aber nur zu zweit",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin würde mich nicht enttäuschen",
            "Ich würde jemanden aus dieser Runde gerne einmal richtig küssen, nur um zu sehen wie er oder sie reagiert",
            "Ich glaube, jemand hier hat den attraktivsten Körper der Runde",
            "Ich würde meinem rechten Nachbarn oder meiner rechten Nachbarin gerne etwas ins Ohr flüstern",
            "Ich glaube, jemand aus dieser Runde würde im Bett laut werden",
            "Ich würde mit meinem linken Nachbarn oder meiner linken Nachbarin gerne alleine in einem Zimmer eingeschlossen werden",
            "Ich glaube, ich bin besser im Bett als alle hier denken",
            "Ich würde jemanden aus dieser Runde gerne einmal nackt sehen",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin hat die attraktivsten Lippen hier",
            "Ich würde meinen linken Nachbarn oder meine linke Nachbarin gerne massieren oder massiert werden",
            "Ich glaube, jemand aus dieser Runde hat mich heute bereits auf eine Art angeschaut, die ich nicht vergessen werde",
            "Ich würde mit jemandem aus dieser Runde gerne eine Nacht in einem Hotel verbringen",
            "Ich glaube, ich hätte mit jemandem aus dieser Runde die beste Chemie im Bett",
            "Ich würde meinem rechten Nachbarn oder meiner rechten Nachbarin gerne beweisen, was ich kann",
            "Ich glaube, jemand hier würde sich über eine Nachricht von mir um Mitternacht freuen",
            "Ich würde jemanden aus dieser Runde gerne nach seiner oder ihrer Fantasie fragen",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin denkt gerade etwas, das er oder sie nicht sagen würde",
            "Ich würde mit jemandem aus dieser Runde gerne etwas ausprobieren, das ich noch nie gemacht habe",
            "Ich glaube, ich wäre der beste One-Night-Stand für jemanden aus dieser Runde",
            "Ich würde meinen rechten Nachbarn oder meine rechte Nachbarin gerne fragen, was er oder sie im Bett mag",
            "Ich glaube, jemand hier hat eine Fantasie über mich",
            "Ich würde jemanden aus dieser Runde gerne beim Tanzen sehr nah an mich heranziehen",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin ist der oder die Heißeste heute Abend",
            "Ich würde mit jemandem aus dieser Runde gerne nackt schwimmen gehen",
            "Ich glaube, jemand hier würde nicht Nein sagen, wenn ich ihn oder sie küsse",
            "Ich würde meinem rechten Nachbarn oder meiner rechten Nachbarin gerne eine Fantasie gestehen",
            "Ich glaube, ich hätte mit meinem linken Nachbarn oder meiner linken Nachbarin die meiste Spannung",
            "Ich würde jemanden aus dieser Runde gerne einmal wirklich verführen",
            "Ich glaube, jemand hier würde im Bett Dinge machen, die keiner erwartet",
            "Ich würde meinen linken Nachbarn oder meine linke Nachbarin gerne beim Aufwachen neben mir sehen",
            "Ich glaube, ich bin der oder die Mutigste im Bett in dieser Runde",
            "Ich würde mit jemandem aus dieser Runde gerne ein Spiel spielen, bei dem Kleidung verloren geht",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin würde mich nicht enttäuschen",
            "Ich würde jemanden aus dieser Runde gerne fragen, was seine oder ihre schlimmste Sexgeschichte ist",
            "Ich glaube, jemand aus dieser Runde hat das beste Lächeln um jemanden ins Bett zu bekommen",
            "Ich würde meinen linken Nachbarn oder meine linke Nachbarin gerne um Mitternacht anschreiben",
            "Ich glaube, ich habe heute die beste Figur in dieser Runde",
            "Ich würde mit meinem rechten Nachbarn oder meiner rechten Nachbarin gerne ein Taxi nach Hause teilen und dann noch etwas länger",
            "Ich glaube, jemand hier würde sich über ein anzügliches Kompliment von mir freuen",
            "Ich würde jemanden aus dieser Runde gerne in einer dunklen Ecke küssen",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin ist im Bett wilder als er oder sie aussieht",
            "Ich würde mit jemandem aus dieser Runde gerne eine Flasche Wein trinken, alleine",
            "Ich glaube, ich wäre für jemanden aus dieser Runde eine unvergessliche Nacht",
            "Ich würde meinem rechten Nachbarn oder meiner rechten Nachbarin gerne zeigen, wie ich küsse",
            "Ich glaube, jemand hier denkt gerade an Sex",
            "Ich würde jemanden aus dieser Runde gerne fragen, wo er oder sie am liebsten Sex hat",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin hat die schönsten Augen um jemanden zu verführen",
            "Ich würde mit jemandem aus dieser Runde gerne die Nacht durchmachen, aber nicht zum Reden",
            "Ich glaube, ich bin der oder die Beste im Küssen hier",
            "Ich würde meinen rechten Nachbarn oder meine rechte Nachbarin gerne fragen, was er oder sie sich für heute Nacht vorstellt",
            "Ich glaube, jemand hier würde mich nach diesem Abend gerne nochmal sehen, in einem anderen Kontext",
            "Ich würde jemanden aus dieser Runde gerne bei einem Rollenspiel überraschen",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin denkt gerade etwas Anzügliches",
            "Ich würde mit meinem linken Nachbarn oder meiner linken Nachbarin gerne etwas tun, worüber wir danach nicht reden",
            "Ich glaube, jemand hier hätte Lust, mich heute Nacht zu verführen",
            "Ich würde jemanden aus dieser Runde gerne nach seiner oder ihrer heißesten Nacht fragen",
            "Ich glaube, ich wäre im Bett die angenehmste Überraschung für jemanden aus dieser Runde",
            "Ich würde meinem rechten Nachbarn oder meiner rechten Nachbarin gerne etwas zeigen, das er oder sie noch nicht kennt",
            "Ich glaube, jemand hier hätte nichts dagegen, wenn ich ihn oder sie heute Nacht küsse",
            "Ich würde mit jemandem aus dieser Runde gerne in einem Pool oder See nackt schwimmen",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin hat die schönste Stimme um jemanden anzumachen",
            "Ich würde jemanden aus dieser Runde gerne einmal richtig verwöhnen",
            "Ich glaube, ich hätte heute Nacht die wildesten Ideen von allen hier",
            "Ich würde meinen linken Nachbarn oder meine linke Nachbarin gerne auf eine Art küssen, die er oder sie nicht erwartet",
            "Ich glaube, jemand aus dieser Runde hat schon mal an mich gedacht, auf eine bestimmte Art",
            "Ich würde mit jemandem aus dieser Runde gerne Strip-Poker spielen",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin ist heißer als er oder sie zugibt",
            "Ich würde jemanden aus dieser Runde gerne fragen, was er oder sie sich von mir wünscht",
            "Ich glaube, ich würde jemanden aus dieser Runde richtig überraschen, wenn wir alleine wären",
            "Ich würde meinem linken Nachbarn oder meiner linken Nachbarin gerne eine Nacht geben, die er oder sie nicht vergisst",
            "Ich glaube, jemand hier schaut mich heute Abend an und denkt sich mehr dabei als er oder sie zeigt",
            "Ich würde mit jemandem aus dieser Runde gerne die Klamotten tauschen und dann sehen was passiert",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin wäre ein perfekter One-Night-Stand",
            "Ich würde jemandem aus dieser Runde gerne ins Ohr flüstern, was ich mir für heute Nacht vorstelle",
            "Ich glaube, jemand hier würde im Bett keine Grenzen kennen",
            "Ich würde meinen rechten Nachbarn oder meine rechte Nachbarin gerne nach Hause einladen, mit einer klaren Absicht",
            "Ich glaube, ich wäre für meinen linken Nachbarn oder meine linke Nachbarin eine Versuchung",
            "Ich würde jemanden aus dieser Runde gerne fragen, wie lange er oder sie schon Single ist und warum",
            "Ich glaube, jemand hier hat heute Nacht Lust auf mehr als nur dieses Spiel",
            "Ich würde mit meinem linken Nachbarn oder meiner linken Nachbarin gerne die Nacht verbringen",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin wäre im Bett sehr leidenschaftlich",
            "Ich würde jemanden aus dieser Runde gerne heimlich beobachten wie er oder sie tanzt",
            "Ich glaube, ich bin heute der oder die Attraktivste in dieser Runde",
            "Ich würde meinen linken Nachbarn oder meine linke Nachbarin gerne nach seiner oder ihrer wildesten Fantasie fragen",
            "Ich glaube, jemand aus dieser Runde würde nichts dagegen haben, wenn ich ihn oder sie heute verführe",
            "Ich würde mit jemandem aus dieser Runde gerne etwas ausprobieren, das wir beide noch nie gemacht haben",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin hat heute Nacht Lust auf mich",
            "Ich würde meinem rechten Nachbarn oder meiner rechten Nachbarin gerne zeigen, was ein guter Kuss wirklich ist",
            "Ich glaube, jemand hier würde auch ohne Alkohol mit mir flirten",
            "Ich würde jemanden aus dieser Runde gerne fragen, ob er oder sie schon mal an mich gedacht hat",
            "Ich glaube, ich könnte jemanden aus dieser Runde heute Nacht verführen wenn ich wollte",
            "Ich würde meinen linken Nachbarn oder meine linke Nachbarin gerne nach seinem oder ihrem Lieblingskuss fragen",
            "Ich glaube, jemand hier würde mich morgen früh nicht gehen lassen wollen",
            "Ich würde mit jemandem aus dieser Runde gerne spontan irgendwo hinverschwinden",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin hätte heute Nacht Lust auf ein Abenteuer",
            "Ich würde jemanden aus dieser Runde gerne fragen, was er oder sie unter einer perfekten Nacht versteht",
            "Ich glaube, ich bin in dieser Runde derjenige oder diejenige mit den meisten Fantasien",
            "Ich würde meinen linken Nachbarn oder meine linke Nachbarin gerne beim ersten Kuss überraschen",
            "Ich glaube, jemand hier würde für mich heute Nacht eine Ausnahme machen",
            "Ich würde mit jemandem aus dieser Runde gerne wetten und als Einsatz eine Nacht vorschlagen",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin weiß genau wie er oder sie jemanden verrückt machen kann",
            "Ich würde jemanden aus dieser Runde gerne fragen, was er oder sie in dieser Sekunde denkt",
            "Ich glaube, ich würde als One-Night-Stand in dieser Runde am meisten begehrt werden",
            "Ich würde meinem linken Nachbarn oder meiner linken Nachbarin gerne heute Nacht beweisen, dass ich unvergesslich bin",
            "Ich glaube, jemand hier schaut mich an und fragt sich, wie ich küsse",
            "Ich würde mit jemandem aus dieser Runde gerne ein Spiel spielen, bei dem Ehrlichkeit bestraft wird",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin würde mich nach diesem Abend vermissen",
            "Ich würde jemandem aus dieser Runde gerne zeigen, was ich nachts so mache",
            "Ich glaube, ich könnte jemanden aus dieser Runde allein durch einen Blick nervös machen",
            "Ich würde meinen rechten Nachbarn oder meine rechte Nachbarin gerne nach seinem oder ihrem Körper fragen, direkt",
            "Ich glaube, jemand hier würde heute Nacht gerne mit mir verschwinden",
            "Ich würde jemanden aus dieser Runde gerne um eine Massage bitten und dann sehen was draus wird",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin hat eine Seite, die keiner hier kennt",
            "Ich würde mit meinem linken Nachbarn oder meiner linken Nachbarin gerne Geheimnisse austauschen, die wir niemandem sonst sagen",
            "Ich glaube, jemand hier hat heute schon an Sex gedacht und zwar nicht allein",
            "Ich würde jemanden aus dieser Runde gerne fragen, was er oder sie trägt, wenn er oder sie schläft",
            "Ich glaube, ich wäre für meinen rechten Nachbarn oder meine rechte Nachbarin eine angenehme Überraschung",
            "Ich würde meinem linken Nachbarn oder meiner linken Nachbarin gerne sagen, was ich wirklich von ihm oder ihr denke",
            "Ich glaube, jemand hier würde mir heute Nacht nicht Nein sagen",
            "Ich würde mit jemandem aus dieser Runde gerne eine Wette eingehen, bei der ich auf jeden Fall gewinne",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin ist besser im Bett als mein letzter Ex oder meine letzte Ex",
            "Ich würde jemanden aus dieser Runde gerne fragen, wie lange es her ist, dass er oder sie jemanden geküsst hat",
            "Ich glaube, ich bin heute Abend am meisten in der Stimmung von allen hier",
            "Ich würde meinem rechten Nachbarn oder meiner rechten Nachbarin gerne zeigen, wie eine echte Umarmung geht",
            "Ich glaube, jemand hier würde heute Nacht gerne mit mir tauschen",
            "Ich würde mit jemandem aus dieser Runde gerne einen Abend verbringen, über den wir beide schweigen",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin hat heute das schönste Lächeln um jemanden zu verführen",
            "Ich würde jemanden aus dieser Runde gerne fragen, was er oder sie anhat wenn er oder sie nachts allein ist",
            "Ich glaube, ich könnte jemanden aus dieser Runde durch einen einzigen Satz ins Bett bringen",
            "Ich würde meinen linken Nachbarn oder meine linke Nachbarin gerne fragen, wie oft er oder sie pro Woche Sex hat",
            "Ich glaube, jemand hier würde sich heute Nacht über eine Einladung von mir freuen",
            "Ich würde mit jemandem aus dieser Runde gerne eine Nacht verbringen, die keiner je erfahren soll",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin würde sich über ein anzügliches Kompliment von mir freuen",
            "Ich würde jemandem aus dieser Runde gerne sagen, was ich mir für heute Nacht vorstelle, aber nur wenn wir allein sind",
            "Ich glaube, jemand hier hat heute die knappste Unterwäsche an",
            "Ich würde meinen rechten Nachbarn oder meine rechte Nachbarin gerne fragen, was er oder sie am lautesten macht",
            "Ich glaube, ich hätte mit jemandem aus dieser Runde die intensivste Nacht meines Lebens",
            "Ich würde jemanden aus dieser Runde gerne bei einer Situation erwischen, die er oder sie nicht erklären kann",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin denkt gerade darüber nach wie ich küsse",
            "Ich würde mit meinem rechten Nachbarn oder meiner rechten Nachbarin gerne eine Stunde alleine verbringen, ohne Handy",
            "Ich glaube, jemand hier wäre im Bett die größte Überraschung des Abends",
            "Ich würde jemanden aus dieser Runde gerne nach seiner oder ihrer wildesten Nacht fragen",
            "Ich glaube, ich bin heute Abend der oder die Einzige hier, der oder die wirklich weiß was er oder sie will",
            "Ich würde meinem linken Nachbarn oder meiner linken Nachbarin gerne sagen, dass er oder sie heute unwiderstehlich aussieht",
            "Ich glaube, jemand aus dieser Runde würde für mich eine Ausnahme von seinen oder ihren Regeln machen",
            "Ich würde mit jemandem aus dieser Runde gerne eine Nacht verbringen, die wir beide nie vergessen",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin wäre beim Sex lauter als alle anderen hier",
            "Ich würde jemanden aus dieser Runde gerne fragen, bei wem er oder sie heute Nacht schlafen würde wenn er oder sie könnte",
            "Ich glaube, ich würde meinen linken Nachbarn oder meine linke Nachbarin nicht enttäuschen",
            "Ich würde mit jemandem aus dieser Runde gerne etwas machen, das wir niemandem erzählen",
            "Ich glaube, jemand hier hat heute die attraktivste Art sich zu bewegen",
            "Ich würde meinem rechten Nachbarn oder meiner rechten Nachbarin gerne eine Nacht geben, die er oder sie verdient",
            "Ich glaube, ich bin der oder die, den oder die jemand aus dieser Runde heute Nacht mit nach Hause nehmen würde",
            "Ich würde jemanden aus dieser Runde gerne um Mitternacht nach Hause begleiten und mehr",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin hat heute die knappste Unterwäsche an",
            "Ich würde mit meinem rechten Nachbarn oder meiner rechten Nachbarin gerne tauschen, nur für eine Nacht",
            "Ich glaube, jemand hier würde heute Nacht gerne nicht alleine schlafen",
            "Ich würde jemanden aus dieser Runde gerne nach seinem oder ihrem letzten One-Night-Stand fragen",
            "Ich glaube, ich bin in dieser Runde derjenige oder diejenige mit den wenigsten Hemmungen",
            "Ich würde meinem linken Nachbarn oder meiner linken Nachbarin gerne erklären, was ein perfekter Kuss ist, praktisch",
            "Ich glaube, jemand hier hat heute Abend den meisten Sexappeal",
            "Ich würde mit jemandem aus dieser Runde gerne das Spiel unterbrechen und einfach verschwinden",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin würde sich über ein anzügliches Geständnis von mir freuen",
            "Ich würde jemanden aus dieser Runde gerne fragen, was er oder sie macht, wenn er oder sie alleine ist",
            "Ich glaube, ich hätte mit meinem rechten Nachbarn oder meiner rechten Nachbarin die meiste Spannung",
            "Ich würde meinem linken Nachbarn oder meiner linken Nachbarin heute Nacht gerne alles zeigen was ich kann",
            "Ich glaube, jemand aus dieser Runde denkt gerade darüber nach, mich zu küssen",
            "Ich würde mit jemandem aus dieser Runde gerne eine Nacht einschließen und sehen was passiert",
            "Ich glaube, mein linker Nachbar oder meine linke Nachbarin wäre mein Typ, wenn ich ehrlich bin",
            "Ich würde jemandem aus dieser Runde gerne sagen was ich an ihm oder ihr körperlich am attraktivsten finde",
            "Ich glaube, jemand hier würde mich nach diesem Spiel gerne alleine sprechen",
            "Ich würde meinen rechten Nachbarn oder meine rechte Nachbarin gerne fragen, was er oder sie anzieht wenn er oder sie jemanden verführen will",
            "Ich glaube, ich bin heute der oder die, für den oder die jemand in dieser Runde eine Ausnahme machen würde",
            "Ich würde jemanden aus dieser Runde gerne fragen, mit wem aus dieser Runde er oder sie heute Nacht schlafen würde",
            "Ich glaube, mein rechter Nachbar oder meine rechte Nachbarin ist heiß genug um meine Regeln zu brechen",
            "Ich würde mit meinem linken Nachbarn oder meiner linken Nachbarin gerne herausfinden, ob die Chemie stimmt",
            "Ich glaube, jemand hier würde mich auch ohne dieses Spiel irgendwann angesprochen haben",
            "Ich würde jemanden aus dieser Runde gerne nach dem Abend auf einen Absacker einladen, bei mir zuhause",
            "Ich glaube, ich bin derjenige oder diejenige aus dieser Runde, der oder die heute Nacht am wenigsten alleine schlafen will",
            "Ich würde meinem linken Nachbarn oder meiner linken Nachbarin gerne beweisen, dass der Abend erst anfängt",
            "Ich glaube, jemand hier würde heute Nacht alles für ein Abenteuer mit mir stehen lassen",
            "Ich würde mit jemandem aus dieser Runde gerne eine Geschichte beginnen, die niemand sonst je erfährt",
            "Ich glaube, nach diesem Spiel werden zwei Leute aus dieser Runde zusammen nach Hause gehen"
            ]
        };

        const validCategories = (categories || ['fsk0']).filter(c => c !== 'fsk18' && fallbackQuestionsDatabase[c]);
        if (validCategories.length === 0) validCategories.push('fsk0');

        const randomCategory = validCategories[Math.floor(Math.random() * validCategories.length)];
        const pool = fallbackQuestionsDatabase[randomCategory];
        const text = pool[Math.floor(Math.random() * pool.length)];

        return { text, category: randomCategory };
    }

    async function loadQuestionFromCloudFunction() {
        const rawSelected = MultiplayerGameplayModule.gameState.selectedCategories || [];
        const selectedCategories = Array.isArray(rawSelected)
            ? rawSelected
            : (rawSelected ? Object.values(rawSelected) : []);

        // No categories selected — hard fallback
        if (selectedCategories.length === 0) {
            console.warn('⚠️ No categories in gameState — using emergency fallback');
            return { text: 'Ich habe schon mal... etwas Interessantes erlebt', category: 'fsk0' };
        }

        const hasFSK18 = selectedCategories.includes('fsk18');

        // ── FSK18: Cloud Function (server-side age check) ──────────────────────
        if (hasFSK18) {
            try {
                const instances = window.FirebaseConfig?.getFirebaseInstances?.();
                const functions = instances?.functions;
                if (functions) {
                    const getQuestionsForGame = functions.httpsCallable('getQuestionsForGame');
                    const result = await getQuestionsForGame({
                        gameId: MultiplayerGameplayModule.gameState.gameId || 'multiplayer-game',
                        categories: selectedCategories,
                        count: 50
                    });
                    if (result?.data?.questions?.length > 0) {
                        const questions = result.data.questions;
                        const q = questions[Math.floor(Math.random() * questions.length)];
                        return {
                            text: sanitizeText(q.text || q.question || 'Ich habe schon mal...'),
                            category: q.category || 'fsk0'
                        };
                    }
                }
            } catch (e) {
                console.warn('⚠️ FSK18 Cloud Function failed, falling back to non-FSK18:', e.message);
            }
            // FSK18 failed — fall through to RTDB with FSK18 removed
        }

        // ── FSK0 / FSK16 / special: Direct RTDB read ──────────────────────────
        const safeCategories = selectedCategories.filter(c => c !== 'fsk18');
        if (safeCategories.length === 0) safeCategories.push('fsk0');

        try {
            const db = firebase.database();

            // Load all questions for selected categories in parallel
            const snapshots = await Promise.all(
                safeCategories.map(cat => db.ref(`questions/${cat}`).once('value'))
            );

            // Flatten into one pool
            const pool = [];
            snapshots.forEach((snap, i) => {
                if (snap.exists()) {
                    const cat = safeCategories[i];
                    Object.values(snap.val()).forEach(q => {
                        if (q.text) pool.push({ text: q.text, category: cat });
                    });
                }
            });

            if (pool.length > 0) {
                // Avoid repeating the last question
                const filtered = pool.filter(q => q.text !== currentQuestion?.text);
                const source = filtered.length > 0 ? filtered : pool;
                return source[Math.floor(Math.random() * source.length)];
            }

            console.warn('⚠️ RTDB returned no questions — using local fallback');
        } catch (e) {
            console.warn('⚠️ RTDB question load failed:', e.message);
        }

        // ── Last resort: hardcoded fallback ───────────────────────────────────
        return generateRandomQuestionLocal(safeCategories);
    }
    /**
     * P0 FIX: Display question with textContent only
     * ✅ P1 UI/UX: Add progress indicator
     */
    function displayQuestion(question) {
        if (!question) return;

        const questionTextEl = document.getElementById('question-text');
        const categoryEl = document.getElementById('question-category');

        if (questionTextEl) {
            questionTextEl.textContent = sanitizeText(question.text);
        }

        if (categoryEl) {
            categoryEl.textContent = categoryNames[question.category] || '🎮 Spiel';
        }

        // ✅ P1 UI/UX: Update progress indicator
        const progressEl = document.getElementById('question-progress');
        if (progressEl) {
            progressEl.textContent = `Frage ${currentQuestionNumber}`;
        }

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('📝 Question displayed');
        }
    }

    function getActivePlayerCount() {
        // Count unique players by name to avoid ghost entries from UID changes after reload
        const names = new Set();
        Object.values(currentPlayers).forEach(p => {
            if (p && p.name) names.add(p.name.trim().toLowerCase());
        });
        return Math.max(names.size, Object.keys(currentPlayers).length > 0 ? 1 : 0);
    }

    function resetForNewQuestion() {
        // Cancel any pending results display from previous round
        if (resultsDebounceTimer) {
            clearTimeout(resultsDebounceTimer);
            resultsDebounceTimer = null;
        }
        isLoadingRound = false; // Allow next round to load
        userAnswer = null;
        userEstimation = null;
        hasSubmittedThisRound = false;

        document.querySelectorAll('.answer-btn').forEach(btn => {
            btn.classList.remove('selected');
            btn.setAttribute('aria-checked', 'false');
            btn.disabled = false;
        });

        const personalBox = document.getElementById('personal-result');
        if (personalBox) {
            // ✅ CSP FIX: Use CSS class instead of inline style
            personalBox.classList.add('hidden');
        }

        const selectionDisplay = document.getElementById('current-selection');
        if (selectionDisplay) {
            selectionDisplay.classList.remove('show');
        }

        const selectedNumber = document.getElementById('selected-number');
        if (selectedNumber) {
            selectedNumber.textContent = '-';
        }

        updateNumberSelection();
        updateSubmitButton();
    }

    // ===========================
    // UI FUNCTIONS
    // ===========================

    function updateGameDisplay() {
        const roundEl = document.getElementById('current-round');
        if (roundEl) {
            roundEl.textContent = currentQuestionNumber;
        }
    }

    function updatePlayersCount() {
        totalPlayers = getActivePlayerCount();

        const playersCountEl = document.getElementById('players-count');
        if (playersCountEl) {
            playersCountEl.textContent = `${totalPlayers} Spieler`;
        }

        const totalPlayersEl = document.getElementById('total-players');
        if (totalPlayersEl) {
            totalPlayersEl.textContent = totalPlayers;
        }

        createNumberGrid();
    }

    function createNumberGrid() {
        const numberGrid = document.getElementById('number-grid');
        if (!numberGrid) return;

        numberGrid.innerHTML = '';

        const maxPlayers = totalPlayers || 8;
        for (let i = 0; i <= maxPlayers; i++) {
            const numberBtn = document.createElement('button');
            numberBtn.className = 'number-btn';
            numberBtn.type = 'button';
            numberBtn.textContent = i;
            numberBtn.id = `number-btn-${i}`;
            numberBtn.setAttribute('role', 'radio');
            numberBtn.setAttribute('aria-checked', 'false');
            numberBtn.setAttribute('aria-label', `${i} Spieler schätzen`);
            addTrackedEventListener(numberBtn, 'click', () => selectNumber(i));

            numberGrid.appendChild(numberBtn);
        }

        updateNumberSelection();
    }

    function selectNumber(number) {
        const maxPlayers = totalPlayers || 8;
        if (number >= 0 && number <= maxPlayers) {
            userEstimation = number;
            updateSelectedNumber(number);
            updateNumberSelection();
            updateSubmitButton();

            const selectionDisplay = document.getElementById('current-selection');
            if (selectionDisplay) {
                selectionDisplay.classList.add('show');
            }

            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        }
    }

    function updateSelectedNumber(number) {
        const selectedNumberEl = document.getElementById('selected-number');
        if (selectedNumberEl) {
            selectedNumberEl.textContent = number;
        }
    }

    function updateNumberSelection() {
        document.querySelectorAll('.number-btn').forEach(btn => {
            btn.classList.remove('selected');
            btn.setAttribute('aria-checked', 'false');
        });

        if (userEstimation !== null) {
            const selectedBtn = document.getElementById(`number-btn-${userEstimation}`);
            if (selectedBtn) {
                selectedBtn.classList.add('selected');
                selectedBtn.setAttribute('aria-checked', 'true');
            }
        }
    }

    function selectAnswer(answer) {
        // ✅ P1 UI/UX: Don't allow changes after submission
        if (hasSubmittedThisRound) {
            showNotification('Du hast bereits abgesendet!', 'warning', 2000);
            return;
        }

        userAnswer = answer;

        // ✅ P1 UI/UX: Clear previous selection and highlight new one
        document.querySelectorAll('.answer-btn').forEach(btn => {
            btn.classList.remove('selected');
            btn.setAttribute('aria-checked', 'false');
            btn.disabled = false;
        });

        const selectedBtn = answer ?
            document.getElementById('yes-btn') :
            document.getElementById('no-btn');

        if (selectedBtn) {
            selectedBtn.classList.add('selected');
            selectedBtn.setAttribute('aria-checked', 'true');
        }

        // ✅ P1 UI/UX: Provide haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }

        updateSubmitButton();
    }

    function updateSubmitButton() {
        const submitBtn = document.getElementById('submit-btn');
        if (!submitBtn) return;

        // P0: Disable if already submitted
        if (hasSubmittedThisRound) {
            submitBtn.classList.remove('enabled');
            submitBtn.disabled = true;
            submitBtn.setAttribute('aria-disabled', 'true');
            submitBtn.textContent = '✅ Bereits abgesendet';
            return;
        }

        if (userAnswer !== null && userEstimation !== null) {
            submitBtn.classList.add('enabled');
            submitBtn.disabled = false;
            submitBtn.setAttribute('aria-disabled', 'false');
            submitBtn.textContent = '📤 Antworten absenden';
        } else {
            submitBtn.classList.remove('enabled');
            submitBtn.disabled = true;
            submitBtn.setAttribute('aria-disabled', 'true');
            submitBtn.textContent = '📤 Antworten absenden';
        }
    }

    function updateUIForRole() {
        const hostElements = document.querySelectorAll('.host-only');
        hostElements.forEach(el => {
            if (MultiplayerGameplayModule.gameState.isHost) {
                el.classList.add('show');
            } else {
                el.classList.remove('show');
            }
        });

        const guestElements = document.querySelectorAll('.guest-only');
        guestElements.forEach(el => {
            if (!MultiplayerGameplayModule.gameState.isHost) {
                el.classList.add('show');
            } else {
                el.classList.remove('show');
            }
        });
    }
    // ===========================
    // P0 FIX: GAME ACTIONS WITH ANTI-CHEAT
    // ===========================

    /**
     * P0 FIX: Submit with anti-cheat check
     * ✅ P1 DSGVO: Schedule data cleanup
     */
    async function submitAnswers() {
        // P0: Anti-cheat - prevent double submission
        if (hasSubmittedThisRound) {
            showNotification('Du hast bereits abgesendet!', 'warning');
            return;
        }

        if (userAnswer === null || userEstimation === null) {
            showNotification('Bitte wähle Antwort UND Schätzung!', 'warning');
            return;
        }

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('📤 Submitting answers:', { answer: userAnswer, estimation: userEstimation });
        }

        // P0: Validate estimation range
        if (userEstimation < 0 || userEstimation > totalPlayers) {
            showNotification('Ungültige Schätzung!', 'error');
            return;
        }

        const playerKey = getPlayerKey();
        if (!playerKey) {
            showNotification('Spieler-ID fehlt – bitte Lobby neu öffnen', 'error');
            return;
        }

        if (!currentQuestionNumber || currentQuestionNumber < 1) {
            showNotification('Frage wird noch geladen...', 'warning');
            return;
        }

        const answerData = {
            playerId: playerKey,
            playerName: sanitizePlayerName(MultiplayerGameplayModule.gameState.playerName),
            answer: userAnswer,
            estimation: userEstimation,
            isHost: MultiplayerGameplayModule.gameState.isHost,
            timestamp: Date.now()
        };

        try {
            const answerRef = firebase.database().ref(
                `games/${MultiplayerGameplayModule.gameState.gameId}/rounds/round_${currentQuestionNumber}/answers/${playerKey}`
            );

            await answerRef.set({
                answer: userAnswer,
                estimation: userEstimation,
                submittedAt: Date.now(),
                playerId: playerKey,
                playerName: sanitizePlayerName(MultiplayerGameplayModule.gameState.playerName),
                isHost: MultiplayerGameplayModule.gameState.isHost || false
            });
// ✅ Ensure round listener exists (guest might have joined before round was loaded)
            if (!roundListenerRef) {
                setupRoundListener(currentQuestionNumber);
            }
            // P0: Mark as submitted
            hasSubmittedThisRound = true;

            // ✅ P1 UI/UX: Disable answer buttons
            document.querySelectorAll('.answer-btn').forEach(btn => {
                btn.disabled = true;
            });

            // ✅ P1 UI/UX: Stop timer for this player
            stopTimer();

            // ✅ P1 DSGVO: Schedule cleanup (host only)
            if (MultiplayerGameplayModule.gameState.isHost) {
                scheduleAnswerCleanup(currentQuestionNumber);
            }

            if (MultiplayerGameplayModule.isDevelopment) {
                console.log('✅ Answer submitted');
            }
            showNotification('Antworten gesendet! 🎯', 'success', 2000);
            showPhase('waiting');
            updateSubmitButton();

            setTimeout(() => {
                checkIfAllAnswered();
            }, 1000);

        } catch (error) {
            console.error('❌ Error submitting:', error);
            showNotification('Fehler beim Senden', 'error');
            hasSubmittedThisRound = false; // Allow retry on error
        }
    }

    async function checkIfAllAnswered() {
        try {
            const roundRef = firebase.database().ref(
                `games/${MultiplayerGameplayModule.gameState.gameId}/rounds/round_${currentQuestionNumber}`
            );
            const snapshot = await roundRef.once('value');

            if (snapshot.exists()) {
                const roundData = snapshot.val();
                const answers = roundData.answers || {};
                const answerCount = Object.keys(answers).length;
                const playerCount = getActivePlayerCount();

                if (MultiplayerGameplayModule.isDevelopment) {
                    console.log(`🔍 Check: ${answerCount}/${playerCount} answers`);
                }

                if (answerCount >= playerCount && playerCount >= 2 && currentPhase === 'waiting') {
                    if (MultiplayerGameplayModule.isDevelopment) {
                        console.log('✅ All answered!');
                    }
                    currentRoundData = roundData;
                    calculateAndShowResults();
                }
            }
        } catch (error) {
            console.error('❌ Error checking:', error);
        }
    }

    // ===========================
    // PHASE MANAGEMENT
    // ===========================

    function showPhase(phase) {
        document.querySelectorAll('.game-phase').forEach(p => {
            p.classList.remove('active');
        });

        const phaseEl = document.getElementById(`${phase}-phase`);
        if (phaseEl) {
            phaseEl.classList.add('active');
        }

        currentPhase = phase;
        if (MultiplayerGameplayModule.isDevelopment) {
            console.log(`📍 Phase: ${phase}`);
        }
    }

    // ===========================
    // P0 FIX: WAITING PHASE WITH SAFE DOM
    // ===========================

    /**
     * P0 FIX: Update waiting status with textContent
     */
    function updateWaitingStatus(answers = {}) {
        const statusContainer = document.getElementById('players-status');
        if (!statusContainer) return;

        statusContainer.innerHTML = '';

        Object.entries(currentPlayers).forEach(([playerId, player]) => {
            const hasAnswered = !!answers[playerId] || !!answers[player.uid] || !!answers[player.playerId];

            const statusItem = document.createElement('div');
            statusItem.className = 'player-status-item';
            statusItem.setAttribute('role', 'listitem');

            const nameSpan = document.createElement('span');
            nameSpan.textContent = sanitizePlayerName(player.name || 'Spieler');

            const statusSpan = document.createElement('span');
            statusSpan.className = `status-indicator ${hasAnswered ? 'status-done' : 'status-waiting'}`;
            statusSpan.textContent = hasAnswered ? '✅ Fertig' : '⏳ Wartet...';

            statusItem.appendChild(nameSpan);
            statusItem.appendChild(statusSpan);
            statusContainer.appendChild(statusItem);
        });
    }

    // ===========================
    // RESULTS CALCULATION
    // ===========================

    function calculateAndShowResults() {
        if (!currentRoundData || !currentRoundData.answers) {
            console.error('❌ No round data');
            return;
        }

        const answers = currentRoundData.answers;
        const actualYesCount = Object.values(answers).filter(a => a.answer === true).length;

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log(`✅ Results: ${actualYesCount} said yes`);
        }

        // Calculate results
        const results = Object.values(answers).map(playerAnswer => {
            const difference = Math.abs(playerAnswer.estimation - actualYesCount);
            const isCorrect = difference === 0;

            let sips = 0;
            if (!isCorrect) {
                const multiplier = difficultyMultipliers[MultiplayerGameplayModule.gameState.difficulty] || 1;
                sips = difference * multiplier;
            }

            // Prefer name from currentPlayers (live DB) over stored answer name
            const pid = playerAnswer.playerId;
            const playerFromDB = pid && currentPlayers[pid];
            const resolvedName = (playerFromDB && playerFromDB.name && playerFromDB.name !== 'Spieler' && playerFromDB.name !== 'Host')
                ? playerFromDB.name
                : (playerAnswer.playerName && playerAnswer.playerName !== 'Spieler' && playerAnswer.playerName !== 'Host')
                    ? playerAnswer.playerName
                    : (playerFromDB && playerFromDB.name) || playerAnswer.playerName || 'Spieler';

            return {
                playerId: pid,
                playerName: sanitizePlayerName(resolvedName),
                answer: playerAnswer.answer,
                estimation: playerAnswer.estimation,
                difference: difference,
                isCorrect: isCorrect,
                sips: sips
            };
        });

        // Sort by sips (descending)
        results.sort((a, b) => b.sips - a.sips);

        // Update overall stats
        overallStats.totalRounds = currentQuestionNumber;

        results.forEach(result => {
            if (!overallStats.playerStats[result.playerId]) {
                overallStats.playerStats[result.playerId] = {
                    name: result.playerName,
                    totalSips: 0,
                    correctGuesses: 0,
                    totalGuesses: 0
                };
            }

            const playerStats = overallStats.playerStats[result.playerId];
            playerStats.totalSips += result.sips;
            playerStats.totalGuesses++;
            if (result.isCorrect) {
                playerStats.correctGuesses++;
            }
        });

        displayRoundResults(results, actualYesCount);
        showPhase('results');

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('📊 Results displayed');
        }
    }

    /**
     * P0 FIX: Display results with textContent only
     */
    function displayRoundResults(results, actualYesCount) {
        // Show question
        if (currentQuestion && currentQuestion.text) {
            const resultsQuestionEl = document.getElementById('results-question-text');
            if (resultsQuestionEl) {
                resultsQuestionEl.textContent = sanitizeText(currentQuestion.text);
            }
        }

        const resultsSummaryEl = document.getElementById('results-summary');
        if (resultsSummaryEl) {
            resultsSummaryEl.textContent =
                `✅ ${actualYesCount} von ${totalPlayers || results.length} Spielern haben mit "Ja" geantwortet`;
        }

        // Find current player's result
        const currentPlayerId = getPlayerKey();

        const myResult = results.find(r => r.playerId === currentPlayerId);

        if (myResult) {
            const personalBox = document.getElementById('personal-result');
            if (personalBox) {
                // ✅ CSP FIX: Use CSS class instead of inline style
                personalBox.classList.remove('hidden');
            }


            const estEl = document.getElementById('personal-estimation');
            if (estEl) {
                estEl.textContent = myResult.estimation;
            }

            const statusText = myResult.isCorrect ?
                '✅ Richtig geschätzt!' :
                `❌ Falsch (Diff: ${myResult.difference})`;

            const statusEl = document.getElementById('personal-status');
            if (statusEl) {
                statusEl.textContent = statusText;
                // ✅ CSP FIX: Use CSS classes instead of inline style
                statusEl.classList.remove('status-correct', 'status-incorrect');
                statusEl.classList.add(myResult.isCorrect ? 'status-correct' : 'status-incorrect');
            }

            const sipsText = myResult.sips === 0 ?
                '🎯 Keine! Perfekt!' :
                `${myResult.sips} 🍺`;

            const sipsEl = document.getElementById('personal-sips');
            if (sipsEl) {
                sipsEl.textContent = sipsText;
            }
        }

        // Display results grid
        const resultsGrid = document.getElementById('results-grid');
        if (!resultsGrid) return;

        resultsGrid.innerHTML = '';

        results.forEach((result) => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            resultItem.setAttribute('role', 'listitem');

            const isMe = result.playerId === currentPlayerId;
            if (isMe) resultItem.classList.add('is-me');
            else if (result.isCorrect) resultItem.classList.add('correct-not-me');
            else resultItem.classList.add('wrong');

            const avatar = result.playerName.substring(0, 2).toUpperCase();
            const sipsText = result.sips === 0 ? 'Perfekt! 🎯' : `${result.sips} 🍺`;

            // P0 FIX: Build with textContent
            const playerResult = document.createElement('div');
            playerResult.className = 'player-result';

            const playerAvatar = document.createElement('div');
            playerAvatar.className = 'player-avatar';
            playerAvatar.textContent = avatar;
            playerAvatar.setAttribute('aria-hidden', 'true');

            const playerInfo = document.createElement('div');
            playerInfo.className = 'player-info';

            const playerName = document.createElement('div');
            playerName.className = 'player-name';
            playerName.textContent = result.playerName;

            const playerAnswer = document.createElement('div');
            playerAnswer.className = 'player-answer';
            playerAnswer.textContent = `Tipp: ${result.estimation}`;

            playerInfo.appendChild(playerName);
            playerInfo.appendChild(playerAnswer);

            playerResult.appendChild(playerAvatar);
            playerResult.appendChild(playerInfo);

            const sipsPenalty = document.createElement('div');
            sipsPenalty.className = `sips-penalty ${result.sips === 0 ? 'none' : ''}`;
            sipsPenalty.textContent = sipsText;

            resultItem.appendChild(playerResult);
            resultItem.appendChild(sipsPenalty);

            resultsGrid.appendChild(resultItem);
        });
    }

    // ===========================
    // GAME CONTROLS
    // ===========================

    /**
     * ✅ P0 SECURITY: Next question (HOST ONLY)
     */
    async function nextQuestion() {
        // Re-confirm host role from current DB snapshot before acting
        // (avoids race condition where isHost was briefly false during live-listener update)
        if (!MultiplayerGameplayModule.gameState.isHost) {
            try {
                const uid = firebase.auth().currentUser?.uid || MultiplayerGameplayModule.gameState.playerId;
                const snap = await firebase.database()
                    .ref(`games/${MultiplayerGameplayModule.gameState.gameId}/hostId`).once('value');
                if (snap.val() !== uid) {
                    showNotification('Nur der Host kann diese Aktion ausführen', 'warning', 3000);
                    return;
                }
                // We are actually the host — fix local state
                MultiplayerGameplayModule.gameState.isHost = true;
                MultiplayerGameplayModule.gameState.isGuest = false;
            } catch (e) {
                showNotification('Nur der Host kann diese Aktion ausführen', 'warning', 3000);
                return;
            }
        }

        try {
            currentQuestionNumber++;
            hasSubmittedThisRound = false; // Reset anti-cheat
            currentQuestion = null;        // Reset so live-listener guard re-triggers for guests
            currentRoundData = null;

            // ✅ P1 UI/UX: Stop and reset timer
            stopTimer();
            isPaused = false;
            pausedTimeRemaining = 0;

            updateGameDisplay();
            resetForNewQuestion();
            showPhase('question');

            await startNewRound();
            showNotification('Neue Frage! 🎮', 'success', 2000);
        } catch (error) {
            handleFirebaseError(error, 'Nächste Frage laden', false);
        }
    }

    /**
     * ✅ P0 SECURITY: Show overall results (HOST ONLY)
     */
    async function showOverallResults() {
        // ✅ P0 SECURITY: Validate host role
        if (!validateHostRole('Gesamtergebnisse anzeigen')) {
            return;
        }

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('📊 Showing overall results...');
        }

        try {
            const gameRef = firebase.database().ref(`games/${MultiplayerGameplayModule.gameState.gameId}`);
            await gameRef.update({
                showOverallResults: true,
                overallStats: overallStats,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            });

            if (MultiplayerGameplayModule.isDevelopment) {
                console.log('✅ Overall results notification sent');
            }

            displayOverallResults();
        } catch (error) {
            handleFirebaseError(error, 'Gesamtergebnisse anzeigen', false);
        }
    }

    /**
     * P0 FIX: Display overall results with textContent
     */
    function displayOverallResults() {
        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('🏆 Displaying overall results');
        }

        const totalRoundsEl = document.getElementById('total-rounds');
        if (totalRoundsEl) {
            totalRoundsEl.textContent = overallStats.totalRounds;
        }

        const totalPlayersEl = document.getElementById('total-players-overall');
        if (totalPlayersEl) {
            totalPlayersEl.textContent = Object.keys(overallStats.playerStats).length;
        }

        const leaderboardList = document.getElementById('overall-leaderboard-list');
        if (!leaderboardList) return;

        leaderboardList.innerHTML = '';

        // Sort by total sips (ascending)
        const leaderboard = Object.values(overallStats.playerStats).sort((a, b) => a.totalSips - b.totalSips);

        leaderboard.forEach((player, index) => {
            const leaderboardItem = document.createElement('div');
            leaderboardItem.className = `leaderboard-item ${index === 0 ? 'winner' : ''}`;
            leaderboardItem.setAttribute('role', 'listitem');

            const rankClass = index === 0 ? 'rank-1' :
                index === 1 ? 'rank-2' :
                    index === 2 ? 'rank-3' : 'rank-other';

            // P0 FIX: Build with textContent
            const rankBadge = document.createElement('div');
            rankBadge.className = `rank-badge ${rankClass}`;
            rankBadge.textContent = index + 1;
            rankBadge.setAttribute('aria-label', `Platz ${index + 1}`);

            const playerInfoDiv = document.createElement('div');
            playerInfoDiv.className = 'leaderboard-player-info';

            const nameDiv = document.createElement('div');
            nameDiv.className = 'leaderboard-player-name';
            nameDiv.textContent = sanitizePlayerName(player.name);

            const statsDiv = document.createElement('div');
            statsDiv.className = 'leaderboard-player-stats';

            const sipsSpan = document.createElement('span');
            sipsSpan.textContent = `🍺 ${player.totalSips} `;

            const correctSpan = document.createElement('span');
            correctSpan.textContent = `🎯 ${player.correctGuesses}/${player.totalGuesses} richtig`;

            statsDiv.appendChild(sipsSpan);
            statsDiv.appendChild(correctSpan);

            playerInfoDiv.appendChild(nameDiv);
            playerInfoDiv.appendChild(statsDiv);

            leaderboardItem.appendChild(rankBadge);
            leaderboardItem.appendChild(playerInfoDiv);

            leaderboardList.appendChild(leaderboardItem);
        });

        showPhase('overall-results');
    }

    /**
     * ✅ P0 SECURITY: Continue game (HOST ONLY)
     */
    async function continueGame() {
        // ✅ P0 SECURITY: Validate host role
        if (!validateHostRole('Spiel fortsetzen')) {
            return;
        }

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('▶️ Continuing game...');
        }

        try {
            const gameRef = firebase.database().ref(`games/${MultiplayerGameplayModule.gameState.gameId}`);
            await gameRef.update({
                showOverallResults: false,
                lastUpdate: firebase.database.ServerValue.TIMESTAMP
            });

            currentQuestionNumber++;
            hasSubmittedThisRound = false;

            // ✅ P1 UI/UX: Stop and reset timer
            stopTimer();
            isPaused = false;
            pausedTimeRemaining = 0;

            updateGameDisplay();
            resetForNewQuestion();
            showPhase('question');

            await startNewRound();
            showNotification('Spiel wird fortgesetzt! 🎮', 'success', 2000);
        } catch (error) {
            handleFirebaseError(error, 'Spiel fortsetzen', false);
        }
    }

    /**
     * ✅ P0 SECURITY: End game for all (HOST ONLY)
     */
    async function endGameForAll() {
        // ✅ P0 SECURITY: Validate host role
        if (!validateHostRole('Spiel beenden')) {
            return;
        }

        if (!confirm('Spiel wirklich für ALLE beenden?')) {
            return;
        }

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('🛑 Ending game...');
        }

        try {
            const gameRef = firebase.database().ref(`games/${MultiplayerGameplayModule.gameState.gameId}`);
            await gameRef.update({
                gameState: 'finished',
                endedAt: firebase.database.ServerValue.TIMESTAMP,
                finalStats: overallStats
            });

            showNotification('Spiel beendet! 👋', 'success', 2000);

            setTimeout(() => {
                cleanup();
                window.location.href = 'index.html';
            }, 2000);

        } catch (error) {
            handleFirebaseError(error, 'Spiel beenden', false);
        }
    }

    // ===========================
    // UTILITIES
    // ===========================
    // UTILITIES (use NocapUtils)
    // ===========================

    const showLoading = window.NocapUtils?.showLoading || function() {
        const loading = document.getElementById('loading-screen');
        if (loading) loading.classList.add('show');
    };

    const hideLoading = window.NocapUtils?.hideLoading || function() {
        const loading = document.getElementById('loading-screen');
        if (loading) loading.classList.remove('show');
    };

    const showNotification = window.NocapUtils?.showNotification || function(message, type = 'info') {
        alert(message); // Fallback
    };

    // ===========================
    // CLEANUP
    // ===========================

    function cleanup() {
        // ✅ P1 UI/UX: Stop timers
        stopTimer();
        // ✅ Remove tracked DOM listeners
        MultiplayerGameplayModule.state.eventListenerCleanup.forEach(({ element, event, handler, options }) => {
            try {
                element?.removeEventListener?.(event, handler, options);
            } catch (e) {}
        });
        MultiplayerGameplayModule.state.eventListenerCleanup = [];

        // Clean up game listener using stored reference
        if (gameListener) {
            try {
                gameListener.off(); // gameListener is the Firebase ref itself
                if (MultiplayerGameplayModule.isDevelopment) {
                    console.log('[DEBUG] Removed game listener');
                }
            } catch (e) {
                console.warn('[WARNING] Could not remove game listener during cleanup:', e.message);
            }
            gameListener = null;
        }

        // Clean up round listener using stored reference
        if (roundListener && roundListenerRef) {
            try {
                roundListenerRef.off('value', roundListener);
                if (MultiplayerGameplayModule.isDevelopment) {
                    console.log('[DEBUG] Removed round listener');
                }
            } catch (e) {
                console.warn('[WARNING] Could not remove round listener during cleanup:', e.message);
            }
            roundListener = null;
            roundListenerRef = null;
        }

        // ✅ P2 PERFORMANCE: Cleanup phase listeners
        _phaseListeners.forEach((listeners, phase) => {
            cleanupPhaseListeners(phase);
        });

        if (window.NocapUtils && window.NocapUtils.cleanupEventListeners) {
            window.NocapUtils.cleanupEventListeners();
        }

        if (MultiplayerGameplayModule.isDevelopment) {
            console.log('✅ Multiplayer gameplay cleanup completed');
        }
        // ✅ Remove timer sync listener (registered once)
        if (timerSyncRef && timerSyncCb) {
            try {
                timerSyncRef.off('value', timerSyncCb);
            } catch (e) {
                console.warn('[WARNING] Could not remove timer sync listener:', e.message);
            }
            timerSyncRef = null;
            timerSyncCb = null;
        }
        if (connectedRef && connectedCb) {
            try {
                connectedRef.off('value', connectedCb);
            } catch (e) {
                console.warn('[WARNING] Could not remove connectedRef listener:', e.message);
            }
            connectedRef = null;
            connectedCb = null;
        }

    }

    window.addEventListener('beforeunload', cleanup);

    // ===========================
    // INITIALIZATION
    // ===========================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})(window);