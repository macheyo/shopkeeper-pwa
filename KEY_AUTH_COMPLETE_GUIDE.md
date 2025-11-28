# Complete Key Authentication Guide

## Overview

This guide explains the **deterministic key authentication system** that works even if all site data is cleared.

## Core Concept

**The key generates the user ID** - if the key is correct, it will always produce the same user ID.

```
Key + Email + ShopID → Hash → UserID
```

## How It Works

### Registration

1. User provides: **Key + Email + Shop Name**
2. System derives: `userId = Hash(Key + ShopID + Email)`
3. System creates user with this `userId`
4. User can login with just **Key + Email** (even if data cleared!)

### Authentication

1. User provides: **Key + Email**
2. System derives: `userId = Hash(Key + ShopID + Email)`
3. System looks up user by email
4. System compares: `derivedUserId === storedUserId`
5. If match → **Key is valid!**

## What User Needs

### Minimum (Works Even After Data Clear)
- ✅ **Key** (they chose this)
- ✅ **Email** (they know this)
- ✅ **Shop ID** (can be looked up from email, or user provides)

### Optional
- Shop name (to help derive shopId)
- Recovery code (deterministic from key)

## Storage Strategy

### What's Stored
- **User document** with `userId` (derived from key)
- **Email** (for lookup)
- **Shop ID** (for derivation)

### What's NOT Stored
- ❌ Key hash (not needed!)
- ❌ Key signature (not needed!)
- ❌ Separate key document (not needed!)

**The userId IS the verification** - if key is wrong, userId won't match!

## Verification Flow

### Normal Flow (Data Not Cleared)

```typescript
// 1. User provides key + email
const key = "MySecureKey123";
const email = "user@example.com";

// 2. Get user by email (from local PouchDB)
const user = await getUserByEmail(email);
// user.userId = "a7f3b9c2d4e1f6g8h0..."

// 3. Derive userId from key
const derivedUserId = await deriveUserIdFromKeyAndEmail(
  key,
  user.shopId,
  email
);
// derivedUserId = "a7f3b9c2d4e1f6g8h0..."

// 4. Compare (pure math!)
if (derivedUserId === user.userId) {
  // ✅ Key is valid!
}
```

### After Data Clear Flow

```typescript
// 1. User provides key + email + shopId (or we look it up)
const key = "MySecureKey123";
const email = "user@example.com";
const shopId = "shop123"; // From CouchDB or user provides

// 2. Derive userId from key
const derivedUserId = await deriveUserIdFromKeyAndEmail(
  key,
  shopId,
  email
);

// 3. Look up user by email (from CouchDB if local cleared)
const user = await getUserByEmailFromCouchDB(email);

// 4. Compare
if (derivedUserId === user.userId) {
  // ✅ Key is valid - even after data clear!
}
```

## Integration

### Registration with Key

```typescript
// Option 1: Derive userId from key during registration
const key = "MySecureKey123";
const email = "user@example.com";
const shopId = generateShopId();

const userId = await deriveUserIdFromKeyAndEmail(key, shopId, email);

const user = {
  userId, // Derived from key!
  email,
  shopId,
  // ... other fields
};

await createUser(user);
```

### Login with Key

```typescript
// Use KeyAuthLoginDeterministic component
<KeyAuthLoginDeterministic
  onSuccess={(user) => {
    // User authenticated!
    createSession(user);
  }}
  onError={(error) => {
    // Show error
  }}
  shopId={shop?.shopId} // Optional
/>
```

## Components

### 1. KeyAuthSetup
- User sets up key authentication
- Derives userId from key
- Updates user document
- Generates recovery code

### 2. KeyAuthLoginDeterministic
- Login with key + email
- Works even if data cleared
- Optional biometric support
- Looks up user by email

## Security

### ✅ What's Secure
- **One-way hash** - Can't reverse to get key
- **Email required** - Prevents key-only attacks
- **ShopId required** - Prevents cross-shop attacks
- **Deterministic** - Same input always gives same output

### ⚠️ Considerations
- User must remember key (no password reset)
- Email must be correct (typo = can't login)
- If key is lost, user ID can't be regenerated

## Recovery

### If Key is Lost
- User needs to contact admin
- Admin can reset user (create new userId)
- User needs to set up new key

### If Email is Forgotten
- User needs to remember shop name
- System can look up email from shop
- Or user contacts admin

### Recovery Code
- Deterministic from key
- User can write it down
- Can verify key is correct by generating code

## Benefits

### ✅ Survives Data Clear
- Works even if localStorage/PouchDB cleared
- Only needs key + email from user
- Can recover from CouchDB

### ✅ No Extra Storage
- Uses existing user document
- userId is the verification
- No separate key documents

### ✅ Completely Offline
- Works without network
- Pure mathematical verification
- No external dependencies

### ✅ Simple
- Easy to understand
- Easy to implement
- Easy to use

## Comparison

| Method | Storage | Survives Clear | Verification |
|--------|---------|----------------|--------------|
| Password hash | PouchDB | ❌ No | Database lookup |
| Key hash | localStorage/PouchDB | ❌ No | Compare hashes |
| Key signature | User document | ❌ No | Compare signatures |
| **Derive userId from key** | **User document** | **✅ Yes** | **Compare userIds** |

## Code Examples

### Setup Key Auth

```typescript
import { KeyAuthSetup } from '@/components/KeyAuthSetup';

// In settings page
<KeyAuthSetup />
```

### Login with Key

```typescript
import { KeyAuthLoginDeterministic } from '@/components/KeyAuthLoginDeterministic';

// In login page
<KeyAuthLoginDeterministic
  onSuccess={(user) => {
    // Handle successful login
    createSession(user);
    router.push('/');
  }}
  onError={(error) => {
    // Handle error
    setError(error);
  }}
/>
```

### Verify Key Programmatically

```typescript
import { verifyKeyDeterministic } from '@/lib/keyAuthDeterministic';

const result = await verifyKeyDeterministic(
  providedKey,
  email,
  shopId,
  storedUserId
);

if (result.valid) {
  // Key is correct!
}
```

## Summary

**The key authentication works by deriving the userId from the key.** 

- ✅ **No extra storage** - userId in user document is the verification
- ✅ **Survives data clear** - just need key + email
- ✅ **Pure mathematics** - no database queries for verification
- ✅ **Works offline** - no network needed

**Key Point**: `userId = Hash(Key + ShopID + Email)` - the userId IS the proof that the key is correct!

---

**Ready to use!** Users can authenticate with just their key + email, even if all site data is cleared.



