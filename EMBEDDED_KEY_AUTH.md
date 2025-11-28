# Embedded Key Authentication

## Overview

**The key contains embedded information!** When user provides the key, the system extracts username and phone number - no lookups needed!

## Core Concept

The authentication token contains **encrypted user information** (username, phone) that can only be decrypted with the correct key.

```
Registration:
Key + Username + Phone + ShopID → Encrypt → Token
    ↓
Token = {userId}_{encryptedInfo}

Login:
Key + Token → Decrypt → Extract Username & Phone
    ↓
No lookup needed - info is in the token!
```

## How It Works

### Registration Flow

```
User Provides: Key + Username + Phone + ShopID
    ↓
System Derives: userId = Hash(Key + ShopID)
    ↓
System Encrypts: Encrypt(Username + Phone) with key-derived encryption key
    ↓
System Creates: Token = userId:encryptedInfo
    ↓
User Saves: Token (contains everything!)
```

### Login Flow

```
User Provides: Key + Token (ONLY!)
    ↓
System Extracts: userId and encryptedInfo from token
    ↓
System Derives: userId from key (for verification)
    ↓
System Compares: derivedUserId === tokenUserId
    ↓
If Match → Key is correct!
    ↓
System Decrypts: Decrypt(encryptedInfo) with key
    ↓
System Extracts: Username + Phone + ShopID
    ↓
Login Success with All Extracted Info! ✅
```

## Token Format

### User-Friendly Format (Recommended)
```
Token = {shortId}-{encryptedInfo}
Example: a7f3b9c2-XyZ123AbC...
```

### Embedded UserID Format
```
Token = {hash}_{encryptedInfo}
Example: a7f3b9c2d4e1f6g8h0..._XyZ123AbC...
```

### Full Token Format
```
Token = {userId}:{encryptedInfo}
Example: a7f3b9c2d4e1f6g8h0...:XyZ123AbC...
```

## What's Embedded

### Encrypted Information (All Extracted from Token!)
- ✅ **Username** (encrypted in token)
- ✅ **Phone Number** (encrypted in token)
- ✅ **Shop ID** (encrypted in token)

### Verification Data
- ✅ **User ID** (hash for verification)

## Benefits

### ✅ Zero Lookups
- No database queries
- No getUserByEmail
- No getUserById
- Information is in the token!

### ✅ Self-Contained
- Token contains everything
- Key decrypts the information
- No external dependencies

### ✅ Works Everywhere
- Works offline
- Works if data cleared
- Works if database deleted
- Just need key + token!

### ✅ Privacy
- Information is encrypted
- Only correct key can decrypt
- Token is safe to share (without key)

## Security

### ✅ What's Secure
- **AES-GCM Encryption** - Industry standard
- **Key-Derived Encryption Key** - PBKDF2 with 100,000 iterations
- **One-Way Hash** - Can't reverse to get key
- **Encrypted Data** - Can't read without key

### ⚠️ Considerations
- Token must be kept secure (contains encrypted info)
- Key must be kept secure (can decrypt token)
- If token is lost, need to regenerate

## Usage

### Create Token

```typescript
import { createUserFriendlyToken } from '@/lib/keyAuthEmbedded';

const result = await createUserFriendlyToken(
  "MySecureKey123",
  {
    username: "john_doe",
    phoneNumber: "+1234567890",
    shopId: "shop123"
  }
);

// result.token = "a7f3b9c2-XyZ123AbC..."
// User saves this token
```

### Verify Key & Extract Info

```typescript
import { verifyKeyFromUserFriendlyToken } from '@/lib/keyAuthEmbedded';

const result = await verifyKeyFromUserFriendlyToken(
  "MySecureKey123",  // User provides (ONLY!)
  "a7f3b9c2-XyZ123AbC..." // User provides (from registration)
);

if (result.valid) {
  // result.userInfo.username = "john_doe"
  // result.userInfo.phoneNumber = "+1234567890"
  // result.userInfo.shopId = "shop123"
  // No lookup needed - everything extracted from token!
}
```

## Components

### KeyAuthEmbeddedSetup
- Create token with embedded info
- User provides: Key + Username + Phone + ShopID
- System generates: Token with encrypted info

### KeyAuthEmbedded
- Login with key + token
- System extracts: Username + Phone
- No lookups needed!

## Example Flow

### Registration
```
1. User: "I want key auth with username 'john' and phone '+1234567890'"
2. System: Creates token "a7f3b9c2-XyZ123AbC..."
3. User: Saves token
4. Done!
```

### Login
```
1. User: Provides key + token (ONLY!)
2. System: Verifies key (derives userId)
3. System: Decrypts token → Extracts username, phone, AND shopId
4. System: "Welcome john! Phone: +1234567890, Shop: shop123"
5. Login success - no lookup, no shopId input needed!
```

## Comparison

| Method | Lookups | Storage | Info Extraction |
|--------|---------|--------|-----------------|
| Database lookup | ✅ Yes | Database | From database |
| Key + Email lookup | ✅ Yes | User document | From database |
| **Embedded in token** | **❌ No** | **Token** | **From token!** |

## Summary

**The key decrypts ALL information embedded in the token!**

- ✅ **Zero lookups** - info is in the token
- ✅ **Self-contained** - token has everything (username, phone, shopId)
- ✅ **Encrypted** - only correct key can decrypt
- ✅ **Works everywhere** - just need key + token
- ✅ **No shopId input** - shopId is extracted from token!

**Key Point**: Token = Encrypted(Username + Phone + ShopID). Key decrypts it. **User only provides key + token - everything else is extracted!**

---

**Ready to use!** Users can authenticate with key + token, and the system extracts username and phone automatically!

