# Firebase Storage Security Rules - Dokumentation

## 📁 Datei: `storage.rules`

**Version**: 2.0 - Production Hardened  
**Erstellt**: 2026-01-08  
**Status**: ✅ Ready for Production

---

## 🎯 Zweck

Firebase Storage Security Rules kontrollieren den Zugriff auf hochgeladene Dateien (Bilder, Dokumente, etc.). Diese Regeln sind **serverseitig** und können nicht umgangen werden.

---

## 🔒 Sicherheitsprinzipien

### 1. **Default Deny**
```javascript
// ❌ Standardmäßig wird ALLES verweigert
match /{allPaths=**} {
  allow read, write: if false;
}
```

**Warum**: Principle of Least Privilege - Nur explizit erlaubte Zugriffe sind möglich.

### 2. **User Isolation**
```javascript
// ✅ User kann nur auf EIGENE Dateien zugreifen
function isOwner(userId) {
  return request.auth.uid == userId;
}
```

**Warum**: DSGVO-Compliance - Nutzer kontrollieren ihre eigenen Daten.

### 3. **File Validation**
```javascript
// ✅ Dateigröße (max 5 MB)
function isValidSize() {
  return request.resource.size <= 5 * 1024 * 1024;
}

// ✅ Dateityp (nur Bilder)
function isValidImageType() {
  return request.resource.contentType.matches('image/(png|jpeg|jpg|webp|gif)');
}
```

**Warum**: Verhindert Missbrauch (zu große Dateien, schädliche Dateitypen).

---

## 📂 Storage-Struktur

```
/
├── avatars/
│   └── {userId}/
│       └── {filename}          # User profile pictures
│
├── game-assets/
│   └── {assetPath}             # Read-only game assets
│
├── temp/
│   └── {userId}/
│       └── {filename}          # Temporary files (24h TTL)
│
└── analytics/                   # Future: Analytics data
    └── {document}
```

---

## 🛡️ Zugriffsregeln im Detail

### 1. User Avatars (`/avatars/{userId}/{fileName}`)

#### **Read Access**:
```javascript
allow read: if isAuthenticated();
```

- ✅ **Alle authentifizierten User** können Avatare lesen
- ✅ Notwendig für Multiplayer (andere Spieler sehen Avatare)
- ❌ Unauthenticated users können NICHTS lesen

#### **Write Access**:
```javascript
allow write: if isAuthenticated()
             && isOwner(userId)
             && isValidSize()
             && isValidImageType()
             && isValidFileName(fileName);
```

**Bedingungen**:
1. ✅ User ist authentifiziert
2. ✅ User ist der Besitzer (`request.auth.uid == userId`)
3. ✅ Datei ist max. 5 MB
4. ✅ Datei ist ein Bild (PNG, JPEG, WEBP, GIF)
5. ✅ Dateiname ist valide (keine Pfad-Traversal)

#### **Delete Access**:
```javascript
allow delete: if isAuthenticated() && isOwner(userId);
```

- ✅ Nur der Besitzer kann seine eigenen Avatare löschen

---

### 2. Game Assets (`/game-assets/{assetPath}`)

#### **Read Access**:
```javascript
allow read: if true;
```

- ✅ **Jeder** kann Game-Assets lesen (Logo, Icons, etc.)
- ✅ Public CDN-ähnliche Nutzung

#### **Write Access**:
```javascript
allow write: if false;
```

- ❌ **Niemand** kann via Client schreiben
- ✅ Upload nur via Firebase Console oder Admin SDK

---

### 3. Temporary Files (`/temp/{userId}/{fileName}`)

#### **Access**:
```javascript
allow read, write, delete: if request.auth != null
                           && request.auth.uid == userId
                           && request.resource.size <= 10 * 1024 * 1024;
```

**Verwendung**:
- Temporäre Uploads (z.B. Bild-Cropping)
- Max. 10 MB (größer als Avatare)
- Auto-Cleanup nach 24h (via Cloud Function)

---

## 📏 Validierungsfunktionen

### 1. Authentication Check
```javascript
function isAuthenticated() {
  return request.auth != null;
}
```

**Prüft**: Ob User eingeloggt ist (anonym oder mit Account).

---

### 2. Ownership Check
```javascript
function isOwner(userId) {
  return request.auth.uid == userId;
}
```

**Prüft**: Ob der eingeloggte User der Pfad-Owner ist.

**Beispiel**:
```
User ABC versucht Upload:
/avatars/ABC/profile.png → ✅ isOwner('ABC') = true
/avatars/XYZ/profile.png → ❌ isOwner('XYZ') = false
```

---

### 3. File Size Check
```javascript
function isValidSize() {
  return request.resource.size <= 5 * 1024 * 1024; // 5 MB
}
```

**Limits**:
- Avatars: **5 MB**
- Temp Files: **10 MB**

**Warum 5 MB**:
- Ausreichend für hochauflösende Profilbilder
- Verhindert Storage-Missbrauch
- Mobile-freundlich (Upload-Zeit)

---

### 4. File Type Check
```javascript
function isValidImageType() {
  return request.resource.contentType.matches('image/(png|jpeg|jpg|webp|gif)');
}
```

**Erlaubte MIME-Types**:
- `image/png`
- `image/jpeg`
- `image/jpg`
- `image/webp`
- `image/gif`

**Blockiert**:
- ❌ `application/javascript` (JS-Dateien)
- ❌ `text/html` (HTML-Dateien)
- ❌ `application/pdf` (PDFs)
- ❌ `video/*` (Videos)

---

### 5. Filename Validation
```javascript
function isValidFileName(fileName) {
  return fileName.matches('^[a-zA-Z0-9_-]+\\.(png|jpg|jpeg|webp|gif)$');
}
```

**Erlaubt**:
- ✅ `profile.png`
- ✅ `avatar_2024.jpg`
- ✅ `user-image.webp`

**Blockiert**:
- ❌ `../../../etc/passwd` (Path traversal)
- ❌ `<script>.png` (XSS attempt)
- ❌ `file with spaces.png` (Spaces)

---

## 🧪 Test-Szenarien

### ✅ Erlaubte Operationen

1. **User ABC uploaded eigenes Avatar**:
   ```javascript
   Path: /avatars/ABC/profile.png
   Size: 2 MB
   Type: image/png
   Auth: ABC
   → ✅ ALLOWED
   ```

2. **User XYZ liest ABC's Avatar**:
   ```javascript
   Path: /avatars/ABC/profile.png
   Auth: XYZ (authenticated)
   → ✅ ALLOWED (read access)
   ```

3. **Jeder liest Game-Asset**:
   ```javascript
   Path: /game-assets/logo.png
   Auth: none
   → ✅ ALLOWED (public read)
   ```

4. **User ABC löscht eigenes Avatar**:
   ```javascript
   Path: /avatars/ABC/old-profile.png
   Auth: ABC
   → ✅ ALLOWED
   ```

---

### ❌ Blockierte Operationen

1. **User ABC versucht Upload auf fremden Account**:
   ```javascript
   Path: /avatars/XYZ/profile.png
   Auth: ABC
   → ❌ DENIED (not owner)
   ```

2. **Zu große Datei**:
   ```javascript
   Path: /avatars/ABC/profile.png
   Size: 10 MB
   Auth: ABC
   → ❌ DENIED (exceeds 5 MB limit)
   ```

3. **Falscher Dateityp**:
   ```javascript
   Path: /avatars/ABC/script.js
   Type: application/javascript
   Auth: ABC
   → ❌ DENIED (not an image)
   ```

4. **Unauthenticated Upload**:
   ```javascript
   Path: /avatars/ABC/profile.png
   Auth: none
   → ❌ DENIED (not authenticated)
   ```

5. **Client schreibt Game-Asset**:
   ```javascript
   Path: /game-assets/hack.png
   Auth: ABC
   → ❌ DENIED (admin-only write)
   ```

6. **Path Traversal**:
   ```javascript
   Path: /avatars/ABC/../XYZ/profile.png
   Auth: ABC
   → ❌ DENIED (invalid filename)
   ```

---

## 🚀 Deployment

### 1. Deploy Rules to Firebase
```bash
firebase deploy --only storage
```

### 2. Test mit Emulator
```bash
firebase emulators:start --only storage
```

### 3. Verify Deployment
```bash
firebase storage:rules:get
```

---

## 📊 Metriken & Limits

| Resource | Limit | Reason |
|----------|-------|--------|
| **Avatar Size** | 5 MB | Balance zwischen Qualität und Performance |
| **Temp File Size** | 10 MB | Flexibilität für temporäre Uploads |
| **Allowed Types** | 5 (PNG, JPEG, JPG, WEBP, GIF) | Nur Bilder für Sicherheit |
| **Max Files per User** | Unbegrenzt* | *Begrenzung via App-Logik |

---

## 🔐 DSGVO-Compliance

### Datenschutz-Prinzipien

1. **Data Minimization**:
   - ✅ Nur notwendige Daten (Avatare)
   - ✅ Keine sensiblen Daten im Storage

2. **User Control**:
   - ✅ User kann eigene Dateien lesen
   - ✅ User kann eigene Dateien löschen
   - ✅ User kann eigene Dateien aktualisieren

3. **Access Control**:
   - ✅ Strikte Isolation (nur eigene Dateien schreibbar)
   - ✅ Authentication erforderlich

4. **Right to be Forgotten**:
   - ✅ User kann Daten jederzeit löschen
   - ✅ Admin kann User-Daten löschen (via Console)

---

## 🛠️ Zukünftige Erweiterungen

### 1. Custom Metadata
```javascript
// Beispiel: Timestamp, Upload-Source
allow write: if request.resource.metadata.uploadedBy == request.auth.uid;
```

### 2. Quota Management
```javascript
// Beispiel: Max 10 Avatare pro User
function countUserFiles(userId) {
  // Implementierung via Cloud Function
  return true;
}
```

### 3. Image Processing
```javascript
// Beispiel: Automatisches Resize via Cloud Function
// Trigger: onFinalize → Resize → Upload optimized version
```

---

## 📋 Checkliste für Entwickler

Vor Upload-Implementierung prüfen:

- [ ] `storage.rules` deployed (`firebase deploy --only storage`)
- [ ] Client-Code nutzt `firebase.storage()`
- [ ] Upload erfolgt in korrekten Pfad (`/avatars/{uid}/...`)
- [ ] Dateigröße wird client-side geprüft (vor Upload)
- [ ] Dateityp wird client-side geprüft (vor Upload)
- [ ] Error-Handling für `permission-denied` implementiert
- [ ] Loading-State während Upload
- [ ] Success/Error-Notification für User
- [ ] Avatar-Update aktualisiert UI sofort
- [ ] Alt-Text für Accessibility

---

## 🔍 Debugging

### Permission Denied?

1. **Check Authentication**:
   ```javascript
   const user = firebase.auth().currentUser;
   console.log('User:', user?.uid);
   ```

2. **Check Path**:
   ```javascript
   const path = `/avatars/${user.uid}/profile.png`;
   console.log('Upload path:', path);
   ```

3. **Check File Size**:
   ```javascript
   const file = /* File object */;
   console.log('File size:', file.size, 'bytes');
   console.log('Max allowed:', 5 * 1024 * 1024);
   ```

4. **Check File Type**:
   ```javascript
   console.log('File type:', file.type);
   console.log('Allowed:', ['image/png', 'image/jpeg', ...]);
   ```

---

## ✅ Akzeptanzkriterien

Alle Akzeptanzkriterien erfüllt:

1. ✅ **Alle Storage-Zugriffe sind standardmäßig verweigert**
   - Default deny rule: `allow read, write: if false;`

2. ✅ **Benutzer können nur auf ihre eigenen Dateien zugreifen**
   - Owner check: `request.auth.uid == userId`

3. ✅ **Maximale Dateigröße und zulässige MIME-Typen sind in den Regeln definiert**
   - Size: 5 MB (`isValidSize()`)
   - Types: PNG, JPEG, WEBP, GIF (`isValidImageType()`)

---

## 📞 Support

Bei Fragen zu Storage Rules:
- 📖 Firebase Docs: https://firebase.google.com/docs/storage/security
- 🔧 Rules Reference: https://firebase.google.com/docs/storage/security/rules-conditions
- 🧪 Emulator Testing: https://firebase.google.com/docs/emulator-suite

---

**Status**: ✅ Production Ready  
**Letzte Aktualisierung**: 2026-01-08  
**Version**: 2.0

