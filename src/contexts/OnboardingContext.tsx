"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getShopSettings, saveShopSettings } from "@/lib/settingsDB";
import { useAuth } from "@/contexts/AuthContext";
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
  const { shop, isAuthenticated, isLoading: authLoading } = useAuth();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      // Don't check onboarding if user is not authenticated or auth is still loading
      if (authLoading || !isAuthenticated || !shop?.shopId) {
        setIsLoading(false);
        return;
      }

      try {
        const settings = await getShopSettings(shop.shopId);
        const completed = settings?.hasCompletedOnboarding ?? false;
        setHasCompletedOnboarding(completed);

        // Only redirect if user is authenticated and onboarding is not complete
        // Don't redirect if already on login/register pages
        const publicRoutes = ["/login", "/register"];
        const isPublicRoute =
          publicRoutes.includes(pathname) || pathname.startsWith("/invite/");

        if (!completed && !isPublicRoute && pathname !== "/") {
          router.push("/");
        }
      } catch (error) {
        console.error("Error checking onboarding status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [pathname, router, shop?.shopId, isAuthenticated, authLoading]);

  const completeOnboarding = async () => {
    try {
      if (!shop?.shopId) {
        throw new Error("Shop ID is required to complete onboarding");
      }

      // Always use saveShopSettings which will handle merging with existing settings
      // This avoids conflicts by always getting the latest version
      await saveShopSettings({
        shopName: shop.shopName,
        businessType: "retail",
        baseCurrency: shop.baseCurrency,
        currencies: shop.currencies.map((c) => ({
          code: c.code,
          exchangeRate: c.exchangeRate,
        })),
        accounts: [],
        type: "settings",
        hasCompletedOnboarding: true,
        shopId: shop.shopId,
      });

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
