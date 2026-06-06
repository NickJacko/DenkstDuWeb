'use strict';

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => e.waitUntil(self.clients.claim()));

// ── State ────────────────────────────────────────────────────
let loopGen      = 0;   // incremented on every cancel; each loop validates against its own snapshot
let pendingTimer  = null;
let pendingResolve = null;

function cancelPending() {
    loopGen++;                                              // invalidates any running loop
    if (pendingTimer)   { clearTimeout(pendingTimer);  pendingTimer  = null; }
    if (pendingResolve) { pendingResolve();              pendingResolve = null; }
}

// ── Autonomous scheduling loop ───────────────────────────────
async function runLoop(data) {
    const myGen = loopGen; // snapshot – if loopGen changes, this loop is stale
    let { fireAt, phase, seq, alarmIdx, alarmMs, remindMs } = data;

    while (loopGen === myGen) {
        const delay = Math.max(0, fireAt - Date.now());

        await new Promise(resolve => {
            pendingResolve = resolve;
            pendingTimer   = setTimeout(() => { pendingResolve = null; resolve(); }, delay);
        });

        if (loopGen !== myGen) break; // stale check after await (fixes race with cancelPending)
        pendingTimer = pendingResolve = null;

        const isAlarm = phase === 'alarm';
        const title   = isAlarm ? '⏰ Feeder Alarm'    : '🔔 Feeder Erinnerung';
        const body    = isAlarm
            ? `Alarm #${alarmIdx} – Zeit zu handeln!`
            : `Hast du Alarm #${alarmIdx} gesehen?`;

        await self.registration.showNotification(title, {
            body,
            tag:               'feeder',
            renotify:          true,
            requireInteraction: true,
            vibrate:           [400, 200, 400, 200, 600]
        });

        if (loopGen !== myGen) break; // also check after async showNotification

        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        clients.forEach(c => c.postMessage({ type: 'SW_FIRED', phase, seq, alarmIdx }));

        if (isAlarm) {
            phase   = 'reminder';
            fireAt += remindMs;
        } else {
            alarmIdx++;
            phase   = 'alarm';
            fireAt += alarmMs;
        }
        seq++;
    }
}

// ── Message handler ──────────────────────────────────────────
self.addEventListener('message', event => {
    const data = event.data || {};

    if (data.type === 'STOP') {
        cancelPending();
        return;
    }

    if (data.type === 'SCHEDULE') {
        cancelPending();                    // loopGen++ happens here …
        event.waitUntil(runLoop(data));     // … so myGen = loopGen is captured correctly
    }
});

// ── Notification click → bring app to front ──────────────────
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
            const open = clients.find(c => c.url.includes('feedercounter'));
            if (open) return open.focus();
            return self.clients.openWindow('/feedercounter.html');
        })
    );
});
