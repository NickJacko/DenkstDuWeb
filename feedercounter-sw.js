'use strict';

// ── Install & Activate ──────────────────────────────────────
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => e.waitUntil(self.clients.claim()));

// ── State ───────────────────────────────────────────────────
let pendingTimer = null;

// ── Message handler ─────────────────────────────────────────
// Expected messages:
//   { type: 'SCHEDULE', fireAt: <epoch ms>, phase: 'alarm'|'reminder', index: <number> }
//   { type: 'STOP' }
self.addEventListener('message', event => {
    const data = event.data || {};

    if (data.type === 'STOP') {
        if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
        return;
    }

    if (data.type === 'SCHEDULE') {
        if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }

        const delay = Math.max(0, data.fireAt - Date.now());

        // event.waitUntil keeps this SW alive until the promise resolves
        event.waitUntil(
            new Promise(resolve => {
                pendingTimer = setTimeout(async () => {
                    pendingTimer = null;

                    const isAlarm   = data.phase === 'alarm';
                    const title     = isAlarm ? '⏰ Feeder Alarm' : '🔔 Feeder Erinnerung';
                    const body      = isAlarm
                        ? `Alarm #${data.index} – Zeit zu handeln!`
                        : `Hast du Alarm #${data.index} gesehen?`;

                    // Show notification (appears on Apple Watch via mirroring)
                    await self.registration.showNotification(title, {
                        body,
                        tag:               'feeder',
                        renotify:          true,
                        requireInteraction: true,
                        vibrate:           [400, 200, 400, 200, 600],
                        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="%234fc3f7"/><text y="44" x="32" text-anchor="middle" font-size="36">⏰</text></svg>'
                    });

                    // Wake any open tabs so they can update counters + reschedule
                    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
                    clients.forEach(c => c.postMessage({ type: 'SW_FIRED', phase: data.phase, index: data.index }));

                    resolve();
                }, delay);
            })
        );
    }
});

// ── Notification click: bring app to front ──────────────────
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
            const existing = clients.find(c => c.url.includes('feedercounter'));
            if (existing) return existing.focus();
            return self.clients.openWindow('/feedercounter.html');
        })
    );
});
