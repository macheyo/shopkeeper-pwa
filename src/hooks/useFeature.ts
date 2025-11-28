"use client";

/**
 * React hook for feature checking
 */

import { useState, useEffect } from "react";
import { Feature } from "@/lib/features";
import { isFeatureEnabled, getEnabledFeatures } from "@/lib/featureCheck";

/**
 * Hook to check if a feature is enabled
 */
export function useFeature(feature: Feature): {
  enabled: boolean;
  loading: boolean;
} {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkFeature = async () => {
      try {
        const isEnabled = await isFeatureEnabled(feature);
        if (mounted) {
          setEnabled(isEnabled);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error checking feature:", error);
        if (mounted) {
          setEnabled(false);
          setLoading(false);
        }
      }
    };

    checkFeature();

    return () => {
      mounted = false;
    };
  }, [feature]);

  return { enabled, loading };
}

/**
 * Hook to get all enabled features
 */
export function useEnabledFeatures(): {
  features: Feature[];
  loading: boolean;
} {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadFeatures = async () => {
      try {
        const enabled = await getEnabledFeatures();
        if (mounted) {
          setFeatures(enabled);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error loading features:", error);
        if (mounted) {
          setFeatures([]);
          setLoading(false);
        }
      }
    };

    loadFeatures();

    return () => {
      mounted = false;
    };
  }, []);

  return { features, loading };
}
