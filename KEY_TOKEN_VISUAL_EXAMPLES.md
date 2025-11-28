# Key + Token Visual Examples

## Quick Reference

### Key (User Provides)
```
Format: Any passphrase the user chooses
Length: 8-128 characters
Example: "MySecureKey123"
```

### Token (System Generates)
```
Format: {shortId}-{encryptedInfo}
Length: ~90-130 characters total
Example: "a7f3b9c2-XyZ123AbC456Def789Ghi012Jkl345Mno678Pqr901Stu234Vwx567"
```

## Complete Example Flow

### Step 1: Registration

**User Input:**
```
Key:        "MySecureKey123"
Username:   "john_doe"
Phone:      "+1234567890"
Shop ID:    "shop_abc123"
```

**System Output:**
```
Token: a7f3b9c2-XyZ123AbC456Def789Ghi012Jkl345Mno678Pqr901Stu234Vwx567Yza890Bcd123Efg456
```

**What User Saves:**
```
┌─────────────────────────────────────────────────────────────┐
│  Your Authentication Token                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  a7f3b9c2-XyZ123AbC456Def789Ghi012Jkl345Mno678Pqr901Stu    │
│  234Vwx567Yza890Bcd123Efg456                                │
│                                                              │
│  Save this token! You'll need it with your key to login.   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Step 2: Login

**User Provides:**
```
Key:   "MySecureKey123"
Token: "a7f3b9c2-XyZ123AbC456Def789Ghi012Jkl345Mno678Pqr901Stu234Vwx567Yza890Bcd123Efg456"
```

**System Extracts:**
```
Username:  "john_doe"
Phone:     "+1234567890"
Shop ID:   "shop_abc123"
```

## Token Breakdown

### Visual Structure

```
Token: a7f3b9c2-XyZ123AbC456Def789Ghi012Jkl345Mno678Pqr901Stu234Vwx567Yza890Bcd123Efg456
       └─────┬─────┘ └──────────────────────────────────────────────┬──────────────────────┘
          Part 1                        Part 2
       (Short ID)                  (Encrypted Data)
       8 characters              ~80-120 characters
       For verification         Contains username, phone, shopId
```

### Part 1: Short ID
- **Purpose**: Quick verification
- **Format**: 8 hexadecimal characters
- **Example**: `a7f3b9c2`
- **Derived from**: First 8 chars of `Hash("userid:" + key)`

### Part 2: Encrypted Data
- **Purpose**: Contains actual user information
- **Format**: Base64url encoded (URL-safe)
- **Length**: ~80-120 characters
- **Contains**: Encrypted JSON with username, phone, shopId
- **Example**: `XyZ123AbC456Def789Ghi012Jkl345Mno678Pqr901Stu234Vwx567Yza890Bcd123Efg456`

## Real Examples

### Example 1: Simple Setup

**Registration:**
```
Key: "password123"
Username: "alice"
Phone: "+254712345678"
Shop ID: "shop_xyz789"

Token Generated:
"d4e8f2a6-BcD789Efg012Hij345Klm678Nop901Qrs234Tuv567Wxy890Zab123Cde456Fgh789"
```

**Login:**
```
User Provides:
  Key: "password123"
  Token: "d4e8f2a6-BcD789Efg012Hij345Klm678Nop901Qrs234Tuv567Wxy890Zab123Cde456Fgh789"

System Extracts:
  Username: "alice"
  Phone: "+254712345678"
  Shop ID: "shop_xyz789"
```

### Example 2: Complex Key

**Registration:**
```
Key: "MyShop@2024!Secure#Key"
Username: "bob_smith"
Phone: "+255712345678"
Shop ID: "shop_main_street"

Token Generated:
"e5f9a3b7-CdE890Fgh123Ijk456Lmn789Opq012Rst345Uvw678Xyz901Abc234Def567Ghi890Jkl123"
```

**Login:**
```
User Provides:
  Key: "MyShop@2024!Secure#Key"
  Token: "e5f9a3b7-CdE890Fgh123Ijk456Lmn789Opq012Rst345Uvw678Xyz901Abc234Def567Ghi890Jkl123"

System Extracts:
  Username: "bob_smith"
  Phone: "+255712345678"
  Shop ID: "shop_main_street"
```

### Example 3: Short Key

**Registration:**
```
Key: "key12345"
Username: "charlie"
Phone: "+256712345678"
Shop ID: "shop_001"

Token Generated:
"f6a0b4c8-DeF901Ghi234Jkl567Mno890Pqr123Stu456Vwx789Yza012Bcd345Efg678Hij901Klm234"
```

## Token Format Details

### Character Set

**Short ID:**
- Characters: `0-9`, `a-f` (hexadecimal)
- Always lowercase
- Example: `a7f3b9c2`

**Encrypted Data:**
- Characters: `A-Z`, `a-z`, `0-9`, `-`, `_` (base64url)
- No `+`, `/`, or `=` (URL-safe)
- Example: `XyZ123AbC456Def789Ghi012Jkl345Mno678Pqr901Stu234Vwx567`

### Separator

- **Character**: Hyphen `-`
- **Purpose**: Separates short ID from encrypted data
- **Example**: `a7f3b9c2-XyZ123AbC...`

## What's Inside (When Decrypted)

The encrypted part contains this JSON (encrypted with AES-GCM):

```json
{
  "username": "john_doe",
  "phoneNumber": "+1234567890",
  "shopId": "shop_abc123"
}
```

This is encrypted, so in the token it looks like:
```
XyZ123AbC456Def789Ghi012Jkl345Mno678Pqr901Stu234Vwx567Yza890Bcd123Efg456
```

## UI Examples

### Registration Screen

```
╔═══════════════════════════════════════════════════════════╗
║  Create Authentication Token                              ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  Username:  [john_doe________________]                    ║
║  Phone:     [+1234567890_____________]                    ║
║  Shop ID:   [shop_abc123_____________]                    ║
║                                                           ║
║  Key:       [MySecureKey123_________]                     ║
║  Confirm:   [MySecureKey123_________]                     ║
║                                                           ║
║  [Create Token]                                           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

After clicking "Create Token":

╔═══════════════════════════════════════════════════════════╗
║  ✅ Token Created Successfully!                           ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  Your Authentication Token:                                 ║
║  ┌─────────────────────────────────────────────────────┐ ║
║  │ a7f3b9c2-XyZ123AbC456Def789Ghi012Jkl345Mno678Pqr901 │ ║
║  │ Stu234Vwx567Yza890Bcd123Efg456                      │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                           ║
║  [Copy Token]  [Save to File]                            ║
║                                                           ║
║  ⚠️ Save this token securely! You'll need it to login.  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

### Login Screen

```
╔═══════════════════════════════════════════════════════════╗
║  Login with Key                                           ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  Key:                                                     ║
║  ┌─────────────────────────────────────────────────────┐ ║
║  │ MySecureKey123                                      │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                           ║
║  Token:                                                   ║
║  ┌─────────────────────────────────────────────────────┐ ║
║  │ a7f3b9c2-XyZ123AbC456Def789Ghi012Jkl345Mno678Pqr901 │ ║
║  │ Stu234Vwx567Yza890Bcd123Efg456                      │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                           ║
║  [Authenticate]                                           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

After authentication:

╔═══════════════════════════════════════════════════════════╗
║  ✅ Authentication Successful!                            ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  Extracted Information:                                   ║
║  ┌─────────────────────────────────────────────────────┐ ║
║  │ 👤 Username:  john_doe                               │ ║
║  │ 📞 Phone:     +1234567890                           │ ║
║  │ 🏪 Shop ID:   shop_abc123                           │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                           ║
║  Welcome, john_doe!                                       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

## Token Storage Suggestions

### Option 1: Password Manager
```
Entry: ShopKeeper Authentication
Key: MySecureKey123
Token: a7f3b9c2-XyZ123AbC456Def789Ghi012Jkl345Mno678Pqr901Stu234Vwx567Yza890Bcd123Efg456
```

### Option 2: Text File
```
shopkeeper_auth.txt:
Key: MySecureKey123
Token: a7f3b9c2-XyZ123AbC456Def789Ghi012Jkl345Mno678Pqr901Stu234Vwx567Yza890Bcd123Efg456
```

### Option 3: QR Code
- Generate QR code with token
- Scan when needed
- Key entered manually

## Summary

**Key Format:**
- User-chosen passphrase
- Example: `"MySecureKey123"`
- 8-128 characters

**Token Format:**
- `{shortId}-{encryptedInfo}`
- Example: `"a7f3b9c2-XyZ123AbC456Def789Ghi012Jkl345Mno678Pqr901Stu234Vwx567"`
- ~90-130 characters total

**Login:**
- User provides: Key + Token
- System extracts: Username, Phone, Shop ID
- No other input needed!

---

**Key Point**: Token looks like `a7f3b9c2-XyZ123AbC456Def789...` - the first part verifies the key, the second part contains encrypted user info!



