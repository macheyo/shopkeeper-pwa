"use client";

import { useEffect, useState } from "react";
import { getShopSettings } from "@/lib/settingsDB";
import { MoneyContextType } from "@/contexts/MoneyContext";
import { CurrencyCode } from "@/types/money";
import LoadingSpinner from "./LoadingSpinner";
import { useMantineTheme } from "@mantine/core";
import { LottieAnimation } from "@/types/lottie";
import { useAuth } from "@/contexts/AuthContext";

// Default Lottie animation data - a simple pulsing spinner
// Now properly typed with LottieAnimation interface
const defaultLottieAnimation: LottieAnimation = {
  v: "5.9.0",
  fr: 30,
  ip: 0,
  op: 90,
  w: 200,
  h: 200,
  nm: "ShopKeeper Loading",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "Circle",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [100, 100, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [100, 100, 100], e: [110, 110, 100], h: 1 },
            { t: 45, s: [110, 110, 100], e: [100, 100, 100], h: 1 },
            { t: 90, s: [100, 100, 100], h: 1 },
          ],
        },
      },
      shapes: [
        {
          ty: "gr",
          it: [
            {
              d: 1,
              ty: "el",
              s: { a: 0, k: [80, 80] },
              p: { a: 0, k: [0, 0] },
            },
            {
              ty: "st",
              c: { a: 0, k: [0.2, 0.6, 1, 1] },
              o: { a: 0, k: 100 },
              w: { a: 0, k: 10 },
              lc: 2,
              lj: 2,
            },
            {
              ty: "tr",
              p: { a: 0, k: [0, 0] },

              s: { a: 0, k: [100, 100] },

              o: { a: 0, k: 100 },
            },
          ],
        },
      ],
    },
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: "Inner Circle",
      sr: 1,
      ks: {
        o: { a: 0, k: 80 },
        r: {
          a: 1,
          k: [
            { t: 0, s: [0], e: [180], h: 1 },
            { t: 90, s: [180], h: 1 },
          ],
        },
        p: { a: 0, k: [100, 100, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [75, 75, 100] },
      },
      shapes: [
        {
          ty: "gr",
          it: [
            {
              d: 1,
              ty: "el",
              s: { a: 0, k: [60, 60] },
              p: { a: 0, k: [0, 0] },
            },
            {
              ty: "st",
              c: { a: 0, k: [0.2, 0.6, 1, 1] },
              o: { a: 0, k: 100 },
              w: { a: 0, k: 6 },
              lc: 2,
              lj: 2,
            },
            {
              ty: "tr",
              p: { a: 0, k: [0, 0] },

              s: { a: 0, k: [100, 100] },

              o: { a: 0, k: 100 },
            },
          ],
        },
      ],
    },
  ],
};

interface ClientSettingsLoaderProps {
  children: React.ReactNode;
  serverSettings: MoneyContextType;
  onSettingsLoaded: (settings: MoneyContextType) => void;
  accentColor?: string;
  lottieAnimationData?: LottieAnimation;
  lottieAnimationPath?: string;
}

export default function ClientSettingsLoader({
  children,
  serverSettings,
  onSettingsLoaded,
  accentColor,
  lottieAnimationData,
  lottieAnimationPath,
}: ClientSettingsLoaderProps) {
  const { shop } = useAuth();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Initializing");
  const theme = useMantineTheme();

  useEffect(() => {
    const loadingSteps = [
      { message: "Connecting", delay: 300, progress: 20 },
      { message: "Loading settings", delay: 250, progress: 45 },
      { message: "Processing data", delay: 250, progress: 70 },
      { message: "Finalizing", delay: 300, progress: 90 },
      { message: "Ready", delay: 200, progress: 100 },
    ];

    let stepIndex = 0;
    let cancelled = false;

    async function loadClientSettings() {
      try {
        // Start with first loading step
        updateLoadingState(loadingSteps[stepIndex]);

        // Actually fetch settings
        const settings = await getShopSettings(shop?.shopId);
        if (cancelled) return;

        stepIndex++;
        updateLoadingState(loadingSteps[stepIndex]);

        if (settings) {
          // Process settings
          const rates = { ...serverSettings.exchangeRates };
          rates[settings.baseCurrency as CurrencyCode] = 1;

          const availableCurrencies = settings.currencies.map(
            (c) => c.code as CurrencyCode
          );

          if (
            !availableCurrencies.includes(settings.baseCurrency as CurrencyCode)
          ) {
            availableCurrencies.push(settings.baseCurrency as CurrencyCode);
          }

          stepIndex++;
          updateLoadingState(loadingSteps[stepIndex]);

          // Update rates from settings
          settings.currencies.forEach((c) => {
            rates[c.code as CurrencyCode] = c.exchangeRate;
          });

          const clientSettings: MoneyContextType = {
            baseCurrency: settings.baseCurrency as CurrencyCode,
            exchangeRates: rates,
            availableCurrencies,
            isLoading: false,
          };

          stepIndex++;
          updateLoadingState(loadingSteps[stepIndex]);

          // Call the callback with loaded settings
          onSettingsLoaded(clientSettings);
        } else {
          // If no settings found, use server settings
          onSettingsLoaded(serverSettings);
        }

        stepIndex = loadingSteps.length - 1;
        updateLoadingState(loadingSteps[stepIndex]);

        // Complete loading after a short delay
        await simulateStep(200);
        if (!cancelled) setLoading(false);
      } catch (error) {
        console.error("Error loading client settings:", error);
        if (!cancelled) {
          setStatusMessage("Using defaults");
          setProgress(100);
          onSettingsLoaded(serverSettings);
          await simulateStep(300);
          setLoading(false);
        }
      }
    }

    // Update loading state and wait for specified delay
    async function updateLoadingState(step: {
      message: string;
      delay: number;
      progress: number;
    }) {
      setStatusMessage(step.message);
      setProgress(step.progress);
      await simulateStep(step.delay);
    }

    // Helper function to simulate loading steps with small delays
    async function simulateStep(ms: number) {
      return new Promise<void>((resolve) => setTimeout(resolve, ms));
    }

    loadClientSettings();

    return () => {
      cancelled = true;
    };
  }, [serverSettings, onSettingsLoaded, shop?.shopId]);

  // Show loading spinner with Lottie animation while loading
  if (loading) {
    return (
      <>
        {/* Render children in the background but with pointer events disabled */}
        <div style={{ pointerEvents: "none", filter: "blur(4px)" }}>
          {children}
        </div>

        {/* Overlay the loading spinner as a dialog */}
        <LoadingSpinner
          size="md"
          message={statusMessage}
          subText={`${progress}%`}
          showProgress={true}
          fullScreen={false}
          accentColor={accentColor || theme.primaryColor}
          progress={progress}
          // Use custom animation if provided, otherwise use default
          animationData={lottieAnimationData || defaultLottieAnimation}
          animationPath={lottieAnimationPath}
        />
      </>
    );
  }

  // Render children once settings are loaded
  return <>{children}</>;
}
