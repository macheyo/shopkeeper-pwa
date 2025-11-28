"use client";

/**
 * Feature Gate Component
 * Conditionally renders children based on feature availability
 */

import React from "react";
import { Feature } from "@/lib/features";
import { useFeature } from "@/hooks/useFeature";
import { Alert, Text } from "@mantine/core";
import { IconLock } from "@tabler/icons-react";

interface FeatureGateProps {
  feature: Feature;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showError?: boolean;
}

export default function FeatureGate({
  feature,
  children,
  fallback,
  showError = false,
}: FeatureGateProps) {
  const { enabled, loading } = useFeature(feature);

  if (loading) {
    return null; // Or a loading spinner
  }

  if (!enabled) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showError) {
      return (
        <Alert
          icon={<IconLock size={16} />}
          title="Feature Not Available"
          color="yellow"
        >
          <Text size="sm">
            This feature is not available in your current license. Please
            upgrade to access this feature.
          </Text>
        </Alert>
      );
    }

    return null;
  }

  return <>{children}</>;
}
