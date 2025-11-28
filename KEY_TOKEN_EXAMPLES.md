# Key + Token Examples

## Overview

This document shows real examples of what the key and token look like, and how they work together.

## Key Format

### What User Chooses
The key is a **passphrase** that the user chooses. It can be:

**Example Keys:**
```
"MySecureKey123"
"my-shop-password-2024"
"JohnDoeShopKey!"
"a7f3b9c2d4e1f6g8h0"
"ILoveMyShop2024!"
```

**Requirements:**
- Minimum 8 characters
- Maximum 128 characters
- Can be any combination of letters, numbers, symbols
- User chooses and remembers it

## Token Format

### Generated Token Structure

The token has two parts separated by a hyphen:

```
Token = {shortId}-{encryptedInfo}
```

**Format Breakdown:**
- **shortId**: First 8 characters of derived userId (for quick verification)
- **encryptedInfo**: Base64url-encoded encrypted data (username + phone + shopId)

### Example Tokens

**Example 1:**
```
Key: "MySecureKey123"
Token: "a7f3b9c2-XyZ123AbC456Def789Ghi012Jkl345Mno678Pqr901Stu234Vwx567"
```

**Example 2:**
```
Key: "shopkeeper2024!"
Token: "b8e4c0d3-YzA234Bcd567Efg890Hij123Klm456Nop789Qrs012Tuv345Wxy678"
```

**Example 3:**
```
Key: "john_doe_shop"
Token: "c9f5d1e4-ZaB345Cde678Fgh901Ijk234Lmn567Opq890Rst123Uvw456Xyz789"
```

## Complete Example

### Registration Example

```
User Registration:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Input:
  Key: "MySecureKey123"
  Username: "john_doe"
  Phone: "+1234567890"
  Shop ID: "shop_abc123"

System Processing:
  1. Derives userId: Hash("userid:MySecureKey123")
     → userId = "a7f3b9c2d4e1f6g8h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z8"
  
  2. Derives encryption key: PBKDF2("MySecureKey123", ...)
     → encryptionKey = [256-bit key]
  
  3. Encrypts: Encrypt({username, phone, shopId})
     → encryptedInfo = "XyZ123AbC456Def789Ghi012Jkl345Mno678Pqr901Stu234Vwx567"
  
  4. Creates token: "a7f3b9c2" + "-" + "XyZ123AbC456Def789Ghi012Jkl345Mno678Pqr901Stu234Vwx567"
     → token = "a7f3b9c2-XyZ123AbC456Def789Ghi012Jkl345Mno678Pqr901Stu234Vwx567"

Output to User:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Your Authentication Token:
  ┌─────────────────────────────────────────────────────────────────────┐
  │ a7f3b9c2-XyZ123AbC456Def789Ghi012Jkl345Mno678Pqr901Stu234Vwx567      │
  └─────────────────────────────────────────────────────────────────────┘
  
  Save this token securely! You'll need it along with your key to login.
```

### Login Example

```
User Login:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

User Provides:
  Key: "MySecureKey123"
  Token: "a7f3b9c2-XyZ123AbC456Def789Ghi012Jkl345Mno678Pqr901Stu234Vwx567"

System Processing:
  1. Splits token: 
     shortId = "a7f3b9c2"
     encryptedInfo = "XyZ123AbC456Def789Ghi012Jkl345Mno678Pqr901Stu234Vwx567"
  
  2. Derives userId from key:
     Hash("userid:MySecureKey123")
     → derivedUserId = "a7f3b9c2d4e1f6g8h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z8"
     → derivedShortId = "a7f3b9c2"
  
  3. Verifies: derivedShortId === "a7f3b9c2" ✅
  
  4. Derives encryption key: PBKDF2("MySecureKey123", ...)
     → encryptionKey = [256-bit key]
  
  5. Decrypts: Decrypt("XyZ123AbC456Def789Ghi012Jkl345Mno678Pqr901Stu234Vwx567")
     → decrypted = {
         username: "john_doe",
         phoneNumber: "+1234567890",
         shopId: "shop_abc123"
       }

Output to User:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✅ Authentication Successful!
  
  Extracted Information:
  • Username: john_doe
  • Phone: +1234567890
  • Shop ID: shop_abc123
  
  Welcome, john_doe!
```

## Token Structure Details

### Token Parts

```
Token: "a7f3b9c2-XyZ123AbC456Def789Ghi012Jkl345Mno678Pqr901Stu234Vwx567"
        └─────┬─────┘ └──────────────────────────────┬──────────────────────────────┘
           shortId                          encryptedInfo
        (8 characters)                    (base64url encoded)
```

### Short ID (First Part)
- **Length**: 8 characters
- **Format**: Hexadecimal (0-9, a-f)
- **Purpose**: Quick verification that key is correct
- **Example**: `a7f3b9c2`

### Encrypted Info (Second Part)
- **Length**: Variable (depends on encrypted data size)
- **Format**: Base64url encoded (URL-safe)
- **Contains**: Encrypted JSON with username, phone, shopId
- **Example**: `XyZ123AbC456Def789Ghi012Jkl345Mno678Pqr901Stu234Vwx567`

## Real-World Examples

### Example 1: Simple Key

```
Key: "password123"
Token: "d4e8f2a6-BcD789Efg012Hij345Klm678Nop901Qrs234Tuv567Wxy890Zab123"
```

### Example 2: Passphrase Key

```
Key: "MyShopPassword2024!"
Token: "e5f9a3b7-CdE890Fgh123Ijk456Lmn789Opq012Rst345Uvw678Xyz901Abc234"
```

### Example 3: Random Key

```
Key: "a7f3b9c2d4e1f6g8h0"
Token: "f6a0b4c8-DeF901Ghi234Jkl567Mno890Pqr123Stu456Vwx789Yza012Bcd345"
```

## What's Inside the Encrypted Part

The encrypted part contains (when decrypted):

```json
{
  "username": "john_doe",
  "phoneNumber": "+1234567890",
  "shopId": "shop_abc123"
}
```

This is encrypted with AES-GCM using a key derived from the user's master key.

## Visual Example

### Registration Screen

```
┌─────────────────────────────────────────────────────────┐
│  Create Authentication Token                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Username: [john_doe________________]                   │
│  Phone:    [+1234567890_____________]                   │
│  Shop ID:  [shop_abc123_____________]                   │
│  Key:      [MySecureKey123_________]                    │
│  Confirm:  [MySecureKey123_________]                    │
│                                                          │
│  [Create Token]                                          │
│                                                          │
└─────────────────────────────────────────────────────────┘

After Creation:
┌─────────────────────────────────────────────────────────┐
│  ✅ Token Created!                                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Your Token:                                             │
│  ┌───────────────────────────────────────────────────┐  │
│  │ a7f3b9c2-XyZ123AbC456Def789Ghi012Jkl345Mno678... │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  [Copy Token]                                            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Login Screen

```
┌─────────────────────────────────────────────────────────┐
│  Login with Key                                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Key:   [MySecureKey123________________]                │
│  Token: [a7f3b9c2-XyZ123AbC456Def789Ghi012Jkl345...]   │
│                                                          │
│  [Authenticate]                                          │
│                                                          │
└─────────────────────────────────────────────────────────┘

After Authentication:
┌─────────────────────────────────────────────────────────┐
│  ✅ Authentication Successful!                           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Extracted Information:                                  │
│  • Username: john_doe                                    │
│  • Phone: +1234567890                                    │
│  • Shop ID: shop_abc123                                  │
│                                                          │
│  Welcome, john_doe!                                      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Token Length

### Typical Token Sizes

- **Short ID**: 8 characters (always)
- **Encrypted Info**: ~80-120 characters (depends on data)
- **Total Token**: ~90-130 characters

**Example:**
```
a7f3b9c2-XyZ123AbC456Def789Ghi012Jkl345Mno678Pqr901Stu234Vwx567Yza890Bcd123Efg456
└─────┬─────┘ └──────────────────────────────────────────────┬──────────────────────┘
   8 chars                              ~100 chars
```

## Security Notes

### What's Visible
- ✅ **Short ID** - Public (first 8 chars of hash)
- ❌ **Encrypted Info** - Encrypted (can't read without key)

### What's Safe
- ✅ Token can be shared (without key, it's useless)
- ✅ Key is never stored or transmitted
- ✅ Encrypted data can't be read without key
- ✅ Short ID is just for verification

## Comparison

| Item | Format | Example |
|------|--------|---------|
| **Key** | User-chosen passphrase | `MySecureKey123` |
| **Token** | `{shortId}-{encrypted}` | `a7f3b9c2-XyZ123AbC...` |
| **Short ID** | 8 hex chars | `a7f3b9c2` |
| **Encrypted** | Base64url | `XyZ123AbC456Def...` |

## Summary

**Key**: User-chosen passphrase (e.g., `"MySecureKey123"`)

**Token**: Generated format `{shortId}-{encryptedInfo}` (e.g., `"a7f3b9c2-XyZ123AbC456Def789..."`)

**Login**: User provides key + token → System extracts username, phone, shopId

---

**Key Point**: Token format is `{8-char-id}-{encrypted-data}`. The encrypted data contains username, phone, and shopId - all extracted when key is provided!



