# Authentication Architecture Security Review
## Offline-First PWA with PouchDB/CouchDB

## Executive Summary

**Status: ⚠️ NEEDS HARDENING** - Architecture is sound for offline-first, but critical security improvements needed before production.

The authentication system is **well-designed for an offline-first PWA**, using local PouchDB storage with CouchDB sync. However, several security hardening measures are required to make it production-ready. **Note: This is NOT a traditional server-side auth app** - offline functionality is a core requirement.

---

## ✅ What's Working Well

### 1. **Password Security**
- ✅ Using `bcryptjs` with 10 salt rounds (good practice)
- ✅ Passwords are hashed before storage
- ✅ Minimum password length validation (6 characters - could be stronger)

### 2. **Architecture Design**
- ✅ Clean separation of concerns (AuthContext, auth.ts, permissions.ts)
- ✅ Role-based access control (RBAC) with clear permission system
- ✅ Protected routes implementation
- ✅ User status management (active/invited/suspended)

### 3. **Data Structure**
- ✅ Proper user/shop/invitation document structure
- ✅ Email normalization (lowercase)
- ✅ Timestamps for audit trail

---

## 🚨 Critical Security Issues

### 1. **Client-Side Authentication (ACCEPTABLE for Offline-First, but needs hardening)**

**Context:**
- ✅ **This is CORRECT for offline-first**: Users must authenticate offline
- ⚠️ **But needs security layers**: Local auth is fine, but needs protection

**Current Issues:**
- No rate limiting (brute force vulnerability)
- localStorage vulnerable to XSS (needs CSP mitigation)
- No session integrity checks
- No validation during CouchDB sync

**Recommendation (Offline-First Approach):**
- ✅ Keep local authentication (required for offline)
- ✅ Add **local rate limiting** (prevent brute force)
- ✅ Add **Content Security Policy** (mitigate XSS)
- ✅ Add **session integrity checks** (detect tampering)
- ✅ **Validate during CouchDB sync** (server-side validation when online)
- ✅ Use **CouchDB session tokens** instead of basic auth

### 2. **No Rate Limiting (HIGH)**

**Problem:**
- No protection against brute force attacks
- Unlimited login attempts
- No account lockout mechanism

**Impact:**
- **HIGH**: Attackers can brute force passwords
- **MEDIUM**: DoS potential through excessive login attempts

**Recommendation:**
- Implement rate limiting (e.g., 5 attempts per 15 minutes)
- Add account lockout after failed attempts
- Use exponential backoff
- Consider CAPTCHA after multiple failures

### 3. **Session Management (MEDIUM - Needs Improvement)**

**Current Implementation:**
```typescript
// auth.ts - Session stored in localStorage
localStorage.setItem(SESSION_KEY, JSON.stringify(session));
```

**Issues:**
- localStorage vulnerable to XSS (mitigate with CSP)
- 30-day expiry is long (reduce to 7 days)
- No session integrity checks
- No session rotation

**Offline-First Considerations:**
- ✅ localStorage is acceptable for offline-first (can't use HTTP-only cookies)
- ⚠️ But needs additional security layers

**Recommendation:**
- Add **Content Security Policy** headers (mitigate XSS)
- Add **session integrity hash** (detect tampering)
- Reduce expiry to **7 days** (balance security vs UX)
- Add **session rotation** on sensitive operations
- Consider **IndexedDB** for better security (async, more isolated)

### 4. **Weak Encryption Key Management (HIGH)**

**Problem:**
```typescript
const DB_KEY = process.env.NEXT_PUBLIC_DB_KEY || "default-insecure-key";
```

- Default insecure key if env var not set
- `NEXT_PUBLIC_` prefix means key is exposed in client bundle
- Same key used for all users (if compromised, all data at risk)

**Impact:**
- **CRITICAL**: If default key is used, encryption is useless
- **HIGH**: Encryption key visible in client-side JavaScript
- **MEDIUM**: Single key compromise affects all users

**Recommendation:**
- Never use default keys in production
- Generate per-user encryption keys (derived from password)
- Use Web Crypto API for client-side encryption
- Consider server-side key management for sensitive data

### 5. **No CSRF Protection (MEDIUM)**

**Problem:**
- No CSRF tokens
- All operations are client-side (mitigates some risk)
- If you add server-side APIs, CSRF becomes critical

**Impact:**
- **MEDIUM**: Currently low risk (client-side only)
- **HIGH**: Will become critical if server-side APIs are added

**Recommendation:**
- Implement CSRF tokens when adding server-side APIs
- Use SameSite cookies
- Validate Origin/Referer headers

### 6. **Insufficient Permission Enforcement (MEDIUM)**

**Problem:**
- Permissions checked in UI, but not consistently enforced in data operations
- No server-side permission validation
- Users can modify client code to bypass checks

**Example:**
```typescript
// Only UI-level checks found:
if (!hasPermission(currentUser, Permission.VIEW_USERS)) {
  return <Alert>Access Denied</Alert>;
}
// But no checks in data creation/modification functions
```

**Impact:**
- **MEDIUM**: Users can bypass UI checks
- **HIGH**: If server-side APIs added without validation

**Recommendation:**
- Add permission checks to all data operations
- Validate permissions server-side (when APIs are added)
- Add shopId validation to prevent cross-shop access
- Implement row-level security in database queries

### 7. **No Input Validation/Sanitization (MEDIUM)**

**Problem:**
- Limited input validation
- No sanitization of user inputs
- Email validation is basic (browser type="email")

**Impact:**
- **MEDIUM**: Potential for injection attacks
- **LOW**: PouchDB has some built-in protection

**Recommendation:**
- Add comprehensive input validation
- Sanitize all user inputs
- Use email validation library
- Validate shopId format (UUID)

### 8. **Missing Security Headers (LOW-MEDIUM)**

**Problem:**
- No Content Security Policy (CSP)
- No security headers configured
- No HTTPS enforcement

**Impact:**
- **MEDIUM**: XSS protection reduced
- **LOW**: Currently client-side only

**Recommendation:**
- Add CSP headers
- Implement security headers (HSTS, X-Frame-Options, etc.)
- Enforce HTTPS in production

### 9. **No Audit Logging (MEDIUM)**

**Problem:**
- No logging of authentication events
- No tracking of failed login attempts
- No audit trail for permission changes

**Impact:**
- **MEDIUM**: Cannot detect attacks
- **MEDIUM**: No forensic capability

**Recommendation:**
- Log all authentication events
- Track failed login attempts
- Log permission changes
- Store audit logs securely

### 10. **Password Reset Missing (LOW)**

**Problem:**
- No password reset functionality
- No "forgot password" flow

**Impact:**
- **LOW**: User experience issue
- **MEDIUM**: Support burden

**Recommendation:**
- Implement secure password reset flow
- Use time-limited tokens
- Send reset links via email (when email service added)

---

## 🔒 Production Readiness Checklist

### Must Fix Before Production:

- [ ] **Implement server-side authentication API**
- [ ] **Add rate limiting for login attempts**
- [ ] **Move sessions to HTTP-only cookies**
- [ ] **Remove default encryption key**
- [ ] **Add comprehensive permission enforcement**
- [ ] **Implement shopId validation on all operations**
- [ ] **Add security headers (CSP, HSTS, etc.)**
- [ ] **Add audit logging**
- [ ] **Implement password reset flow**

### Should Fix Soon:

- [ ] **Reduce session expiry time**
- [ ] **Add session rotation**
- [ ] **Implement "logout all devices"**
- [ ] **Add input validation/sanitization**
- [ ] **Add CSRF protection (when APIs added)**
- [ ] **Improve password requirements (8+ chars, complexity)**
- [ ] **Add 2FA option (future enhancement)**

### Nice to Have:

- [ ] **Biometric authentication**
- [ ] **Device fingerprinting**
- [ ] **Anomaly detection**
- [ ] **Security monitoring dashboard**

---

## 🏗️ Recommended Architecture Changes

### Phase 1: Server-Side API (Critical)

Create Next.js API routes:

```
/app/api/auth/
  ├── login/route.ts
  ├── register/route.ts
  ├── logout/route.ts
  ├── session/route.ts
  └── refresh/route.ts
```

**Example: `/app/api/auth/login/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyCredentials } from '@/lib/auth';
import { createSessionToken } from '@/lib/session';

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();
  
  // Rate limiting check
  // ... (implement rate limiting)
  
  const user = await verifyCredentials(email, password);
  if (!user) {
    return NextResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }
  
  const token = await createSessionToken(user);
  
  const response = NextResponse.json({ user });
  response.cookies.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24, // 24 hours
  });
  
  return response;
}
```

### Phase 2: Middleware for Route Protection

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const session = request.cookies.get('session');
  
  if (!session && request.nextUrl.pathname.startsWith('/app')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // Validate session token
  // Check permissions
  // Validate shopId
  
  return NextResponse.next();
}
```

### Phase 3: Enhanced Permission Enforcement

```typescript
// lib/dataAccess.ts
export async function createSale(
  saleData: SaleData,
  user: UserDoc,
  shopId: string
) {
  // Validate shopId matches user's shop
  if (user.shopId !== shopId) {
    throw new Error('Unauthorized: Invalid shop');
  }
  
  // Check permissions
  if (!hasPermission(user, Permission.CREATE_SALES)) {
    throw new Error('Unauthorized: Insufficient permissions');
  }
  
  // Add shopId and userId to sale
  const sale = {
    ...saleData,
    shopId: user.shopId,
    createdBy: user.userId,
  };
  
  // Create sale...
}
```

---

## 📊 Risk Assessment

| Risk | Severity | Likelihood | Impact | Priority |
|------|----------|------------|--------|----------|
| Client-side auth bypass | CRITICAL | High | Critical | P0 |
| No rate limiting | HIGH | High | High | P0 |
| localStorage XSS | HIGH | Medium | High | P0 |
| Default encryption key | CRITICAL | Low* | Critical | P0 |
| No permission enforcement | MEDIUM | Medium | Medium | P1 |
| No CSRF protection | MEDIUM | Low** | Medium | P1 |
| Missing audit logs | MEDIUM | N/A | Medium | P1 |
| No password reset | LOW | N/A | Low | P2 |

\* Low if env var is set, but high if forgotten  
\** Low currently (client-side only), but high if APIs added

---

## 🎯 Immediate Action Items

1. **DO NOT deploy to production** with current authentication
2. **Implement server-side authentication** (highest priority)
3. **Add rate limiting** before any public release
4. **Fix session management** (HTTP-only cookies)
5. **Remove default encryption key** and document key management
6. **Add comprehensive testing** for security scenarios

---

## 💡 Additional Recommendations

### For Offline-First PWA:

Since this is an offline-first PWA, consider:

1. **Hybrid Approach:**
   - Server-side authentication for online operations
   - Client-side tokens for offline operations (with expiry)
   - Sync authentication state when online

2. **Progressive Enhancement:**
   - Start with server-side auth
   - Add offline token caching
   - Implement token refresh mechanism

3. **Security Model:**
   - Online: Full server-side validation
   - Offline: Cached permissions with expiry
   - Sync: Validate all offline changes when syncing

---

## 📚 Resources

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Next.js Authentication Guide](https://nextjs.org/docs/app/building-your-application/authentication)
- [PWA Security Best Practices](https://web.dev/pwa-security/)

---

## 🔄 Important Note: Offline-First Architecture

**This application is an offline-first PWA using PouchDB/CouchDB.**

The security recommendations in this document have been updated to reflect offline-first requirements. For detailed implementation guidance specific to offline-first authentication, see:

**👉 [`OFFLINE_FIRST_AUTH_GUIDE.md`](./OFFLINE_FIRST_AUTH_GUIDE.md)**

That guide provides:
- Best practices for offline-first authentication
- Code examples for local rate limiting
- CouchDB session authentication
- Per-user encryption keys
- Enhanced permission enforcement
- Implementation priorities

---

**Review Date:** $(date)  
**Reviewer:** AI Security Analysis  
**Context:** Offline-First PWA with PouchDB/CouchDB  
**Next Review:** After implementing critical fixes

