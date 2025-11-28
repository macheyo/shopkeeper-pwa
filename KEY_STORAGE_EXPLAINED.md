# Key Storage Explained

## Where is the Stored Hash?

The key hash is stored in **TWO places** for redundancy and reliability:

### 1. **localStorage (Primary - No Dependencies)**
- **Location**: Browser's localStorage
- **Key**: `key_auth_{userId}`
- **Format**: JSON string
- **Dependency**: None (works even if PouchDB unavailable)
- **Speed**: Instant (synchronous)
- **Persistence**: Survives browser restarts

### 2. **PouchDB (Secondary - For Sync)**
- **Location**: Local PouchDB `users` database
- **Document ID**: `key_auth_{userId}`
- **Format**: PouchDB document
- **Dependency**: PouchDB (but has localStorage fallback)
- **Speed**: Async (slightly slower)
- **Persistence**: Encrypted, can sync to CouchDB

## Storage Strategy

### Read Flow (Get Hash)
```
1. Try localStorage first (instant, no dependency)
   ↓
2. If not found, try PouchDB (for sync/backup)
   ↓
3. If found in PouchDB, sync to localStorage
   ↓
4. Return hash
```

### Write Flow (Store Hash)
```
1. Store in localStorage (always)
   ↓
2. Also store in PouchDB (if available)
   ↓
3. If PouchDB fails, localStorage still has it ✅
```

## Why Both?

### localStorage Benefits
- ✅ **No Dependencies** - Works even if PouchDB fails
- ✅ **Instant Access** - Synchronous, no async overhead
- ✅ **Always Available** - Browser native storage
- ✅ **Offline First** - No network or database needed

### PouchDB Benefits
- ✅ **Encrypted** - Uses crypto-pouch encryption
- ✅ **Syncable** - Can sync to CouchDB
- ✅ **Backup** - Redundant storage
- ✅ **Structured** - Better for complex data

## Data Structure

### localStorage Format
```json
{
  "userId": "abc123",
  "shopId": "shop456",
  "keyHash": "a7f3b9c2d4e1f6g8h0...",
  "salt": "f1e2d3c4b5a6...",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### PouchDB Format
```json
{
  "_id": "key_auth_abc123",
  "_rev": "1-abc...",
  "type": "key_auth",
  "userId": "abc123",
  "shopId": "shop456",
  "keyHash": "a7f3b9c2d4e1f6g8h0...",
  "salt": "f1e2d3c4b5a6...",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## Verification Process

### Step-by-Step

1. **User Provides Key**: `"MySecureKey123"`

2. **System Gets Stored Hash**:
   ```typescript
   // Tries localStorage first (instant)
   const stored = localStorage.getItem("key_auth_user123");
   // If not found, tries PouchDB
   // Returns: { keyHash: "a7f3...", salt: "f1e2..." }
   ```

3. **System Derives Hash from User's Key**:
   ```typescript
   const derivedHash = await deriveUserKeyPBKDF2(
     "MySecureKey123",  // User's input
     userId,
     shopId,
     stored.salt        // From storage
   );
   // Returns: "a7f3b9c2d4e1f6g8h0..."
   ```

4. **System Compares**:
   ```typescript
   if (derivedHash === stored.keyHash) {
     // ✅ Key is valid - mathematical match!
   }
   ```

**No database query needed** - it's a pure mathematical comparison!

## What's Stored vs What's NOT Stored

### ✅ Stored (Safe to Store)
- `keyHash`: Derived hash (can't reverse to get original key)
- `salt`: Random salt (public, used for derivation)
- `userId`, `shopId`: Identifiers (public)

### ❌ NOT Stored (Never Stored)
- `masterKey`: User's original key (NEVER stored)
- `password`: User's password (separate system)

## Security Considerations

### localStorage Security
- ⚠️ **Not Encrypted** - But hash can't be reversed anyway
- ⚠️ **Accessible to JavaScript** - But only on same origin
- ✅ **Hash is Safe** - Even if accessed, can't get original key

### PouchDB Security
- ✅ **Encrypted** - Uses crypto-pouch
- ✅ **More Secure** - Better for sensitive data
- ⚠️ **Requires PouchDB** - Dependency

### Best Practice
- Store in **both** for redundancy
- localStorage for **speed and reliability**
- PouchDB for **encryption and sync**

## Fallback Strategy

### Scenario 1: PouchDB Available
```
Read: localStorage → PouchDB (if not in localStorage)
Write: localStorage + PouchDB
```

### Scenario 2: PouchDB Unavailable
```
Read: localStorage only ✅
Write: localStorage only ✅
```

### Scenario 3: localStorage Full
```
Read: PouchDB only ✅
Write: PouchDB only ✅
```

## Code Example

```typescript
// Store key hash
await storeKeyAuthData(userId, shopId, keyHash, salt);
// Stored in: localStorage + PouchDB

// Get key hash
const keyAuth = await getKeyAuthData(userId);
// Tries: localStorage → PouchDB

// Verify key
const isValid = await verifyKeyPBKDF2(
  userProvidedKey,
  userId,
  shopId,
  keyAuth.keyHash,  // From localStorage or PouchDB
  keyAuth.salt
);
// Pure math - no database query!
```

## Summary

**The stored hash is in:**
1. **localStorage** (primary, no dependencies)
2. **PouchDB** (secondary, encrypted, syncable)

**Verification is:**
- Mathematical (no database lookup)
- Instant (localStorage is synchronous)
- Works offline (no network needed)
- Works without PouchDB (localStorage fallback)

---

**Key Point**: The hash is stored locally (localStorage/PouchDB), but verification is mathematical - no database query needed!



