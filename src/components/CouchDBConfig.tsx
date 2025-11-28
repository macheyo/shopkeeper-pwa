"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  Stack,
  TextInput,
  PasswordInput,
  Button,
  Title,
  Text,
  Alert,
  Group,
  Switch,
  Badge,
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
} from "@/lib/couchdbConfig";

export default function CouchDBConfigComponent() {
  const { shop, currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);

  const [url, setUrl] = useState("http://localhost:5984");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  // Load existing configuration
  useEffect(() => {
    const loadConfig = async () => {
      if (!shop) return;

      try {
        const config = await getCouchDBConfig(shop.shopId);
        const enabled = await isCouchDBSyncEnabled(shop.shopId);

        if (config) {
          setUrl(config.url);
          setUsername(config.username);
          // Don't load password for security
          setIsEnabled(enabled);
        }
      } catch (err) {
        console.error("Error loading CouchDB config:", err);
      }
    };

    loadConfig();
  }, [shop]);

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
      const result = await testCouchDBConnection(url, username, password);

      setTestResult(result);

      if (result.success) {
        setSuccess("Connection successful!");
        // Update test result in storage
        await updateCouchDBTestResult(shop.shopId, true);
      } else {
        setError(result.error || "Connection failed");
        await updateCouchDBTestResult(shop.shopId, false, result.error);
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

    // Validate inputs
    if (!url.trim()) {
      setError("CouchDB URL is required");
      return;
    }

    if (!username.trim()) {
      setError("Username is required");
      return;
    }

    if (!password.trim()) {
      setError("Password is required");
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
          `Connection test failed. Cannot save configuration. ${testResult.error}`
        );
        return;
      }

      // Save configuration
      const config: CouchDBConfig = {
        url: url.trim(),
        username: username.trim(),
        password: password.trim(),
        shopId: shop.shopId,
      };

      await saveCouchDBConfig(shop.shopId, config, isEnabled);
      setSuccess("Configuration saved successfully!");
      setTestResult({ success: true });
      await updateCouchDBTestResult(shop.shopId, true);

      // Clear password field for security
      setPassword("");
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
          Configure your CouchDB connection to enable automatic data
          synchronization. Your data will be synced securely to your CouchDB
          instance.
        </Text>

        <Divider />

        <TextInput
          label="CouchDB URL"
          placeholder="http://localhost:5984"
          value={url}
          onChange={(e) => setUrl(e.currentTarget.value)}
          disabled={loading || testing}
          required
          description="Your CouchDB server URL (e.g., http://localhost:5984 for local Docker instance)"
        />

        <TextInput
          label="Username"
          placeholder="admin"
          value={username}
          onChange={(e) => setUsername(e.currentTarget.value)}
          disabled={loading || testing}
          required
        />

        <PasswordInput
          label="Password"
          placeholder="Enter your CouchDB password"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          disabled={loading || testing}
          required
          description={
            password
              ? "Password will be saved securely (encrypted in local database)"
              : "Enter password to save configuration"
          }
        />

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
            disabled={loading || !url || !username || !password}
            leftSection={<IconCloud size={16} />}
          >
            Test Connection
          </Button>
          <Button
            onClick={handleSave}
            loading={loading}
            disabled={testing || !url || !username || !password}
            leftSection={<IconCheck size={16} />}
          >
            Save Configuration
          </Button>
        </Group>

        <Divider />

        <Text size="xs" c="dimmed">
          <strong>Note:</strong> For local Docker CouchDB, make sure:
          <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
            <li>CouchDB is running and accessible</li>
            <li>CORS is enabled (for browser access)</li>
            <li>You have created a user with appropriate permissions</li>
            <li>
              Database names will be prefixed with your shop ID (e.g.,{" "}
              <code>{shop.shopId}_products</code>)
            </li>
          </ul>
        </Text>
      </Stack>
    </Card>
  );
}


