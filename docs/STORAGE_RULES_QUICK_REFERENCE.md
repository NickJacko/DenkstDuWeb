# Storage Rules Quick Reference

## 📁 Pfad-Struktur

```
storage/
├── avatars/{uid}/
│   ├── profile.png (max 5 MB)
│   └── avatar.jpg
├── temp/{uid}/
│   ├── upload.png (max 10 MB, auto-delete nach 24h)
│   └── data.json
└── game-assets/
    ├── logo.png (read-only)
    └── sounds/
```

---

## 🔐 Zugriffs-Matrix

| Pfad | Read | Write | Delete | Max Size | MIME-Types |
|------|------|-------|--------|----------|------------|
| `/avatars/{uid}/` | ✅ All Auth | ✅ Owner | ✅ Owner | 5 MB | image/png, jpeg, webp, gif |
| `/temp/{uid}/` | ✅ Owner | ✅ Owner | ✅ Owner | 10 MB | image/*, application/json |
| `/game-assets/**` | ✅ All | ❌ Admin only | ❌ | 10 MB | - |

---

## 📋 Validierungs-Regeln

### Avatare (`/avatars/{uid}/`)

```javascript
✅ ERLAUBT:
- Authentifizierter User
- Eigener Avatar (uid match)
- PNG, JPEG, JPG, WEBP, GIF
- Max 5 MB
- Alphanumerischer Dateiname
- Keine Slashes im Namen

❌ BLOCKIERT:
- SVG (XSS-Risiko)
- Andere User-Avatare
- > 5 MB
- Nicht authentifiziert
- Path Traversal (../, ..\)
```

### Temp Files (`/temp/{uid}/`)

```javascript
✅ ERLAUBT:
- Authentifizierter User
- Eigene Dateien (uid match)
- Image-Formate + JSON
- Max 10 MB

⏰ AUTO-DELETE:
- Nach 24 Stunden
- Täglich 02:00 Uhr (Europe/Berlin)
```

### Game Assets (`/game-assets/**`)

```javascript
✅ ERLAUBT:
- Jeder kann lesen
- Nur Admin kann schreiben (via Console)

❌ BLOCKIERT:
- Client-seitige Uploads
```

---

## 🚀 Code-Beispiele

### Avatar Upload
```javascript
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

async function uploadAvatar(file) {
    // Validierung
    if (file.size > 5 * 1024 * 1024) {
        throw new Error('Datei zu groß (max 5 MB)');
    }
    
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
        throw new Error('Ungültiger Dateityp');
    }
    
    // Upload
    const uid = auth.currentUser.uid;
    const storageRef = ref(storage, `avatars/${uid}/profile.png`);
    
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    
    return url;
}
```

### Avatar Delete
```javascript
import { ref, deleteObject } from 'firebase/storage';

async function deleteAvatar() {
    const uid = auth.currentUser.uid;
    const storageRef = ref(storage, `avatars/${uid}/profile.png`);
    
    await deleteObject(storageRef);
}
```

### Temp File Upload
```javascript
async function uploadTempFile(file) {
    const uid = auth.currentUser.uid;
    const filename = `temp_${Date.now()}.png`;
    const storageRef = ref(storage, `temp/${uid}/${filename}`);
    
    await uploadBytes(storageRef, file);
    
    // Auto-delete nach 24h via Cloud Function
}
```

---

## ⚠️ Häufige Fehler

### 1. Permission Denied
```
Error: storage/unauthorized
```

**Ursache:**
- User nicht authentifiziert
- Versucht, andere User-Dateien zu lesen/schreiben
- Falscher Pfad (uid stimmt nicht)

**Lösung:**
```javascript
// Sicherstellen, dass User authentifiziert ist
if (!auth.currentUser) {
    throw new Error('Nicht angemeldet');
}

// Korrekten Pfad verwenden
const correctPath = `avatars/${auth.currentUser.uid}/profile.png`;
```

---

### 2. File Too Large
```
Error: storage/quota-exceeded
```

**Ursache:**
- Datei > 5 MB (Avatare)
- Datei > 10 MB (Temp)

**Lösung:**
```javascript
// Client-seitige Validierung
if (file.size > 5 * 1024 * 1024) {
    throw new Error('Datei zu groß. Max 5 MB.');
}
```

---

### 3. Invalid Content-Type
```
Error: storage/invalid-argument
```

**Ursache:**
- SVG hochgeladen (blockiert)
- Ungültiger MIME-Type

**Lösung:**
```javascript
const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

if (!allowedTypes.includes(file.type)) {
    throw new Error('Nur PNG, JPEG, WEBP und GIF erlaubt');
}
```

---

## 🧹 DSGVO-Löschung

### Automatische Löschung (Account Delete)
```javascript
// Cloud Function wird automatisch getriggert
// Löscht alle /avatars/{uid}/** Dateien

// Kein Code nötig, passiert automatisch bei:
await auth.currentUser.delete();
```

### Manuelle Löschung
```javascript
import { httpsCallable } from 'firebase/functions';

// Account vollständig löschen
const deleteAccount = httpsCallable(functions, 'deleteMyAccount');

await deleteAccount({ 
    confirmation: 'DELETE_MY_ACCOUNT' 
});

// Löscht:
// - Realtime Database Daten
// - Storage Avatare
// - Firebase Auth User
```

---

## 📊 Monitoring

### Storage Usage
```javascript
// Firebase Console → Storage → Usage
// Check:
// - Total Size (sollte nicht explodieren)
// - /temp/ Folder (sollte leer sein nach Cleanup)
// - /avatars/ Count (sollte mit User-Count korrelieren)
```

### Cloud Function Logs
```javascript
// Firebase Console → Functions → Logs

// cleanupTempFiles
[cleanupTempFiles] 🗑️ Starting temp files cleanup...
[cleanupTempFiles] ✅ Deleted 42 temp files

// cleanupUserData
[cleanupUserData] 🗑️ Cleaning up data for deleted user: abc123
[cleanupUserData] Deleted 2 avatar file(s)
```

---

## ✅ Best Practices

### 1. Immer client-seitig validieren
```javascript
function validateFile(file) {
    // Größe
    if (file.size > 5 * 1024 * 1024) {
        throw new Error('Zu groß');
    }
    
    // Typ
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
        throw new Error('Ungültiger Typ');
    }
    
    // Name
    if (!/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp|gif)$/.test(file.name)) {
        throw new Error('Ungültiger Dateiname');
    }
}
```

### 2. Progress Tracking
```javascript
import { uploadBytesResumable } from 'firebase/storage';

const uploadTask = uploadBytesResumable(storageRef, file);

uploadTask.on('state_changed', 
    (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log(`Upload: ${progress}%`);
    },
    (error) => {
        console.error('Upload failed:', error);
    },
    () => {
        console.log('Upload complete!');
    }
);
```

### 3. Error Handling
```javascript
async function safeUpload(file) {
    try {
        // Validierung
        validateFile(file);
        
        // Upload
        const url = await uploadAvatar(file);
        
        return { success: true, url };
        
    } catch (error) {
        // Storage Errors
        if (error.code === 'storage/unauthorized') {
            return { success: false, error: 'Keine Berechtigung' };
        }
        
        if (error.code === 'storage/quota-exceeded') {
            return { success: false, error: 'Speicher voll' };
        }
        
        // Generic
        return { success: false, error: error.message };
    }
}
```

---

## 🔍 Testing

### Test-Suite
```javascript
describe('Storage Rules', () => {
    test('User kann eigenen Avatar hochladen', async () => {
        const file = new File([blob], 'profile.png', { type: 'image/png' });
        const url = await uploadAvatar(file);
        expect(url).toBeDefined();
    });
    
    test('User kann NICHT fremde Avatare löschen', async () => {
        const otherUid = 'other-user';
        const storageRef = ref(storage, `avatars/${otherUid}/profile.png`);
        
        await expect(deleteObject(storageRef)).rejects.toThrow();
    });
    
    test('SVG wird blockiert', async () => {
        const svg = new File([blob], 'avatar.svg', { type: 'image/svg+xml' });
        
        await expect(uploadAvatar(svg)).rejects.toThrow();
    });
});
```

---

## 📞 Support

### Bei Problemen
1. **Check Firebase Console → Storage → Rules**
2. **Check Cloud Function Logs**
3. **Verify User ist authentifiziert**
4. **Validate Dateigröße & -typ**

### Dokumentation
- Storage Rules: `docs/STORAGE_RULES_HARDENING_COMPLETE.md`
- Cloud Functions: `docs/STORAGE_CLOUD_FUNCTIONS_INTEGRATION.md`
- Firebase Docs: https://firebase.google.com/docs/storage/security

---

**Version**: 2.0.0  
**Last Updated**: 2026-01-12

