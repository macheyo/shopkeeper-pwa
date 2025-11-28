# Offline-First Authentication Architecture

## Overview

This document explains how authentication works in an offline-first PWA with PouchDB/CouchDB sync.

## The Problem

In an offline-first app, users must be able to:
1. **Authenticate offline** - Login without network connectivity
2. **Sync when online** - Validate credentials against CouchDB when available
3. **Work seamlessly** - Transition between online/offline without breaking

## Solution: Hybrid Authentication Model

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION LAYERS                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: LOCAL AUTH (Always Available)                   │
│  ┌───────────────────────────────────────────────────┐   │
│  │ • PouchDB credentials storage                      │   │
│  │ • bcrypt password hashing                          │   │
│  │ • Local session management                         │   │
│  │ • Works 100% offline                              │   │
│  └───────────────────────────────────────────────────┘   │
│                                                             │
│  Layer 2: COUCHDB VALIDATION (When Online)                 │
│  ┌───────────────────────────────────────────────────┐   │
│  │ • Optional validation against CouchDB              │   │
│  │ • Creates CouchDB users on registration           │   │
│  │ • Validates credentials when online               │   │
│  │ • Fails open (allows local auth if CouchDB fails) │   │
│  └───────────────────────────────────────────────────┘   │
│                                                             │
│  Layer 3: SYNC AUTHENTICATION (During Sync)               │
│  ┌───────────────────────────────────────────────────┐   │
│  │ • Uses CouchDB credentials for sync              │   │
│  │ • Per-user or shop-level credentials              │   │
│  │ • Validates shopId during sync                   │   │
│  └───────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## How It Works

### 1. User Registration

```typescript
// When user registers:
1. Create user in local PouchDB ✅
2. Hash password with bcrypt ✅
3. Store credentials locally ✅
4. (Optional) Create CouchDB user if online ✅
   - Uses shop admin credentials
   - Creates user in CouchDB _users database
   - Stores CouchDB credentials locally
```

**Flow:**
```
User Registers
    ↓
Create Local User (PouchDB)
    ↓
Store Local Credentials
    ↓
[If Online] Create CouchDB User
    ↓
[If Online] Store CouchDB Credentials
    ↓
Registration Complete ✅
```

### 2. User Login

```typescript
// When user logs in:
1. Validate against local PouchDB ✅ (Always works)
2. (Optional) Validate against CouchDB if online ✅
   - Non-blocking
   - Fails open (allows login if CouchDB unavailable)
3. Create local session ✅
4. User can use app offline ✅
```

**Flow:**
```
User Logs In
    ↓
Validate Local Credentials (PouchDB)
    ↓
[If Valid] Check if Online
    ↓
[If Online] Validate Against CouchDB (Optional)
    ↓
[If CouchDB Valid OR Offline] Create Session
    ↓
Login Success ✅
```

**Key Point:** Local auth always works. CouchDB validation is optional and non-blocking.

### 3. Data Sync

```typescript
// When syncing:
1. Get CouchDB config (user-specific or shop-level)
2. Authenticate with CouchDB using credentials
3. Sync data with shopId validation
4. All shop data syncs (no permission checks)
```

**Flow:**
```
User Initiates Sync
    ↓
Get CouchDB Config (User or Shop Level)
    ↓
Authenticate with CouchDB
    ↓
Sync All Databases for Shop
    ↓
Validate shopId on All Documents
    ↓
Sync Complete ✅
```

## Credential Storage

### Local Credentials (PouchDB)
- **Location**: `users` database
- **Document ID**: `credentials_{userId}`
- **Storage**: Encrypted with crypto-pouch
- **Purpose**: Offline authentication
- **Always Available**: ✅

### CouchDB User Credentials (PouchDB)
- **Location**: `users` database  
- **Document ID**: `couchdb_user_{userId}`
- **Storage**: Encrypted with crypto-pouch
- **Purpose**: CouchDB authentication for sync
- **Available**: Only if CouchDB is configured

### Shop-Level CouchDB Config (PouchDB)
- **Location**: `settings` database
- **Document ID**: `couchdb_config_{shopId}`
- **Purpose**: Fallback if user-specific credentials not available
- **Used By**: Shop admin/owner for initial setup

## Authentication Scenarios

### Scenario 1: User Offline
```
1. User opens app (offline)
2. App checks localStorage for session
3. If session exists → User logged in ✅
4. If no session → Show login page
5. User enters credentials
6. Validate against local PouchDB ✅
7. Create session ✅
8. User can use app ✅
```

**Result:** Works 100% offline

### Scenario 2: User Online (First Time)
```
1. User registers
2. Create local user ✅
3. Create CouchDB user ✅
4. Store both credentials ✅
5. User logs in
6. Validate locally ✅
7. Validate against CouchDB ✅
8. Both valid → Login success ✅
```

**Result:** Credentials validated in both places

### Scenario 3: User Online (CouchDB Down)
```
1. User logs in
2. Validate locally ✅
3. Try to validate against CouchDB ❌ (fails)
4. Fail open → Allow login ✅
5. User can use app ✅
6. Sync will fail, but app works
```

**Result:** App works, sync unavailable

### Scenario 4: User Online (Normal)
```
1. User logs in
2. Validate locally ✅
3. Validate against CouchDB ✅
4. Both valid → Login success ✅
5. User can sync data ✅
```

**Result:** Full functionality

## Security Considerations

### ✅ What's Secure

1. **Local Auth**: Passwords hashed with bcrypt (10 rounds)
2. **Shop Isolation**: shopId validated on all operations
3. **Encrypted Storage**: Credentials encrypted in PouchDB
4. **CouchDB Auth**: Uses CouchDB session authentication
5. **Fail Open**: App works even if CouchDB unavailable

### ⚠️ Trade-offs

1. **Local Auth Can Be Bypassed**: Client-side only (acceptable for offline-first)
2. **CouchDB Validation Optional**: Fails open for offline support
3. **Credentials in Browser**: Encrypted but still accessible (mitigate with CSP)

## Code Examples

### Login with Optional CouchDB Validation

```typescript
// auth.ts
export async function verifyCredentials(
  email: string,
  password: string
): Promise<UserDoc | null> {
  // 1. Always validate locally first
  const isValid = await verifyPassword(password, localHash);
  if (!isValid) return null;

  // 2. Get user
  const user = await getUserById(userId);
  
  // 3. OPTIONAL: Validate against CouchDB if online
  if (navigator.onLine) {
    try {
      await validateUserAgainstCouchDB(user, password);
      // If fails, still allow login (fail open)
    } catch {
      // CouchDB unavailable - that's fine
    }
  }

  return user; // Login succeeds
}
```

### Sync with User-Specific Credentials

```typescript
// syncManager.ts
async initialize(user: UserDoc) {
  // Try user-specific credentials first
  const userCreds = await getCouchDBUserCredentials(user.userId);
  
  if (userCreds) {
    // Use user's CouchDB credentials
    this.config = {
      url: userCreds.couchdbUrl,
      username: userCreds.couchdbUsername,
      password: userCreds.couchdbPassword,
      shopId: user.shopId,
    };
  } else {
    // Fall back to shop-level config
    const shopConfig = await getCouchDBConfig(user.shopId);
    this.config = shopConfig;
  }
}
```

## Benefits

1. **✅ Works Offline**: Local auth always available
2. **✅ Enhanced Security**: CouchDB validation when online
3. **✅ Seamless UX**: No interruption when going offline
4. **✅ Flexible**: Works with or without CouchDB
5. **✅ Scalable**: Per-user or shop-level credentials

## Summary

**Offline Auth** = Local PouchDB credentials (always works)  
**Online Validation** = Optional CouchDB check (non-blocking)  
**Sync Auth** = CouchDB credentials (user-specific or shop-level)

The system **fails open** - if CouchDB is unavailable, the app still works using local authentication. This is the correct approach for offline-first applications.

---

**Key Principle**: Local auth is primary, CouchDB validation is enhancement.



