# CouchDB Sync Setup Guide

## Overview

The CouchDB sync functionality has been implemented! This allows your PWA to sync data with a CouchDB instance (like your local Docker setup) for backup and multi-device synchronization.

## What Was Implemented

### 1. Core Sync Infrastructure
- **`src/lib/couchdb.ts`** - CouchDB connection and authentication utilities
- **`src/lib/syncManager.ts`** - Sync manager with security validation
- **`src/lib/couchdbConfig.ts`** - Configuration storage and management

### 2. UI Components
- **`src/components/CouchDBConfig.tsx`** - Configuration UI component
- **Updated `src/app/sync/page.tsx`** - Sync page with CouchDB integration

## Features

✅ **Secure Authentication** - Uses CouchDB session authentication  
✅ **Permission Validation** - Validates user permissions before syncing  
✅ **Shop Isolation** - Only syncs data for the correct shop  
✅ **Real-time Status** - Shows sync progress and status  
✅ **Error Handling** - Comprehensive error handling and reporting  
✅ **Conflict Detection** - Tracks and reports sync conflicts  

## Setup Instructions

### 1. Configure CouchDB in Docker

Make sure your CouchDB Docker container is running and accessible:

```bash
# Example Docker run command
docker run -d \
  --name couchdb \
  -p 5984:5984 \
  -e COUCHDB_USER=admin \
  -e COUCHDB_PASSWORD=yourpassword \
  couchdb:latest
```

### 2. Enable CORS (Important!)

For browser access, you need to enable CORS in CouchDB. You can do this by:

**Option A: Using CouchDB Fauxton UI**
1. Open `http://localhost:5984/_utils` in your browser
2. Go to Configuration → CORS
3. Enable CORS and add your domain (or use `*` for development)

**Option B: Using curl**
```bash
curl -X PUT http://admin:yourpassword@localhost:5984/_node/couchdb@127.0.0.1/_config/httpd/enable_cors -d '"true"'
curl -X PUT http://admin:yourpassword@localhost:5984/_node/couchdb@127.0.0.1/_config/cors/origins -d '"*"'
curl -X PUT http://admin:yourpassword@localhost:5984/_node/couchdb@127.0.0.1/_config/cors/credentials -d '"true"'
curl -X PUT http://admin:yourpassword@localhost:5984/_node/couchdb@127.0.0.1/_config/cors/methods -d '"GET, PUT, POST, HEAD, DELETE"'
curl -X PUT http://admin:yourpassword@localhost:5984/_node/couchdb@127.0.0.1/_config/cors/headers -d '"accept, authorization, content-type, origin, referer, x-csrf-token"'
```

### 3. Create a CouchDB User

If you haven't already, create a user in CouchDB:

1. Open Fauxton: `http://localhost:5984/_utils`
2. Go to "Users" → "Add User"
3. Create a user with appropriate permissions

### 4. Configure in the App

1. Open your app and navigate to **Sync** page
2. Click on the **Configuration** tab
3. Enter your CouchDB details:
   - **URL**: `http://localhost:5984` (or your Docker host IP)
   - **Username**: Your CouchDB username
   - **Password**: Your CouchDB password
4. Click **Test Connection** to verify
5. Click **Save Configuration**
6. Enable the **Enable Sync** toggle

### 5. Start Syncing

1. Go back to the **Sync** tab
2. Select **Cloud** sync method
3. Click **Sync with CouchDB** to sync pending items
4. Watch the sync status in real-time

## Database Naming Convention

Databases are automatically created with the naming pattern:
```
{shopId}_{databaseName}
```

Examples:
- `abc123_products`
- `abc123_sales`
- `abc123_purchases`
- `abc123_users`

This ensures data isolation between different shops.

## Security Features

### 1. Shop Isolation
- All synced documents are validated to ensure they belong to the correct shop
- Documents from other shops are rejected

### 3. Secure Authentication
- Uses CouchDB session authentication
- Credentials are stored encrypted in local PouchDB
- Passwords are never exposed in the UI after saving

## Sync Status

The sync page shows:
- **Overall Status**: Syncing/Idle
- **Last Sync Time**: When sync last completed
- **Per-Database Status**: Status for each database
- **Pending Changes**: Number of documents waiting to sync
- **Conflicts**: Number of sync conflicts detected

## Troubleshooting

### Connection Failed
- Check CouchDB is running: `curl http://localhost:5984`
- Verify CORS is enabled
- Check username/password are correct
- Ensure CouchDB is accessible from your browser (not just localhost if using Docker)

### Sync Not Working
- Check sync is enabled in configuration
- Verify user has permissions in CouchDB
- Check browser console for errors
- Ensure shopId matches between local and remote

### CORS Errors
- Make sure CORS is enabled in CouchDB
- Check CORS headers are configured correctly
- For production, use specific origins instead of `*`

## Next Steps

1. **Test the connection** - Use the Test Connection button
2. **Sync a few items** - Start with a small batch
3. **Monitor sync status** - Watch the real-time status updates
4. **Check CouchDB** - Verify data appears in CouchDB Fauxton

## Production Considerations

For production deployment:

1. **Use HTTPS** - Always use HTTPS for CouchDB in production
2. **Restrict CORS** - Use specific origins, not `*`
3. **Strong Passwords** - Use strong CouchDB user passwords
4. **Network Security** - Secure your CouchDB instance
5. **Backup Strategy** - Set up CouchDB backups

## API Reference

### SyncManager

```typescript
import { getSyncManager } from '@/lib/syncManager';

const syncManager = getSyncManager();
syncManager.initialize(config, user);
await syncManager.syncAll(); // Sync all databases
await syncManager.syncDatabase('sales'); // Sync specific database
syncManager.stopAll(); // Stop all syncs
```

### Configuration

```typescript
import { getCouchDBConfig, saveCouchDBConfig } from '@/lib/couchdbConfig';

const config = await getCouchDBConfig(shopId);
await saveCouchDBConfig(shopId, config, true);
```

---

**Ready to sync!** 🚀

