"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  Stack,
  Button,
  Title,
  Text,
  Alert,
  Group,
  Switch,
  Divider,
} from "@mantine/core";
import {
  IconCloud,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconSettings,
} from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthContext";
import { CouchDBConfig, testCouchDBConnection } from "@/lib/couchdb";
import {
  getCouchDBConfig,
  saveCouchDBConfig,
  updateCouchDBTestResult,
  isCouchDBSyncEnabled,
  markFirstSyncCompleted,
} from "@/lib/couchdbConfig";

export default function CouchDBConfigComponent() {
  const { shop, currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);

  // Get config from environment variables
  const url = process.env.NEXT_PUBLIC_COUCHDB_URL || "http://localhost:5984";
  const username = process.env.NEXT_PUBLIC_COUCHDB_USERNAME || "admin";
  const password = process.env.NEXT_PUBLIC_COUCHDB_PASSWORD || "secret";

  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  // Load existing enabled state and enable by default if config exists
  useEffect(() => {
    const loadConfig = async () => {
      if (!shop) return;

      try {
        const config = await getCouchDBConfig(shop.shopId);
        const enabled = await isCouchDBSyncEnabled(shop.shopId);

        // If config exists but sync is not enabled, enable it by default
        if (config && !enabled) {
          console.log("CouchDB config found - enabling sync by default");
          setIsEnabled(true);
        } else {
          setIsEnabled(enabled);
        }
      } catch (err) {
        console.error("Error loading CouchDB config:", err);
      }
    };

    loadConfig();
  }, [shop]);

  // Auto-enable sync when component mounts if config exists but sync is disabled
  useEffect(() => {
    const autoEnable = async () => {
      if (!shop || !currentUser) return;

      try {
        const config = await getCouchDBConfig(shop.shopId);
        const enabled = await isCouchDBSyncEnabled(shop.shopId);

        // If config exists but sync is not enabled, auto-enable it
        if (config && !enabled) {
          console.log(
            "Auto-enabling CouchDB sync (config exists but sync disabled)"
          );
          setIsEnabled(true);
        }
      } catch (err) {
        console.error("Error checking sync status:", err);
      }
    };

    // Only auto-enable once when component first loads
    const timeoutId = setTimeout(autoEnable, 2000);
    return () => clearTimeout(timeoutId);
  }, [shop?.shopId, currentUser]); // Only depend on shopId to run once

  // Auto-save when enabled state changes to true (if it was auto-enabled)
  useEffect(() => {
    if (isEnabled && shop && currentUser && !loading && !testing) {
      // Small delay to ensure state is set
      const timeoutId = setTimeout(() => {
        handleSave();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled]); // Only trigger when enabled changes

  const handleTest = async () => {
    if (!shop) {
      setError("Shop not found");
      return;
    }

    setTesting(true);
    setError(null);
    setSuccess(null);
    setTestResult(null);

    try {
      // First, test if CouchDB is reachable
      try {
        const healthCheck = await fetch(url.replace(/\/$/, "") + "/", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!healthCheck.ok) {
          setError(
            `CouchDB not reachable: ${healthCheck.status} ${healthCheck.statusText}`
          );
          setTestResult({
            success: false,
            error: `Server returned ${healthCheck.status}`,
          });
          return;
        }
      } catch (healthErr) {
        setError(
          `Cannot reach CouchDB server. Make sure it's running and CORS is enabled. Error: ${
            healthErr instanceof Error ? healthErr.message : "Unknown"
          }`
        );
        setTestResult({
          success: false,
          error: "Connection failed - check if CouchDB is running",
        });
        return;
      }

      // Now test authentication
      const result = await testCouchDBConnection(url, username, password);

      setTestResult(result);

      if (result.success) {
        setSuccess("Connection successful!");
        // Update test result in storage
        await updateCouchDBTestResult(shop.shopId, true);
      } else {
        const errorMsg = result.error || "Connection failed";
        setError(errorMsg);
        await updateCouchDBTestResult(shop.shopId, false, errorMsg);
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to test connection";
      setError(errorMsg);
      setTestResult({ success: false, error: errorMsg });
      await updateCouchDBTestResult(shop.shopId, false, errorMsg);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!shop || !currentUser) {
      setError("Shop or user not found");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Test connection first
      const testResult = await testCouchDBConnection(url, username, password);

      if (!testResult.success) {
        setError(
          `Connection test failed. Cannot enable sync. ${testResult.error}`
        );
        setLoading(false);
        return;
      }

      // Save configuration with values from environment variables
      const config: CouchDBConfig = {
        url: url.trim(),
        username: username.trim(),
        password: password.trim(),
        shopId: shop.shopId,
      };

      // Initialize shop sync (create sync user and databases) if enabled
      let initResult: {
        success: boolean;
        syncUsername?: string;
        syncPassword?: string;
        error?: string;
      } | null = null;

      if (isEnabled) {
        try {
          const { initializeShopSync } = await import("@/lib/couchdbSecurity");
          console.log("Initializing shop sync - creating databases...");
          initResult = await initializeShopSync(shop.shopId, config);

          if (
            initResult.success &&
            initResult.syncUsername &&
            initResult.syncPassword
          ) {
            // Update config with sync user credentials
            config.syncUsername = initResult.syncUsername;
            config.syncPassword = initResult.syncPassword;
            console.log(
              "Shop sync initialized successfully - databases created"
            );
          } else {
            console.warn(
              "Shop sync initialization had issues:",
              initResult.error
            );
            // Try to ensure databases exist anyway (in case initialization partially failed)
            try {
              const { ensureAllDatabasesExist } = await import(
                "@/lib/couchdbSecurity"
              );
              await ensureAllDatabasesExist(shop.shopId, config);
            } catch (ensureErr) {
              console.error("Error ensuring databases exist:", ensureErr);
            }
            // Continue anyway - admin credentials can still be used
          }
        } catch (err) {
          console.error("Error initializing shop sync:", err);
          initResult = {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          };
          // Try to ensure databases exist anyway
          try {
            const { ensureAllDatabasesExist } = await import(
              "@/lib/couchdbSecurity"
            );
            await ensureAllDatabasesExist(shop.shopId, config);
          } catch (ensureErr) {
            console.error("Error ensuring databases exist:", ensureErr);
          }
          // Continue anyway - admin credentials can still be used
        }
      }

      await saveCouchDBConfig(shop.shopId, config, isEnabled);
      setSuccess("Configuration saved successfully!");
      setTestResult({ success: true });
      await updateCouchDBTestResult(shop.shopId, true);

      // If sync is enabled and initialized successfully, trigger first sync
      if (isEnabled && initResult && initResult.success) {
        try {
          const { getSyncManager } = await import("@/lib/syncManager");
          const syncManager = getSyncManager();

          // Initialize sync manager
          if (currentUser) {
            await syncManager.initialize(currentUser);

            // Trigger first sync for all databases
            // This will push all local data to CouchDB
            await syncManager.syncAll();

            // Mark first sync as completed after a delay
            setTimeout(async () => {
              await markFirstSyncCompleted(shop.shopId);
            }, 5000);

            setSuccess("Configuration saved and first sync started!");
          }
        } catch (syncErr) {
          console.error("Error starting first sync:", syncErr);
          // Don't fail the save - sync can be started manually later
          setSuccess(
            "Configuration saved. You can start sync manually from the Sync tab."
          );
        }
      }

      // Password is stored securely, no need to clear
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save configuration"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!shop) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="yellow">
        Please log in to configure CouchDB sync.
      </Alert>
    );
  }

  return (
    <Card withBorder shadow="sm" p="lg">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <IconSettings size={20} />
            <Title order={3}>CouchDB Sync Configuration</Title>
          </Group>
          <Switch
            label="Enable Sync"
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.currentTarget.checked)}
            disabled={loading || testing}
          />
        </Group>

        <Text size="sm" c="dimmed">
          Enable automatic data synchronization with CouchDB. Your data will be
          synced securely to your CouchDB instance.
        </Text>

        <Divider />

        <Alert icon={<IconSettings size={16} />} color="blue">
          <Text size="sm" fw={500} mb="xs">
            CouchDB Configuration (from environment variables)
          </Text>
          <Text size="xs" c="dimmed">
            <strong>URL:</strong> {url}
            <br />
            <strong>Username:</strong> {username}
            <br />
            <strong>Password:</strong> ••••••••
          </Text>
        </Alert>

        {testResult && (
          <Alert
            icon={
              testResult.success ? <IconCheck size={16} /> : <IconX size={16} />
            }
            color={testResult.success ? "green" : "red"}
            title={
              testResult.success ? "Connection Successful" : "Connection Failed"
            }
          >
            {testResult.success
              ? "Successfully connected to CouchDB. You can now save the configuration."
              : testResult.error || "Failed to connect to CouchDB"}
          </Alert>
        )}

        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            title="Error"
            onClose={() => setError(null)}
            withCloseButton
          >
            {error}
          </Alert>
        )}

        {success && (
          <Alert
            icon={<IconCheck size={16} />}
            color="green"
            title="Success"
            onClose={() => setSuccess(null)}
            withCloseButton
          >
            {success}
          </Alert>
        )}

        <Group justify="flex-end" gap="sm">
          <Button
            variant="outline"
            onClick={handleTest}
            loading={testing}
            disabled={loading}
            leftSection={<IconCloud size={16} />}
          >
            Test Connection
          </Button>
          <Button
            onClick={handleSave}
            loading={loading}
            disabled={testing}
            leftSection={<IconCheck size={16} />}
          >
            {isEnabled ? "Update Configuration" : "Enable Sync"}
          </Button>
        </Group>

        <Divider />

        <Text size="xs" c="dimmed">
          <strong>Note:</strong> CouchDB configuration is set via environment
          variables:
          <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
            <li>
              <code>NEXT_PUBLIC_COUCHDB_URL</code> (default:
              http://localhost:5984)
            </li>
            <li>
              <code>NEXT_PUBLIC_COUCHDB_USERNAME</code> (default: admin)
            </li>
            <li>
              <code>NEXT_PUBLIC_COUCHDB_PASSWORD</code> (default: secret)
            </li>
            <li>
              Database names will be prefixed with your shop ID (e.g.,{" "}
              <code>shop_{shop.shopId}_products</code>)
            </li>
          </ul>
        </Text>
      </Stack>
    </Card>
  );
}
