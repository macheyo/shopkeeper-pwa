# Multi-User Implementation Plan
## ShopKeeper PWA - User Management & CouchDB Sync

### Overview
This plan outlines the implementation of multi-user support with role-based access control, user management, and CouchDB synchronization for offline-first operation.

---

## Phase 1: Database Schema & Types

### 1.1 User Management Database
**File: `src/lib/usersDB.ts`**

```typescript
// New database for user management
export let usersDB: PouchDB.Database;

// User document structure
export interface UserDoc {
  _id: string; // user_{userId}
  _rev?: string;
  type: "user";
  userId: string; // Unique user identifier
  email: string;
  name: string;
  role: "owner" | "manager" | "employee";
  shopId: string; // Links user to shop
  status: "active" | "invited" | "suspended";
  invitedBy: string; // userId of inviter
  invitedAt: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Invitation document
export interface InvitationDoc {
  _id: string; // invitation_{inviteId}
  _rev?: string;
  type: "invitation";
  inviteId: string;
  email: string;
  role: "manager" | "employee";
  shopId: string;
  invitedBy: string;
  token: string; // Secure token for invitation acceptance
  expiresAt: string;
  status: "pending" | "accepted" | "expired";
  createdAt: string;
}
```

### 1.2 Update Existing Documents
Add `userId` and `shopId` fields to all existing document types:
- `ProductDoc`: Add `createdBy`, `shopId`
- `SaleDoc`: Add `createdBy`, `shopId`
- `PurchaseDoc`: Add `createdBy`, `shopId`
- `LedgerEntryDoc`: Add `createdBy`, `shopId`
- `CashInHand`: Add `createdBy`, `shopId`

### 1.3 Shop Document
**File: `src/types/index.ts`**

```typescript
export interface ShopDoc {
  _id: string; // shop_{shopId}
  _rev?: string;
  type: "shop";
  shopId: string;
  shopName: string;
  ownerId: string; // userId of owner
  businessType: string;
  baseCurrency: CurrencyCode;
  currencies: Array<{ code: CurrencyCode; exchangeRate: number }>;
  createdAt: string;
  updatedAt: string;
}
```

---

## Phase 2: Authentication System

### 2.1 Authentication Context
**File: `src/contexts/AuthContext.tsx`**

```typescript
interface AuthContextType {
  currentUser: UserDoc | null;
  shop: ShopDoc | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, shopName: string) => Promise<void>;
  acceptInvitation: (token: string, password: string) => Promise<void>;
}

// Features:
// - Local authentication using PouchDB
// - Password hashing (bcrypt or similar)
// - Session management (localStorage)
// - Auto-login on app start
```

### 2.2 Authentication Storage
- Store user credentials securely (hashed passwords)
- Use localStorage for session tokens
- Implement password reset flow
- Add biometric authentication (optional)

---

## Phase 3: User Management UI

### 3.1 User Management Page
**File: `src/app/users/page.tsx`**

Features:
- List all users (owner only)
- Invite new employees/managers
- Edit user roles
- Suspend/activate users
- View user activity

### 3.2 Invitation Flow
**File: `src/app/invite/page.tsx`**

- Owner/Manager can invite users
- Send invitation via email (or generate link)
- User accepts invitation and sets password
- User is added to shop

### 3.3 User Profile
**File: `src/app/profile/page.tsx`**

- View/edit own profile
- Change password
- View permissions
- Logout

---

## Phase 4: Permission System

### 4.1 Permission Helper
**File: `src/lib/permissions.ts`**

```typescript
export enum Permission {
  // Products
  VIEW_PRODUCTS = "view_products",
  CREATE_PRODUCTS = "create_products",
  EDIT_PRODUCTS = "edit_products",
  DELETE_PRODUCTS = "delete_products",
  
  // Sales
  VIEW_SALES = "view_sales",
  CREATE_SALES = "create_sales",
  EDIT_SALES = "edit_sales",
  DELETE_SALES = "delete_sales",
  
  // Purchases
  VIEW_PURCHASES = "view_purchases",
  CREATE_PURCHASES = "create_purchases",
  EDIT_PURCHASES = "edit_purchases",
  
  // Reports
  VIEW_REPORTS = "view_reports",
  EXPORT_REPORTS = "export_reports",
  
  // Settings
  VIEW_SETTINGS = "view_settings",
  EDIT_SETTINGS = "edit_settings",
  
  // Users
  VIEW_USERS = "view_users",
  INVITE_USERS = "invite_users",
  MANAGE_USERS = "manage_users",
}

// Role-based permissions
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: Object.values(Permission), // All permissions
  manager: [
    Permission.VIEW_PRODUCTS,
    Permission.CREATE_PRODUCTS,
    Permission.EDIT_PRODUCTS,
    Permission.VIEW_SALES,
    Permission.CREATE_SALES,
    Permission.VIEW_PURCHASES,
    Permission.CREATE_PURCHASES,
    Permission.VIEW_REPORTS,
    Permission.VIEW_SETTINGS,
    Permission.VIEW_USERS,
  ],
  employee: [
    Permission.VIEW_PRODUCTS,
    Permission.VIEW_SALES,
    Permission.CREATE_SALES,
    Permission.VIEW_PURCHASES,
  ],
};

export function hasPermission(user: UserDoc, permission: Permission): boolean {
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
}
```

### 4.2 Protected Routes & Components
- Add permission checks to all pages
- Hide UI elements based on permissions
- Show error messages for unauthorized actions

---

## Phase 5: CouchDB Sync Setup

### 5.1 CouchDB Configuration
**File: `src/lib/couchdb.ts`**

```typescript
// CouchDB connection configuration
export interface CouchDBConfig {
  url: string; // e.g., "https://your-couchdb-instance.cloudant.com"
  username: string;
  password: string;
  shopId: string;
}

// Initialize CouchDB remote databases
export async function getRemoteDB(
  localDBName: string,
  config: CouchDBConfig
): Promise<PouchDB.Database> {
  const remoteUrl = `${config.url}/${config.shopId}_${localDBName}`;
  return new PouchDB(remoteUrl, {
    auth: {
      username: config.username,
      password: config.password,
    },
  });
}
```

### 5.2 Sync Manager
**File: `src/lib/syncManager.ts`**

```typescript
export interface SyncStatus {
  isSyncing: boolean;
  lastSyncAt: string | null;
  pendingChanges: number;
  conflicts: number;
  error: string | null;
}

export class SyncManager {
  private syncHandles: Map<string, PouchDB.Replication.Sync<{}>> = new Map();
  
  // Sync all databases
  async syncAll(config: CouchDBConfig): Promise<void> {
    const databases = [
      "products",
      "sales",
      "purchases",
      "ledger",
      "inventory_lots",
      "cash_in_hand",
      "settings",
      "users",
    ];
    
    for (const dbName of databases) {
      await this.syncDatabase(dbName, config);
    }
  }
  
  // Sync individual database
  async syncDatabase(
    dbName: string,
    config: CouchDBConfig
  ): Promise<PouchDB.Replication.Sync<{}>> {
    const localDB = await getLocalDB(dbName);
    const remoteDB = await getRemoteDB(dbName, config);
    
    const sync = localDB
      .sync(remoteDB, {
        live: true, // Continuous sync
        retry: true, // Retry on failure
      })
      .on("change", (info) => {
        console.log(`Sync change in ${dbName}:`, info);
      })
      .on("paused", () => {
        console.log(`Sync paused for ${dbName}`);
      })
      .on("active", () => {
        console.log(`Sync active for ${dbName}`);
      })
      .on("error", (err) => {
        console.error(`Sync error in ${dbName}:`, err);
      });
    
    this.syncHandles.set(dbName, sync);
    return sync;
  }
  
  // Stop all syncs
  stopAll(): void {
    this.syncHandles.forEach((sync) => sync.cancel());
    this.syncHandles.clear();
  }
}
```

### 5.3 Conflict Resolution
**File: `src/lib/conflictResolver.ts`**

```typescript
// Strategy: Last-write-wins with user attribution
export async function resolveConflict(
  localDoc: PouchDB.Core.Document<any>,
  remoteDoc: PouchDB.Core.Document<any>
): Promise<PouchDB.Core.Document<any>> {
  // Compare timestamps
  const localTime = new Date(localDoc.updatedAt || localDoc.createdAt).getTime();
  const remoteTime = new Date(remoteDoc.updatedAt || remoteDoc.createdAt).getTime();
  
  // Keep the most recent version
  if (localTime > remoteTime) {
    return localDoc;
  } else {
    return remoteDoc;
  }
}

// For critical documents, implement manual conflict resolution UI
```

---

## Phase 6: Data Isolation & Security

### 6.1 Shop-Based Data Filtering
- All queries filter by `shopId`
- Users can only access their shop's data
- CouchDB uses separate databases per shop: `{shopId}_products`, `{shopId}_sales`, etc.

### 6.2 Document-Level Security
- Add `shopId` to all documents on creation
- Validate `shopId` on all read/write operations
- Prevent cross-shop data access

### 6.3 Encryption
- Continue using `crypto-pouch` for local encryption
- CouchDB data encrypted in transit (HTTPS)
- Consider field-level encryption for sensitive data

---

## Phase 7: UI Updates

### 7.1 Navigation Updates
- Add "Users" menu item (owner/manager only)
- Add user profile dropdown
- Show current user name/role
- Add sync status indicator

### 7.2 Sync Status Component
**File: `src/components/SyncStatus.tsx`**

- Show sync status (syncing, synced, error)
- Display last sync time
- Show pending changes count
- Manual sync button
- Conflict resolution UI

### 7.3 User Badge Component
- Show user role badge
- Display permissions
- Quick logout option

---

## Phase 8: Implementation Steps

### Step 1: Setup (Week 1)
1. ✅ Create user database schema
2. ✅ Add authentication context
3. ✅ Implement login/register flow
4. ✅ Add user management UI (basic)

### Step 2: Permissions (Week 2)
1. ✅ Implement permission system
2. ✅ Add permission checks to all pages
3. ✅ Update UI based on permissions
4. ✅ Test role-based access

### Step 3: CouchDB Integration (Week 3)
1. ✅ Setup CouchDB instance (Cloudant/self-hosted)
2. ✅ Implement sync manager
3. ✅ Add sync status UI
4. ✅ Test offline/online sync

### Step 4: Data Migration (Week 4)
1. ✅ Add `shopId` and `userId` to existing documents
2. ✅ Create shop document for existing data
3. ✅ Migrate existing user to owner role
4. ✅ Test data integrity

### Step 5: Invitation System (Week 5)
1. ✅ Implement invitation flow
2. ✅ Email integration (optional)
3. ✅ Invitation acceptance UI
4. ✅ Test invitation workflow

### Step 6: Conflict Resolution (Week 6)
1. ✅ Implement conflict detection
2. ✅ Add conflict resolution UI
3. ✅ Test conflict scenarios
4. ✅ Document conflict resolution strategy

### Step 7: Polish & Testing (Week 7)
1. ✅ UI/UX improvements
2. ✅ Error handling
3. ✅ Performance optimization
4. ✅ Security audit
5. ✅ User acceptance testing

---

## Phase 9: Technical Considerations

### 9.1 CouchDB Setup Options

**Option A: Cloudant (IBM)**
- Managed service
- Free tier available
- Easy setup
- Good for production

**Option B: Self-Hosted CouchDB**
- Full control
- Requires server management
- More cost-effective at scale

**Option C: Couchbase**
- Enterprise features
- More complex setup
- Better for large scale

**Recommendation: Start with Cloudant for ease, migrate to self-hosted if needed**

### 9.2 Database Naming Convention
```
Remote DBs: {shopId}_{databaseName}
Examples:
- shop123_products
- shop123_sales
- shop123_users
```

### 9.3 Sync Strategy
- **Live Sync**: Continuous bidirectional sync
- **Manual Sync**: User-triggered sync button
- **Auto Sync**: Sync on app focus/network reconnect
- **Batch Sync**: Sync all changes at once

### 9.4 Conflict Resolution Strategies
1. **Last-Write-Wins**: Simple, good for most cases
2. **User-Based**: Owner/Manager wins over Employee
3. **Manual Resolution**: UI for user to choose
4. **Merge Strategy**: For specific document types

---

## Phase 10: Security Best Practices

### 10.1 Authentication
- Use strong password hashing (bcrypt, argon2)
- Implement session tokens with expiration
- Add rate limiting for login attempts
- Support 2FA (optional, future enhancement)

### 10.2 Authorization
- Validate permissions on server-side (when adding API)
- Client-side checks are for UX only
- Never trust client-side validation alone

### 10.3 Data Security
- Encrypt sensitive fields (passwords, financial data)
- Use HTTPS for all CouchDB connections
- Implement CORS policies
- Regular security audits

---

## Phase 11: Testing Strategy

### 11.1 Unit Tests
- Permission checks
- Conflict resolution
- Data validation

### 11.2 Integration Tests
- Sync functionality
- Multi-user scenarios
- Offline/online transitions

### 11.3 E2E Tests
- Complete user workflows
- Invitation flow
- Role-based access

---

## Phase 12: Deployment Checklist

- [ ] CouchDB instance configured
- [ ] Database replication set up
- [ ] User authentication working
- [ ] Permissions tested
- [ ] Sync tested (offline/online)
- [ ] Conflict resolution tested
- [ ] Security audit completed
- [ ] Performance tested
- [ ] Documentation updated
- [ ] User training materials prepared

---

## Additional Recommendations

### 1. Analytics & Monitoring
- Track sync performance
- Monitor conflict rates
- User activity logs
- Error tracking

### 2. Backup Strategy
- Regular CouchDB backups
- Local data export feature
- Disaster recovery plan

### 3. Scalability
- Database indexing optimization
- Pagination for large datasets
- Lazy loading where appropriate

### 4. User Experience
- Clear sync status indicators
- Offline mode notifications
- Conflict resolution guidance
- User onboarding flow

---

## Dependencies to Add

```json
{
  "dependencies": {
    "bcryptjs": "^2.4.3", // Password hashing
    "@types/bcryptjs": "^2.4.6",
    "uuid": "^9.0.1", // Generate unique IDs
    "@types/uuid": "^9.0.7"
  }
}
```

---

## Next Steps

1. Review and approve this plan
2. Set up CouchDB instance (Cloudant recommended)
3. Start with Phase 1 (Database Schema)
4. Implement incrementally, testing at each phase
5. Get user feedback early and often

---

## Questions to Consider

1. **Email Service**: Do you want email invitations, or just generate links?
2. **CouchDB Hosting**: Cloudant or self-hosted?
3. **Conflict Strategy**: Last-write-wins or manual resolution?
4. **User Limits**: Any limits on number of users per shop?
5. **Pricing**: Will this be a paid feature or free?

---

*This plan is a living document and should be updated as implementation progresses.*

