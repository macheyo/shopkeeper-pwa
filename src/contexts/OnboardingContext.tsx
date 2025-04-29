"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getShopSettings, saveShopSettings } from "@/lib/settingsDB";
import LoadingSpinner from "@/components/LoadingSpinner";

interface OnboardingContextType {
  hasCompletedOnboarding: boolean;
  isLoading: boolean;
  completeOnboarding: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType>({
  hasCompletedOnboarding: false,
  isLoading: true,
  completeOnboarding: async () => {},
});

export function OnboardingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const settings = await getShopSettings();
        const completed = settings?.hasCompletedOnboarding ?? false;
        setHasCompletedOnboarding(completed);

        // If onboarding is not complete and user is not on home page, redirect to home
        if (!completed && pathname !== "/") {
          router.push("/");
        }
      } catch (error) {
        console.error("Error checking onboarding status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [pathname, router]);

  const completeOnboarding = async () => {
    try {
      const settings = await getShopSettings();
      if (settings) {
        await saveShopSettings({
          ...settings,
          hasCompletedOnboarding: true,
          updatedAt: new Date().toISOString(),
        });
      }
      setHasCompletedOnboarding(true);
    } catch (error) {
      console.error("Error completing onboarding:", error);
      throw error;
    }
  };

  return (
    <OnboardingContext.Provider
      value={{ hasCompletedOnboarding, isLoading, completeOnboarding }}
    >
      {isLoading ? (
        <LoadingSpinner size="md" message="Checking onboarding status..." />
      ) : (
        children
      )}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}
