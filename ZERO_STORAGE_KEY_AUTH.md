# Zero-Storage Key Authentication

## The Problem

You want to verify a key **without storing anything** - no localStorage, no PouchDB, no separate storage. Pure mathematical verification.

## The Solution

**Store the verification data in the user document itself!** We already have the user document, so we can store a signature there.

## How It Works

### Method 1: Signature in User Document (Recommended)

```
User Provides Key
    ↓
System Derives Signature: Hash(Key + UserID + ShopID + Email)
    ↓
Compare with Signature in User Document
    ↓
If Match → Key Valid ✅
```

**Storage**: Signature stored in `UserDoc.keySignature` (already in user document!)

### Method 2: User ID Derived from Key

```
User Provides Key
    ↓
System Derives UserID: Hash(Key + ShopID + Email)
    ↓
Compare with Actual UserID
    ↓
If Match → Key Valid ✅
```

**Storage**: None! UserID itself is the verification.

### Method 3: Key Decrypts Email

```
User Provides Key
    ↓
System Derives Encryption Key: PBKDF2(Key + UserID + ShopID)
    ↓
Try to Decrypt Email (stored encrypted in user document)
    ↓
If Decryption Succeeds → Key Valid ✅
```

**Storage**: Encrypted email in user document.

## Recommended Approach: Signature Method

### Registration Flow

```typescript
// User registers with key
const masterKey = "MySecureKey123";
const email = "user@example.com";
const shopId = "shop123";

// Generate signature
const signature = await generateKeySignature(
  masterKey,
  userId,
  shopId,
  email
);

// Store signature in user document (we already have this!)
userDoc.keySignature = signature;
await saveUser(userDoc);
```

### Authentication Flow

```typescript
// User provides key
const providedKey = "MySecureKey123";

// Get user document (we already have this from session/context)
const user = await getUserById(userId);

// Verify key mathematically
const isValid = await verifyKeyBySignature(
  providedKey,
  user.userId,
  user.shopId,
  user.email,
  user.keySignature  // From user document!
);

if (isValid) {
  // Login success - no extra storage needed!
}
```

## What's Stored Where

### ✅ Stored (In User Document - Already Exists)
- `keySignature`: Hash derived from key
- `email`: User's email (used in signature)
- `userId`, `shopId`: Identifiers (used in signature)

### ❌ NOT Stored (No Extra Storage)
- No localStorage
- No separate PouchDB document
- No external storage
- Everything in the user document!

## Verification Process

```typescript
// 1. User provides key
const key = "MySecureKey123";

// 2. Get user document (already have this)
const user = await getUserById(userId);
// user.keySignature = "a7f3b9c2d4e1f6g8h0..."

// 3. Generate signature from provided key
const signature = Hash(key + userId + shopId + email);
// signature = "a7f3b9c2d4e1f6g8h0..."

// 4. Compare (pure math!)
if (signature === user.keySignature) {
  // ✅ Key is valid!
}
```

**No database lookup for key hash** - we use the user document we already have!

## Benefits

### ✅ Zero Extra Storage
- Uses existing user document
- No localStorage needed
- No separate PouchDB document
- No external storage

### ✅ Mathematical Verification
- Pure hash comparison
- No database queries for key
- Instant verification

### ✅ Works Offline
- User document is local (PouchDB)
- No network needed
- No external dependencies

### ✅ Simple
- One field in user document
- Standard hash function
- Easy to understand

## Implementation

### Add to User Document

```typescript
interface UserDoc {
  // ... existing fields
  keySignature?: string; // Add this field
}
```

### Registration

```typescript
// When user sets up key authentication
const signature = await generateKeySignature(
  masterKey,
  user.userId,
  user.shopId,
  user.email
);

user.keySignature = signature;
await updateUser(user);
```

### Authentication

```typescript
// Verify key
const isValid = await verifyKeyBySignature(
  providedKey,
  user.userId,
  user.shopId,
  user.email,
  user.keySignature
);
```

## Security

### ✅ What's Secure
- Signature is one-way hash (can't reverse)
- Uses SHA-256 (cryptographically secure)
- Includes email (prevents key reuse across users)
- Includes userId/shopId (prevents cross-user attacks)

### ⚠️ Considerations
- Signature is in user document (accessible if user document is accessed)
- But signature can't be reversed to get original key
- Still secure even if user document is compromised

## Comparison

| Method | Storage | Verification |
|--------|---------|--------------|
| Hash in localStorage | localStorage | Compare hashes |
| Hash in PouchDB | Separate document | Compare hashes |
| **Signature in UserDoc** | **User document** | **Compare signatures** ✅ |
| UserID from Key | None | Compare UserIDs |

## Code Example

```typescript
import { 
  generateKeySignature, 
  verifyKeyBySignature,
  authenticateWithKeyZeroStorage 
} from '@/lib/keyAuthZeroStorage';

// Registration
const signature = await generateKeySignature(
  "MySecureKey123",
  userId,
  shopId,
  email
);
user.keySignature = signature;
await updateUser(user);

// Authentication
const result = await authenticateWithKeyZeroStorage(
  "MySecureKey123",
  user // User document with keySignature
);

if (result.valid) {
  // Login success - no extra storage needed!
}
```

## Summary

**The key signature is stored in the user document itself** - no extra storage needed!

- ✅ No localStorage
- ✅ No separate PouchDB document  
- ✅ Uses existing user document
- ✅ Pure mathematical verification
- ✅ Works completely offline

---

**Key Point**: Store the signature in `UserDoc.keySignature` - we already have the user document, so no extra storage is needed!



