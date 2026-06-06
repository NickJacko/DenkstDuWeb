'use strict';

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => e.waitUntil(self.clients.claim()));

// ── State ────────────────────────────────────────────────────
let stopped       = true;
let pendingTimer  = null;
let pendingResolve = null;

function cancelPending() {
    stopped = true;
    if (pendingTimer)   { clearTimeout(pendingTimer);  pendingTimer  = null; }
    if (pendingResolve) { pendingResolve();              pendingResolve = null; }
}

// ── Autonomous scheduling loop ───────────────────────────────
// Runs inside event.waitUntil → keeps SW alive across multiple cycles.
// Fires a notification, then immediately schedules the next one itself.
async function runLoop(data) {
    stopped = false;

    let { fireAt, phase, seq, alarmIdx, alarmMs, remindMs } = data;

    while (!stopped) {
        const delay = Math.max(0, fireAt - Date.now());

        // Breakable sleep
        await new Promise(resolve => {
            pendingResolve = resolve;
            pendingTimer   = setTimeout(() => { pendingResolve = null; resolve(); }, delay);
        });

        if (stopped) break;
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

        // Tell any open tabs which event just fired (for counter sync + dedup)
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        clients.forEach(c => c.postMessage({ type: 'SW_FIRED', phase, seq, alarmIdx }));

        // Advance to next event
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
        cancelPending(); // Stop any existing loop
        event.waitUntil(runLoop(data));
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
