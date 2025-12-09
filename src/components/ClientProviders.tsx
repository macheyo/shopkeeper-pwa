"use client"; // Mark as client component

import React, { useEffect, useState } from "react";
import { MantineProvider } from "@mantine/core";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { MoneyProvider, MoneyContextType } from "@/contexts/MoneyContext";
import { DateFilterProvider } from "@/contexts/DateFilterContext";
import { AuthProvider } from "@/contexts/AuthContext";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import PWARegistration from "@/components/PWARegistration";
import PWADebug from "@/components/PWADebug";
import ShopkeeperAppShell from "@/components/AppShell";
import ClientSettingsLoader from "./ClientSettingsLoader";
import { LottieAnimation } from "@/types/lottie";

interface ClientProvidersProps {
  children: React.ReactNode;
  initialMoneySettings: MoneyContextType;
}

// This component wraps all client-side providers
export default function ClientProviders({
  children,
  initialMoneySettings,
}: ClientProvidersProps) {
  const [moneySettings, setMoneySettings] =
    useState<MoneyContextType>(initialMoneySettings);
  const [animationData, setAnimationData] = useState<LottieAnimation | null>(
    null
  );
  const [isLoadingAnimation, setIsLoadingAnimation] = useState(true);

  useEffect(() => {
    const loadAnimationData = async () => {
      try {
        setIsLoadingAnimation(true);

        // Fetch the JSON file from public directory
        const response = await fetch("/animations/money-loader.json");
        if (!response.ok) {
          throw new Error(
            `Failed to load animation: ${response.status} ${response.statusText}`
          );
        }

        // Parse the JSON data
        const data = await response.json();

        // Set the animation data with proper typing
        setAnimationData(data as LottieAnimation);
      } catch (error) {
        console.error("Error loading animation data:", error);
      } finally {
        setIsLoadingAnimation(false);
      }
    };

    loadAnimationData();
  }, []); // Run once on mount

  return (
    <MantineProvider defaultColorScheme="auto">
      <AuthProvider>
        <ClientSettingsLoader
          serverSettings={initialMoneySettings}
          onSettingsLoaded={setMoneySettings}
          lottieAnimationData={animationData || undefined}
        >
          <OnboardingProvider>
            <MoneyProvider initialSettings={moneySettings}>
              <DateFilterProvider>
                <ShopkeeperAppShell>{children}</ShopkeeperAppShell>
                <PWAInstallPrompt
                  debug={false}
                  title="Install ShopKeeper"
                  description="Install this app on your device for offline access and faster performance!"
                />
                <PWARegistration />
                {process.env.NODE_ENV === "development" && <PWADebug />}
              </DateFilterProvider>
            </MoneyProvider>
          </OnboardingProvider>
        </ClientSettingsLoader>
      </AuthProvider>
    </MantineProvider>
  );
}
