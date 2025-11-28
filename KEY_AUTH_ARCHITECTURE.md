# Key-Based Authentication Architecture

## Overview

This document describes a **mathematical key-based authentication system** that works completely offline without requiring database lookups. The key can be verified mathematically, and can be combined with biometric authentication for enhanced security.

## Core Concept

### Deterministic Key Derivation

Instead of storing passwords that need to be looked up, we use **deterministic key derivation**:

```
User's Master Key + User ID + Shop ID → (Mathematical Function) → Derived Key Hash
```

The system stores only the **derived key hash**, not the master key. When a user provides their key, the system:
1. Takes the provided key
2. Applies the same mathematical function
3. Compares the result with the stored hash
4. If they match, authentication succeeds

**No database lookup needed** - it's pure mathematics!

## How It Works

### Registration Flow

```
User Registers
    ↓
User Chooses Master Key
    ↓
System Derives Key Hash: PBKDF2(MasterKey, UserID, ShopID, Salt)
    ↓
Store Key Hash + Salt in PouchDB
    ↓
Master Key Never Stored ✅
```

### Authentication Flow

```
User Provides Key
    ↓
System Derives Key Hash: PBKDF2(ProvidedKey, UserID, ShopID, StoredSalt)
    ↓
Compare Derived Hash with Stored Hash
    ↓
If Match → Key Valid ✅
    ↓
[If Biometric Available] Prompt for Biometric
    ↓
Login Success ✅
```

## Mathematical Verification

### Key Derivation Function

```typescript
// Using PBKDF2 (Password-Based Key Derivation Function 2)
PBKDF2(
  masterKey: string,      // User's input
  salt: string,           // Random salt (stored)
  userId: string,         // User identifier
  shopId: string,         // Shop identifier
  iterations: 100000,     // Security parameter
  hash: "SHA-256"         // Hash algorithm
) → derivedKeyHash: string
```

### Verification Process

```typescript
// When user provides key:
providedKey → PBKDF2(...) → derivedHash1

// Compare with stored:
storedHash === derivedHash1 ? Valid : Invalid
```

**No database lookup** - pure mathematical comparison!

## Benefits

### ✅ Completely Offline
- No network required
- No CouchDB dependency
- Works in airplane mode

### ✅ No Database Lookup
- Key verification is mathematical
- Faster than database queries
- No PouchDB dependency for verification

### ✅ Secure
- Master key never stored
- Only hash is stored
- PBKDF2 with 100,000 iterations
- Salt prevents rainbow table attacks

### ✅ Flexible
- Can work standalone (key only)
- Can combine with biometric (key + biometric)
- Can work with or without PouchDB

## Implementation

### Storage

Key authentication data is stored in PouchDB:
- **Database**: `users`
- **Document ID**: `key_auth_{userId}`
- **Stored Data**:
  - `keyHash`: Derived key hash (not the master key!)
  - `salt`: Random salt for key derivation
  - `userId`, `shopId`: Identifiers

### Key Format

Users can use:
- **Passphrase**: "MySecurePassphrase123"
- **Random Key**: "a7f3b9c2d4e1f6g8h0"
- **Recovery Code**: "ABCD-1234-EFGH-5678"

### Security Parameters

- **Algorithm**: PBKDF2
- **Hash**: SHA-256
- **Iterations**: 100,000 (adjustable)
- **Key Length**: 256 bits (32 bytes)
- **Salt Length**: 128 bits (16 bytes)

## Usage Scenarios

### Scenario 1: Key Only (No Biometric)

```
User Opens App
    ↓
Enters Key
    ↓
System Verifies Mathematically
    ↓
Login Success ✅
```

### Scenario 2: Key + Biometric

```
User Opens App
    ↓
Enters Key
    ↓
System Verifies Mathematically ✅
    ↓
Device Prompts for Biometric
    ↓
User Uses Fingerprint/Face
    ↓
Login Success ✅
```

### Scenario 3: Offline (No PouchDB)

```
User Opens App (PouchDB Unavailable)
    ↓
Enters Key
    ↓
System Verifies Mathematically
    ↓
(Key hash could be stored in localStorage as fallback)
    ↓
Login Success ✅
```

## Comparison with Password Auth

| Feature | Password Auth | Key Auth |
|---------|--------------|----------|
| Database Lookup | ✅ Required | ❌ Not Needed |
| Offline Works | ⚠️ Needs PouchDB | ✅ Pure Math |
| Network Required | ❌ No | ❌ No |
| Verification Speed | Database Query | Mathematical |
| Storage | Password Hash | Key Hash |
| Biometric Support | ✅ Yes | ✅ Yes |

## Security Considerations

### ✅ What's Secure

1. **Master Key Never Stored** - Only hash is stored
2. **Salt Prevents Rainbow Tables** - Each user has unique salt
3. **PBKDF2 is Industry Standard** - Used by banks, governments
4. **High Iteration Count** - 100,000 iterations slow down brute force
5. **Deterministic but Secure** - Same input always gives same output, but can't reverse

### ⚠️ Considerations

1. **Key Loss** - If user loses key, access is lost (need recovery mechanism)
2. **Key Sharing** - Users might share keys (mitigate with biometric)
3. **Brute Force** - Still possible but slowed by PBKDF2 iterations
4. **Storage** - Key hash still needs to be stored somewhere

## Recovery Options

### Option 1: Recovery Key
Generate a deterministic recovery key from master key:
```
RecoveryKey = Hash("recovery:" + MasterKey + UserID + ShopID)
```

### Option 2: Backup Storage
Store key hash in multiple places:
- PouchDB (primary)
- localStorage (fallback)
- CouchDB (sync)

### Option 3: Admin Reset
Owner/Admin can reset key authentication for users

## Integration with Existing Auth

The key-based auth can work alongside:
- ✅ Password authentication (user chooses)
- ✅ Biometric authentication (combined)
- ✅ CouchDB validation (when online)

## Code Example

```typescript
// Register key
const { keyHash, salt } = await registerUserKey(
  userId,
  shopId,
  "MySecureKey123"
);
await storeKeyAuthData(userId, shopId, keyHash, salt);

// Authenticate
const keyAuthData = await getKeyAuthData(userId);
const isValid = await verifyKeyPBKDF2(
  "MySecureKey123",  // User provides
  userId,
  shopId,
  keyAuthData.keyHash,  // Stored hash
  keyAuthData.salt      // Stored salt
);

if (isValid) {
  // Login success - no database lookup needed!
}
```

## Future Enhancements

- [ ] Key rotation mechanism
- [ ] Multi-key support (primary + backup)
- [ ] Key strength meter
- [ ] Recovery key generation
- [ ] Key export/import
- [ ] Hardware key support (YubiKey, etc.)

---

**Key Principle**: Mathematical verification replaces database lookup, enabling completely offline authentication.



