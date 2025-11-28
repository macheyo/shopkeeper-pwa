# Deterministic Key Authentication (Survives Data Clear)

## The Problem

If user clears site data (localStorage, IndexedDB, PouchDB), all stored data is lost, including:
- User documents
- Key signatures
- Everything!

**How do we verify the key if all data is cleared?**

## The Solution

**Make the key verification completely deterministic** - based on information the user knows (email) and can provide.

## How It Works

### Key Principle

```
Key + Email → Deterministic User ID
```

The userId is **derived from the key and email**. If the key is correct, it will always generate the same userId.

### Registration Flow

```
User Registers
    ↓
User Provides: Key + Email + Shop Name
    ↓
System Derives: userId = Hash(Key + ShopID + Email)
    ↓
Create User with this userId
    ↓
Store in PouchDB/CouchDB
```

### Authentication Flow (Even After Data Clear)

```
User Provides: Key + Email
    ↓
System Derives: userId = Hash(Key + ShopID + Email)
    ↓
System Looks Up User by Email (from CouchDB or user provides shopId)
    ↓
Compare: Derived userId === Stored userId?
    ↓
If Match → Key Valid ✅
```

## What User Needs to Remember

### Minimum Required
- ✅ **Key** (they chose this)
- ✅ **Email** (they know this)
- ✅ **Shop ID** (can be derived from shop name, or stored in CouchDB)

### Optional
- Shop name (to derive shopId)
- Recovery code (deterministic from key)

## Storage Strategy

### Primary: CouchDB (Survives Data Clear)
- User document with userId
- Can sync from CouchDB even if local cleared
- Email is the lookup key

### Fallback: User Memory
- User knows their email
- User knows their key
- System can derive userId and look up from CouchDB

## Verification Process

### Scenario 1: Normal (Data Not Cleared)

```typescript
// User provides key + email
const key = "MySecureKey123";
const email = "user@example.com";

// Get user by email (from local PouchDB)
const user = await getUserByEmail(email);

// Derive userId from key
const derivedUserId = await deriveUserIdFromKeyAndEmail(
  key,
  user.shopId,
  email
);

// Compare
if (derivedUserId === user.userId) {
  // ✅ Key is valid!
}
```

### Scenario 2: Data Cleared (LocalStorage/PouchDB Gone)

```typescript
// User provides key + email + shopId
const key = "MySecureKey123";
const email = "user@example.com";
const shopId = "shop123"; // User remembers or derives from shop name

// Derive userId from key
const derivedUserId = await deriveUserIdFromKeyAndEmail(
  key,
  shopId,
  email
);

// Look up user from CouchDB (if online) or user provides userId
const user = await getUserByEmailFromCouchDB(email);

// Compare
if (derivedUserId === user.userId) {
  // ✅ Key is valid - even after data clear!
}
```

### Scenario 3: Completely Offline + Data Cleared

```typescript
// User provides key + email + shopId + userId (they remember it)
const key = "MySecureKey123";
const email = "user@example.com";
const shopId = "shop123";
const storedUserId = "abc123..."; // User remembers or wrote down

// Derive userId from key
const derivedUserId = await deriveUserIdFromKeyAndEmail(
  key,
  shopId,
  email
);

// Compare
if (derivedUserId === storedUserId) {
  // ✅ Key is valid - pure math, no storage needed!
}
```

## Benefits

### ✅ Survives Data Clear
- Works even if all local data is cleared
- Only needs key + email from user
- Can recover from CouchDB if online

### ✅ Completely Deterministic
- Same key + email always gives same userId
- No storage needed for verification
- Pure mathematics

### ✅ User-Friendly
- User knows their email
- User knows their key
- Can recover even if everything is lost

### ✅ Offline Capable
- Works offline (just need userId)
- Can work with just key + email + userId
- No network or storage needed

## Implementation

### Registration

```typescript
// User registers with key
const key = "MySecureKey123";
const email = "user@example.com";
const shopName = "My Shop";

// Generate shopId (or use existing)
const shopId = generateShopId();

// Derive userId from key
const userId = await deriveUserIdFromKeyAndEmail(
  key,
  shopId,
  email
);

// Create user
const user = {
  userId, // Derived from key!
  email,
  shopId,
  // ... other fields
};

// Store in PouchDB/CouchDB
await createUser(user);
```

### Authentication (Normal)

```typescript
const result = await verifyKeyDeterministic(
  providedKey,
  email,
  shopId,
  storedUserId // From user document
);
```

### Authentication (After Data Clear)

```typescript
// User provides key + email
// System looks up user by email from CouchDB
const user = await getUserByEmailFromCouchDB(email);

// Verify key
const result = await verifyKeyDeterministic(
  providedKey,
  email,
  user.shopId,
  user.userId
);
```

## Recovery Options

### Option 1: CouchDB Sync
- If online, sync user data from CouchDB
- Look up user by email
- Verify key against synced userId

### Option 2: User Provides ShopId
- User remembers shop name
- System derives shopId from shop name
- System derives userId from key + email + shopId
- System looks up user by email

### Option 3: User Wrote Down userId
- User wrote down their userId during registration
- User provides key + email + userId
- System derives userId and compares
- Pure math, no storage needed!

## Security Considerations

### ✅ What's Secure
- userId derivation is one-way (can't reverse to get key)
- Email is required (prevents key-only attacks)
- ShopId is required (prevents cross-shop attacks)

### ⚠️ Considerations
- User must remember key (no password reset)
- Email must be correct (typo = can't login)
- ShopId must be correct (or derived correctly)

## Comparison

| Method | Survives Data Clear | Storage Needed |
|--------|-------------------|----------------|
| Hash in localStorage | ❌ No | localStorage |
| Hash in PouchDB | ❌ No | PouchDB |
| Signature in UserDoc | ❌ No | User document |
| **Derive userId from key** | **✅ Yes** | **None!** |

## Code Example

```typescript
import {
  deriveUserIdFromKeyAndEmail,
  verifyKeyDeterministic,
  authenticateKeyAfterDataClear
} from '@/lib/keyAuthDeterministic';

// Registration
const userId = await deriveUserIdFromKeyAndEmail(
  "MySecureKey123",
  shopId,
  "user@example.com"
);
// userId = "a7f3b9c2d4e1f6g8h0..." (deterministic!)

// Authentication (even after data clear)
const result = await authenticateKeyAfterDataClear(
  "MySecureKey123",
  "user@example.com",
  shopId,
  getUserByEmail // Function to look up user
);

if (result.valid) {
  // Login success - no storage needed!
}
```

## Summary

**The key is verified by deriving the userId** - if the key is correct, it will generate the same userId that was stored during registration.

- ✅ **No storage needed** for verification
- ✅ **Survives data clear** - just need key + email
- ✅ **Completely deterministic** - pure mathematics
- ✅ **Works offline** - just need userId to compare

---

**Key Point**: `userId = Hash(Key + ShopID + Email)` - the userId IS the verification. If key is wrong, userId won't match!



