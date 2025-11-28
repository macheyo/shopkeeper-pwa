# Offline-First Authentication Best Practices
## For PWA + PouchDB/CouchDB Applications

---

## 🎯 Understanding Offline-First Authentication

In offline-first applications, authentication must work **both online and offline**. This creates unique security challenges that differ from traditional server-side authentication.

### Key Principles:

1. **Local Authentication**: Users must be able to authenticate without network connectivity
2. **Offline Authorization**: Permission checks must work offline
3. **Sync Security**: When syncing with CouchDB, authentication must be validated server-side
4. **Data Isolation**: Each shop's data must be isolated even when stored locally

---

## ✅ Your Current Architecture (Assessment)

### What You're Doing Right:

1. ✅ **Local PouchDB Storage**: Credentials stored locally for offline access
2. ✅ **Password Hashing**: Using bcryptjs (10 rounds) - good
3. ✅ **Encrypted Local Storage**: Using crypto-pouch for database encryption
4. ✅ **Session Management**: localStorage-based sessions work offline
5. ✅ **Role-Based Permissions**: Permission system works offline
6. ✅ **Shop Isolation**: shopId-based data separation

### What Needs Improvement:

1. ⚠️ **CouchDB Authentication**: Need proper server-side validation during sync
2. ⚠️ **Rate Limiting**: Should be implemented locally + server-side
3. ⚠️ **Session Security**: localStorage vulnerable to XSS (mitigate with CSP)
4. ⚠️ **Encryption Key**: Default key is insecure, needs per-user keys
5. ⚠️ **Permission Enforcement**: Need validation during CouchDB sync

---

## 🏗️ Recommended Architecture for Offline-First Auth

### Hybrid Authentication Model

```
┌─────────────────────────────────────────────────────────┐
│                    OFFLINE MODE                          │
│  ┌──────────────┐      ┌──────────────┐                │
│  │   Local      │      │   Local       │                │
│  │  Auth Check  │─────▶│  Permission  │                │
│  │  (PouchDB)   │      │   Check      │                │
│  └──────────────┘      └──────────────┘                │
│         │                                               │
│         ▼                                               │
│  ┌──────────────┐                                      │
│  │  Local Data  │                                      │
│  │  Operations  │                                      │
│  └──────────────┘                                      │
└─────────────────────────────────────────────────────────┘
                        │
                        │ (When Online)
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    ONLINE MODE                           │
│  ┌──────────────┐      ┌──────────────┐                │
│  │   CouchDB    │      │   Server     │                │
│  │   Auth       │─────▶│  Validation  │                │
│  │  (Sync)      │      │  (CouchDB)   │                │
│  └──────────────┘      └──────────────┘                │
│         │                                               │
│         ▼                                               │
│  ┌──────────────┐                                      │
│  │  Sync Data   │                                      │
│  │  (Validated) │                                      │
│  └──────────────┘                                      │
└─────────────────────────────────────────────────────────┘
```

---

## 🔐 Best Practices for Offline-First Authentication

### 1. **Local Authentication (Offline)**

#### Current Implementation ✅
```typescript
// auth.ts - Good approach for offline
export async function verifyCredentials(
  email: string,
  password: string
): Promise<UserDoc | null> {
  const db = await getUsersDB();
  const credentials = await db.find({
    selector: { type: "credentials", email: email.toLowerCase() }
  });
  
  const isValid = await verifyPassword(password, credentials.passwordHash);
  return isValid ? user : null;
}
```

#### Improvements Needed:

**A. Add Local Rate Limiting**
```typescript
// lib/auth.ts
interface LoginAttempt {
  email: string;
  attempts: number;
  lastAttempt: string;
  lockedUntil?: string;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export async function checkRateLimit(email: string): Promise<boolean> {
  const db = await getUsersDB();
  const key = `rate_limit_${email.toLowerCase()}`;
  
  try {
    const doc = await db.get(key);
    const attempt: LoginAttempt = doc as any;
    
    // Check if locked
    if (attempt.lockedUntil && new Date(attempt.lockedUntil) > new Date()) {
      const minutesLeft = Math.ceil(
        (new Date(attempt.lockedUntil).getTime() - Date.now()) / 60000
      );
      throw new Error(`Account locked. Try again in ${minutesLeft} minutes.`);
    }
    
    // Reset if lockout expired
    if (attempt.lockedUntil && new Date(attempt.lockedUntil) <= new Date()) {
      await db.put({
        _id: key,
        _rev: attempt._rev,
        email: attempt.email,
        attempts: 0,
        lastAttempt: new Date().toISOString(),
      });
      return true;
    }
    
    return attempt.attempts < MAX_ATTEMPTS;
  } catch (err: any) {
    if (err.status === 404) {
      // No previous attempts
      return true;
    }
    throw err;
  }
}

export async function recordFailedAttempt(email: string): Promise<void> {
  const db = await getUsersDB();
  const key = `rate_limit_${email.toLowerCase()}`;
  
  try {
    const doc = await db.get(key);
    const attempt: LoginAttempt = doc as any;
    
    const newAttempts = attempt.attempts + 1;
    const lockedUntil = newAttempts >= MAX_ATTEMPTS
      ? new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString()
      : undefined;
    
    await db.put({
      _id: key,
      _rev: attempt._rev,
      email: attempt.email,
      attempts: newAttempts,
      lastAttempt: new Date().toISOString(),
      lockedUntil,
    });
  } catch (err: any) {
    if (err.status === 404) {
      // First failed attempt
      await db.put({
        _id: key,
        email: email.toLowerCase(),
        attempts: 1,
        lastAttempt: new Date().toISOString(),
      });
    } else {
      throw err;
    }
  }
}

export async function clearRateLimit(email: string): Promise<void> {
  const db = await getUsersDB();
  const key = `rate_limit_${email.toLowerCase()}`;
  
  try {
    const doc = await db.get(key);
    await db.remove(doc);
  } catch {
    // Doesn't exist, that's fine
  }
}
```

**B. Improve Session Security**
```typescript
// lib/auth.ts - Enhanced session management
export interface SessionData {
  userId: string;
  email: string;
  shopId: string;
  role: UserDoc["role"];
  expiresAt: string;
  createdAt: string;
  sessionId: string; // Add unique session ID
  deviceFingerprint?: string; // Optional device tracking
}

// Use IndexedDB instead of localStorage for better security
// Or use sessionStorage for shorter-lived sessions
export function createSession(user: UserDoc): SessionData {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Reduce to 7 days
  
  const session: SessionData = {
    userId: user.userId,
    email: user.email,
    shopId: user.shopId,
    role: user.role,
    expiresAt: expiresAt.toISOString(),
    createdAt: new Date().toISOString(),
    sessionId: uuidv4(), // Unique session ID
  };
  
  // Store in IndexedDB for better security (or keep localStorage with CSP)
  if (typeof window !== "undefined") {
    // Option 1: IndexedDB (more secure, async)
    storeSessionInIndexedDB(session);
    
    // Option 2: sessionStorage (shorter-lived, cleared on tab close)
    // sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    
    // Option 3: Keep localStorage but add integrity check
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(`${SESSION_KEY}_hash`, await hashSession(session));
  }
  
  return session;
}

// Add session integrity check
async function hashSession(session: SessionData): Promise<string> {
  const text = JSON.stringify(session);
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function getSession(): Promise<SessionData | null> {
  if (typeof window === "undefined") return null;
  
  try {
    const sessionJson = localStorage.getItem(SESSION_KEY);
    const hash = localStorage.getItem(`${SESSION_KEY}_hash`);
    
    if (!sessionJson) return null;
    
    const session: SessionData = JSON.parse(sessionJson);
    
    // Verify integrity
    const expectedHash = await hashSession(session);
    if (hash !== expectedHash) {
      console.warn("Session integrity check failed");
      clearSession();
      return null;
    }
    
    // Check expiry
    if (new Date(session.expiresAt) < new Date()) {
      clearSession();
      return null;
    }
    
    return session;
  } catch (err) {
    console.error("Error reading session:", err);
    clearSession();
    return null;
  }
}
```

### 2. **CouchDB Authentication (Online Sync)**

#### Current Plan (from MULTI_USER_IMPLEMENTATION_PLAN.md)
```typescript
// CouchDB uses basic auth with username/password
const remoteDB = new PouchDB(remoteUrl, {
  auth: {
    username: config.username,
    password: config.password,
  },
});
```

#### Improvements Needed:

**A. Use CouchDB Session Authentication**
```typescript
// lib/couchdbAuth.ts
export interface CouchDBSession {
  name: string; // CouchDB username
  roles: string[];
  shopId: string;
  token: string; // Session token
  expiresAt: string;
}

/**
 * Authenticate with CouchDB and get session token
 * This validates credentials server-side
 */
export async function authenticateWithCouchDB(
  url: string,
  username: string,
  password: string
): Promise<CouchDBSession> {
  const response = await fetch(`${url}/_session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: username,
      password: password,
    }),
  });
  
  if (!response.ok) {
    throw new Error('CouchDB authentication failed');
  }
  
  const data = await response.json();
  const cookie = response.headers.get('Set-Cookie');
  
  return {
    name: data.userCtx.name,
    roles: data.userCtx.roles,
    shopId: extractShopIdFromRoles(data.userCtx.roles),
    token: extractTokenFromCookie(cookie),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
  };
}

/**
 * Use session token for sync instead of basic auth
 */
export async function getRemoteDBWithSession(
  localDBName: string,
  config: CouchDBConfig,
  session: CouchDBSession
): Promise<PouchDB.Database> {
  const remoteUrl = `${config.url}/${config.shopId}_${localDBName}`;
  
  return new PouchDB(remoteUrl, {
    ajax: {
      headers: {
        'Authorization': `Bearer ${session.token}`,
      },
    },
  });
}
```

**B. Validate Permissions During Sync**
```typescript
// lib/syncManager.ts - Enhanced with permission validation
export class SyncManager {
  async syncDatabase(
    dbName: string,
    config: CouchDBConfig,
    user: UserDoc
  ): Promise<PouchDB.Replication.Sync<{}>> {
    // Validate user has permission to sync this database
    const requiredPermission = this.getPermissionForDatabase(dbName);
    if (!hasPermission(user, requiredPermission)) {
      throw new Error(`User does not have permission to sync ${dbName}`);
    }
    
    // Validate shopId matches
    if (user.shopId !== config.shopId) {
      throw new Error('Shop ID mismatch');
    }
    
    const localDB = await getLocalDB(dbName);
    const remoteDB = await getRemoteDB(dbName, config);
    
    // Add filter to only sync documents for this shop
    const sync = localDB
      .sync(remoteDB, {
        live: true,
        retry: true,
        filter: (doc: any) => {
          // Only sync documents that belong to this shop
          return doc.shopId === config.shopId;
        },
      })
      .on("change", (info) => {
        // Validate incoming documents
        this.validateSyncedDocuments(info, user);
      });
    
    return sync;
  }
  
  private getPermissionForDatabase(dbName: string): Permission {
    const permissionMap: Record<string, Permission> = {
      products: Permission.VIEW_PRODUCTS,
      sales: Permission.VIEW_SALES,
      purchases: Permission.VIEW_PURCHASES,
      users: Permission.VIEW_USERS,
    };
    return permissionMap[dbName] || Permission.VIEW_SETTINGS;
  }
  
  private validateSyncedDocuments(
    info: PouchDB.Replication.SyncResult<{}>,
    user: UserDoc
  ): void {
    // Validate all incoming documents belong to user's shop
    if (info.direction === 'pull') {
      const docs = info.change.docs || [];
      for (const doc of docs) {
        if ((doc as any).shopId !== user.shopId) {
          console.error('Security: Rejected document from different shop', doc);
          // Reject the document
        }
      }
    }
  }
}
```

### 3. **Per-User Encryption Keys**

#### Current Issue:
```typescript
// All users share the same encryption key
const DB_KEY = process.env.NEXT_PUBLIC_DB_KEY || "default-insecure-key";
```

#### Solution: Derive Keys from User Password
```typescript
// lib/encryption.ts
import { pbkdf2 } from 'crypto-browserify';

/**
 * Derive encryption key from user password
 * This ensures each user has a unique encryption key
 */
export async function deriveUserEncryptionKey(
  password: string,
  userId: string,
  salt?: string
): Promise<{ key: string; salt: string }> {
  // Generate salt if not provided
  const userSalt = salt || await generateSalt();
  
  // Derive key using PBKDF2
  const key = await pbkdf2(
    password,
    `${userSalt}_${userId}`,
    100000, // iterations
    32, // key length
    'sha-256'
  );
  
  return {
    key: Array.from(new Uint8Array(key))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''),
    salt: userSalt,
  };
}

async function generateSalt(): Promise<string> {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// Store salt with user credentials
export async function initializeUserEncryption(
  userId: string,
  password: string
): Promise<void> {
  const { key, salt } = await deriveUserEncryptionKey(password, userId);
  
  // Store salt with user document
  const user = await getUserById(userId);
  if (user) {
    await updateUser({
      ...user,
      encryptionSalt: salt, // Add to UserDoc type
    });
  }
  
  // Initialize database encryption with user-specific key
  const usersDB = await getUsersDB();
  await usersDB.crypto(key);
}
```

### 4. **Content Security Policy (CSP)**

Add CSP headers to mitigate XSS attacks on localStorage:

```typescript
// next.config.ts
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Required for PouchDB
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.cloudant.com https://*.couchdb.com", // CouchDB URLs
      "frame-ancestors 'none'",
    ].join('; ')
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  }
];

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
```

### 5. **Enhanced Permission Enforcement**

```typescript
// lib/dataAccess.ts - Wrapper for all data operations
export async function createSaleWithAuth(
  saleData: Omit<SaleDoc, '_id' | '_rev' | 'shopId' | 'createdBy'>,
  user: UserDoc
): Promise<SaleDoc> {
  // 1. Check permission
  if (!hasPermission(user, Permission.CREATE_SALES)) {
    throw new Error('Insufficient permissions to create sales');
  }
  
  // 2. Validate user status
  if (user.status !== 'active') {
    throw new Error('User account is not active');
  }
  
  // 3. Add shopId and userId (prevent tampering)
  const sale: SaleDoc = {
    ...saleData,
    shopId: user.shopId, // Always use from user, not from input
    createdBy: user.userId,
    type: 'sale',
    timestamp: new Date().toISOString(),
  };
  
  // 4. Create sale
  const db = await getSalesDB();
  const result = await db.put(sale);
  
  return { ...sale, _id: result.id, _rev: result.rev };
}

// Use this wrapper everywhere instead of direct DB access
```

---

## 🔒 Security Checklist for Offline-First Auth

### Must Have (P0):

- [x] Password hashing (bcrypt) ✅
- [ ] **Local rate limiting** (prevent brute force offline)
- [ ] **Session integrity checks** (detect tampering)
- [ ] **CouchDB session authentication** (validate server-side)
- [ ] **ShopId validation** (prevent cross-shop access)
- [ ] **Permission checks in data operations** (not just UI)
- [ ] **Content Security Policy** (mitigate XSS)
- [ ] **Remove default encryption key** (use per-user keys)

### Should Have (P1):

- [ ] **Session expiry** (reduce from 30 to 7 days)
- [ ] **Device fingerprinting** (detect session theft)
- [ ] **Audit logging** (track auth events)
- [ ] **Password strength requirements** (8+ chars, complexity)
- [ ] **Session rotation** (refresh on sensitive operations)

### Nice to Have (P2):

- [ ] **Biometric authentication** (WebAuthn)
- [ ] **2FA** (TOTP)
- [ ] **Password reset flow**
- [ ] **"Logout all devices"** functionality

---

## 📊 Risk Assessment (Updated for Offline-First)

| Risk | Severity | Mitigation | Priority |
|------|----------|------------|----------|
| Local brute force | HIGH | Local rate limiting | P0 |
| XSS session theft | HIGH | CSP headers + session integrity | P0 |
| Cross-shop data access | CRITICAL | shopId validation everywhere | P0 |
| CouchDB auth bypass | HIGH | Session tokens + server validation | P0 |
| Shared encryption key | HIGH | Per-user key derivation | P0 |
| Long-lived sessions | MEDIUM | Reduce expiry + rotation | P1 |
| No audit trail | MEDIUM | Add logging | P1 |

---

## 🚀 Implementation Priority

### Phase 1: Critical Security (Week 1)
1. Add local rate limiting
2. Implement shopId validation in all data operations
3. Add permission checks to data operations (not just UI)
4. Set up CSP headers
5. Remove default encryption key

### Phase 2: CouchDB Security (Week 2)
1. Implement CouchDB session authentication
2. Add permission validation during sync
3. Add shopId filtering in sync
4. Validate synced documents

### Phase 3: Enhanced Security (Week 3)
1. Per-user encryption keys
2. Session integrity checks
3. Reduce session expiry
4. Add audit logging

---

## 💡 Key Takeaways

1. **Offline-first auth is different**: You can't rely on server-side validation alone
2. **Defense in depth**: Multiple layers of security (local + server)
3. **Trust but verify**: Validate everything during sync
4. **Isolation is critical**: shopId validation prevents data leaks
5. **User experience matters**: Security shouldn't break offline functionality

---

## 📚 References

- [PouchDB Security Best Practices](https://pouchdb.com/guides/security.html)
- [CouchDB Authentication](https://docs.couchdb.org/en/stable/api/auth/intro.html)
- [OWASP PWA Security](https://owasp.org/www-project-web-security-testing-guide/)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

---

**Last Updated:** $(date)  
**Status:** Ready for implementation



