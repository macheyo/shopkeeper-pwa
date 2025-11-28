# Multi-Tenant CouchDB Sync Plan
## Shop-Based Data Isolation and Synchronization

## Overview

This plan outlines the architecture for implementing multi-tenant CouchDB sync where each shop has isolated data and syncs independently. The system ensures complete data separation between shops while allowing efficient synchronization.

---

## Current State Analysis

### ✅ Already Implemented:
1. **Shop-based database naming**: `{shopId}_{databaseName}` pattern
2. **Shop ID validation**: Documents validated during sync
3. **Shop-level configuration**: CouchDB config stored per shop
4. **Filter-based sync**: Sync filters validate shopId

### ⚠️ Areas for Improvement:
1. **CouchDB user management**: Need shop-specific users/roles
2. **Database security**: Need CouchDB security documents per database
3. **Conflict resolution**: Need shop-aware conflict handling
4. **Performance**: Optimize for multiple shops on same CouchDB instance
5. **Monitoring**: Track sync per shop

---

## Architecture Design

### 1. Database Structure

#### Option A: Per-Shop Databases (Recommended)
```
CouchDB Instance
├── shop_abc123_products
├── shop_abc123_sales
├── shop_abc123_purchases
├── shop_abc123_users
├── shop_xyz789_products
├── shop_xyz789_sales
└── ...
```

**Pros:**
- Complete isolation (no cross-shop data leakage)
- Easy to backup/restore per shop
- Can delete entire shop data easily
- Better performance (smaller databases)
- Easier to scale (can move shops to different instances)

**Cons:**
- More databases to manage
- Slightly more complex setup

#### Option B: Single Database with Shop Filtering (Current)
```
CouchDB Instance
├── products (all shops, filtered by shopId)
├── sales (all shops, filtered by shopId)
└── ...
```

**Pros:**
- Fewer databases
- Simpler initial setup

**Cons:**
- Risk of data leakage if filters fail
- Harder to backup/restore per shop
- Performance degrades with more shops
- Harder to scale

**Recommendation: Use Option A (Per-Shop Databases)**

---

### 2. CouchDB User & Security Model

#### 2.1 User Structure

Each shop should have:
- **Shop Admin User**: `shop_{shopId}_admin` (full access to shop databases)
- **Shop Sync User**: `shop_{shopId}_sync` (read/write access for sync)

#### 2.2 Security Documents

Each shop database needs a security document:

```json
{
  "_id": "_security",
  "admins": {
    "names": ["shop_abc123_admin"],
    "roles": []
  },
  "members": {
    "names": ["shop_abc123_sync"],
    "roles": []
  }
}
```

This ensures:
- Only shop users can access shop databases
- Complete isolation between shops
- No cross-shop data access

#### 2.3 User Creation Flow

```typescript
// When shop registers or enables sync:
1. Create CouchDB user: shop_{shopId}_sync
2. Create shop databases: shop_{shopId}_products, etc.
3. Set security documents on each database
4. Grant user access only to their shop databases
```

---

### 3. Implementation Plan

#### Phase 1: Database Isolation (Week 1)

**1.1 Update Database Naming**
- Change from `{shopId}_{dbName}` to `shop_{shopId}_{dbName}`
- Ensures clear shop prefix
- Prevents naming conflicts

**Files to Update:**
- `src/lib/couchdb.ts` - `getRemoteDB()` function
- `src/lib/syncManager.ts` - Database name references

**1.2 Create Database Security Documents**
```typescript
// New function in src/lib/couchdb.ts
async function setDatabaseSecurity(
  dbName: string,
  config: CouchDBConfig,
  syncUsername: string
): Promise<void> {
  const securityDoc = {
    admins: { names: [], roles: [] },
    members: { names: [syncUsername], roles: [] }
  };
  
  // PUT to {dbUrl}/shop_{shopId}_{dbName}/_security
}
```

**1.3 Database Creation on First Sync**
- Auto-create databases when sync is enabled
- Set security documents immediately
- Validate shop isolation

---

#### Phase 2: User Management (Week 1-2)

**2.1 CouchDB User Creation**
```typescript
// New function in src/lib/couchdbAuth.ts
async function createShopSyncUser(
  shopId: string,
  config: CouchDBConfig
): Promise<{ username: string; password: string }> {
  // Create user: shop_{shopId}_sync
  // Generate secure password
  // Store password in encrypted config
  // Return credentials
}
```

**2.2 User Credential Storage**
- Store shop-specific sync credentials
- Encrypt passwords in local storage
- Never expose passwords in UI

**2.3 User Lifecycle**
- Create user when sync is enabled
- Update password periodically (optional)
- Delete user when shop is deleted (optional)

---

#### Phase 3: Enhanced Sync Manager (Week 2)

**3.1 Shop-Aware Sync Initialization**
```typescript
class SyncManager {
  async initialize(user: UserDoc, shop: ShopDoc): Promise<void> {
    // Get shop-specific config
    // Validate shop isolation
    // Initialize sync for shop databases only
  }
}
```

**3.2 Per-Shop Sync Status**
```typescript
interface ShopSyncStatus {
  shopId: string;
  isSyncing: boolean;
  databases: Record<string, DatabaseSyncStatus>;
  lastSyncAt: string | null;
  error: string | null;
}
```

**3.3 Conflict Resolution**
- Shop-aware conflict detection
- Automatic resolution based on shop rules
- Manual resolution UI per shop

---

#### Phase 4: Security & Validation (Week 2-3)

**4.1 Enhanced Validation**
```typescript
function validateShopIsolation(
  doc: any,
  expectedShopId: string
): boolean {
  // Validate shopId exists
  // Validate shopId matches
  // Reject if shopId is missing or wrong
  // Log security violations
}
```

**4.2 Sync Filter Enhancement**
```typescript
filter: (doc: any) => {
  // Design documents: allow
  if (doc._id?.startsWith("_design/")) return true;
  
  // Validate shop isolation
  if (!validateShopIsolation(doc, shopId)) {
    console.error("Security: Rejecting cross-shop document", doc._id);
    return false;
  }
  
  return true;
}
```

**4.3 Post-Sync Validation**
- Scan synced documents for shopId violations
- Remove any cross-shop documents
- Alert on security violations

---

#### Phase 5: Monitoring & Management (Week 3)

**5.1 Sync Dashboard**
- Per-shop sync status
- Database-level status
- Error tracking per shop
- Performance metrics

**5.2 Admin Tools**
- View all shops syncing
- Monitor shop sync health
- Troubleshoot sync issues
- Manual sync triggers

**5.3 Logging & Auditing**
- Log all sync operations per shop
- Track security violations
- Monitor performance per shop
- Generate sync reports

---

## Database Schema Updates

### Security Document Template
```json
{
  "_id": "_security",
  "admins": {
    "names": [],
    "roles": ["shop_admin"]
  },
  "members": {
    "names": ["shop_{shopId}_sync"],
    "roles": []
  }
}
```

### Document Structure (No Changes Needed)
All documents already have `shopId` field:
```json
{
  "_id": "product_123",
  "type": "product",
  "shopId": "abc123",
  "name": "Product Name",
  ...
}
```

---

## Configuration Structure

### Shop CouchDB Config
```typescript
interface ShopCouchDBConfig {
  url: string;
  shopId: string;
  syncUsername: string; // shop_{shopId}_sync
  syncPassword: string; // Encrypted
  adminUsername?: string; // shop_{shopId}_admin (optional)
  adminPassword?: string; // Encrypted (optional)
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}
```

---

## Security Considerations

### 1. Data Isolation
- ✅ Each shop has separate databases
- ✅ Security documents prevent cross-shop access
- ✅ Sync filters validate shopId
- ✅ Post-sync validation removes violations

### 2. Authentication
- ✅ Shop-specific users (no shared credentials)
- ✅ Encrypted password storage
- ✅ Session-based authentication
- ✅ Token expiration

### 3. Authorization
- ✅ Users can only access their shop databases
- ✅ No cross-shop document access
- ✅ Admin users have full shop access
- ✅ Sync users have read/write only

### 4. Monitoring
- ✅ Log all sync operations
- ✅ Alert on security violations
- ✅ Track cross-shop access attempts
- ✅ Audit trail per shop

---

## Migration Strategy

### For Existing Shops

1. **Phase 1: Database Migration**
   - Create new shop-specific databases
   - Copy data from old databases (filtered by shopId)
   - Update sync configuration

2. **Phase 2: User Migration**
   - Create shop-specific users
   - Update credentials in config
   - Test sync with new users

3. **Phase 3: Cleanup**
   - Remove old database references
   - Archive old databases
   - Update documentation

---

## Testing Strategy

### Unit Tests
- Database naming validation
- Security document creation
- Shop isolation validation
- User creation/management

### Integration Tests
- End-to-end sync per shop
- Cross-shop isolation verification
- Conflict resolution per shop
- Performance with multiple shops

### Security Tests
- Attempt cross-shop data access
- Validate security documents
- Test filter effectiveness
- Verify user permissions

---

## Performance Considerations

### 1. Database Size
- Smaller databases per shop = faster queries
- Better index performance
- Faster replication

### 2. Concurrent Syncs
- Each shop syncs independently
- No blocking between shops
- Parallel sync operations

### 3. Resource Usage
- Monitor CouchDB instance capacity
- Consider sharding for large shops
- Load balancing for multiple instances

---

## Implementation Checklist

### Phase 1: Database Isolation
- [ ] Update database naming to `shop_{shopId}_{dbName}`
- [ ] Create security document function
- [ ] Auto-create databases on sync enable
- [ ] Set security documents on creation
- [ ] Update `getRemoteDB()` function
- [ ] Test database isolation

### Phase 2: User Management
- [ ] Create `createShopSyncUser()` function
- [ ] Implement credential storage
- [ ] Update config structure
- [ ] Add user creation to sync setup
- [ ] Test user creation/authentication

### Phase 3: Enhanced Sync
- [ ] Update SyncManager initialization
- [ ] Add shop-aware status tracking
- [ ] Implement conflict resolution
- [ ] Add validation logging
- [ ] Test end-to-end sync

### Phase 4: Security
- [ ] Enhance validation functions
- [ ] Add post-sync validation
- [ ] Implement security logging
- [ ] Add violation alerts
- [ ] Security audit

### Phase 5: Monitoring
- [ ] Create sync dashboard
- [ ] Add per-shop metrics
- [ ] Implement logging system
- [ ] Create admin tools
- [ ] Documentation

---

## File Structure

```
src/lib/
├── couchdb.ts              # Core CouchDB functions (UPDATE)
├── couchdbConfig.ts        # Config management (UPDATE)
├── couchdbAuth.ts          # User management (NEW/UPDATE)
├── syncManager.ts          # Sync manager (UPDATE)
└── couchdbSecurity.ts      # Security documents (NEW)

src/components/
├── CouchDBConfig.tsx       # Config UI (UPDATE)
└── SyncDashboard.tsx       # Sync monitoring (NEW)

src/app/
└── sync/
    └── page.tsx            # Sync page (UPDATE)
```

---

## Success Criteria

1. ✅ Complete data isolation between shops
2. ✅ No cross-shop data access possible
3. ✅ Each shop syncs independently
4. ✅ Security documents prevent unauthorized access
5. ✅ Performance scales with number of shops
6. ✅ Monitoring and logging in place
7. ✅ Easy to add/remove shops
8. ✅ Backup/restore per shop

---

## Next Steps

1. **Review and approve this plan**
2. **Start with Phase 1: Database Isolation**
3. **Implement incrementally with testing**
4. **Document as we go**
5. **Deploy to production gradually**

---

## Questions to Consider

1. **CouchDB Instance**: Single instance for all shops or separate instances?
   - Recommendation: Start with single instance, scale later

2. **User Management**: Auto-create users or manual setup?
   - Recommendation: Auto-create for simplicity

3. **Backup Strategy**: Per-shop backups or full instance?
   - Recommendation: Per-shop for flexibility

4. **Monitoring**: Real-time or periodic?
   - Recommendation: Real-time for critical shops, periodic for others

---

## Conclusion

This plan provides a comprehensive approach to multi-tenant CouchDB sync with complete shop isolation. The phased approach allows for incremental implementation and testing, ensuring security and performance at each step.

