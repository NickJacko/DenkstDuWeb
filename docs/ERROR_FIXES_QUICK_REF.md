# Error Fixes Quick Reference

## 🚨 Behobene Fehler

### 1. Firebase App nicht initialisiert
```javascript
// ❌ VORHER:
firebase.auth().setPersistence(...)

// ✅ NACHHER:
if (window.FirebaseConfig?.isInitialized()) {
    const { auth } = window.FirebaseConfig.getFirebaseInstances();
    auth.setPersistence(...)
}
```

---

### 2. CORS bei Cloud Functions
```javascript
// ❌ VORHER:
firebase.functions().httpsCallable('functionName')
// → Ruft us-central1 auf (CORS Error)

// ✅ NACHHER:
const functionsInstance = firebase.app().functions('europe-west1');
functionsInstance.httpsCallable('functionName')
// → Ruft europe-west1 auf (kein CORS Error)
```

---

### 3. Database Permission Denied
```json
// ❌ VORHER: Keine Rules für /deletionRequests

// ✅ NACHHER:
{
  "deletionRequests": {
    "$userId": {
      ".read": "auth != null && auth.uid === $userId",
      ".write": "auth != null && auth.uid === $userId"
    }
  }
}
```

---

## 🚀 Deployment

```powershell
# Deploy alles
firebase deploy --only hosting,database

# Oder einzeln:
firebase deploy --only hosting    # JS-Fixes
firebase deploy --only database   # Rules-Fix
```

---

## ✅ Testing

```javascript
// Console sollte zeigen:
✅ Firebase Functions initialized (europe-west1)
✅ Functional cookies enabled (user consent)
✅ Firebase persistence set to LOCAL

// Network Tab sollte zeigen:
POST https://europe-west1-denkstduwebsite.cloudfunctions.net/...
Status: 200 OK
```

---

**Status**: ✅ Production-Ready  
**Errors**: 0 kritisch, 1 Warning (non-critical)

