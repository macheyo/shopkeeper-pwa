"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getShopSettings, saveShopSettings } from "@/lib/settingsDB";
import { useAuth } from "@/contexts/AuthContext";
import LoadingSpinner from "@/components/LoadingSpinner";
import { getCouchDBConfigForUser } from "@/lib/couchdbAuth";
import { getRemoteDB } from "@/lib/couchdb";
import { getLocalDB } from "@/lib/couchdb";

interface OnboardingContextType {
  hasCompletedOnboarding: boolean;
  isLoading: boolean;
  completeOnboarding: () => Promise<void>;
  onboardingError: string | null;
  requiresInternet: boolean;
}

const OnboardingContext = createContext<OnboardingContextType>({
  hasCompletedOnboarding: false,
  isLoading: true,
  completeOnboarding: async () => {},
  onboardingError: null,
  requiresInternet: false,
});

export function OnboardingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    shop,
    isAuthenticated,
    isLoading: authLoading,
    currentUser,
  } = useAuth();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [requiresInternet, setRequiresInternet] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      // Don't check onboarding if user is not authenticated or auth is still loading
      if (authLoading || !isAuthenticated || !shop?.shopId || !currentUser) {
        setIsLoading(false);
        return;
      }

      try {
        setOnboardingError(null);
        setRequiresInternet(false);

        // First check local settings
        const settings = await getShopSettings(shop.shopId);
        const completed = settings?.hasCompletedOnboarding ?? false;

        if (completed) {
          setHasCompletedOnboarding(true);
          setIsLoading(false);
          return;
        }

        // Check if local PouchDB is empty
        const localSettingsDB = await getLocalDB("settings");
        const localInfo = await localSettingsDB.info();
        const hasLocalData = localInfo.doc_count > 0;

        // If no local data, check CouchDB first before showing onboarding
        if (!hasLocalData) {
          console.log(
            "[ONBOARDING] No local PouchDB data, checking CouchDB..."
          );

          try {
            // Try to get CouchDB config for user
            const couchConfig = await getCouchDBConfigForUser(currentUser);

            if (couchConfig) {
              // CouchDB is configured - check if it has data
              try {
                // Check if settings database has data (indicates shop is set up)
                const remoteSettingsDB = await getRemoteDB(
                  "settings",
                  couchConfig
                );
                const remoteInfo = await remoteSettingsDB.info();

                if (remoteInfo.doc_count > 0) {
                  // CouchDB has data but local is empty - sync it down
                  console.log(
                    "[ONBOARDING] CouchDB has data, local PouchDB empty - syncing..."
                  );

                  // Initialize and sync
                  const { getSyncManager } = await import("@/lib/syncManager");
                  const syncManager = getSyncManager();

                  await syncManager.initialize(currentUser);
                  await syncManager.syncAll();

                  // Wait a bit for sync to complete, then check settings again
                  setTimeout(async () => {
                    try {
                      const updatedSettings = await getShopSettings(
                        shop.shopId
                      );
                      if (updatedSettings?.hasCompletedOnboarding) {
                        console.log(
                          "[ONBOARDING] Onboarding completed via sync"
                        );
                        setHasCompletedOnboarding(true);
                      } else if (updatedSettings) {
                        // Settings synced but onboarding flag not set - mark as complete
                        console.log(
                          "[ONBOARDING] Settings synced, marking onboarding as complete"
                        );
                        await saveShopSettings({
                          ...updatedSettings,
                          hasCompletedOnboarding: true,
                        });
                        setHasCompletedOnboarding(true);
                      } else {
                        // Still no settings after sync - might need to wait longer
                        console.log(
                          "[ONBOARDING] Waiting longer for sync to complete..."
                        );
                        setTimeout(async () => {
                          const retrySettings = await getShopSettings(
                            shop.shopId
                          );
                          if (retrySettings) {
                            await saveShopSettings({
                              ...retrySettings,
                              hasCompletedOnboarding: true,
                            });
                            setHasCompletedOnboarding(true);
                          } else {
                            console.error(
                              "[ONBOARDING] Sync completed but no settings found"
                            );
                          }
                          setIsLoading(false);
                        }, 5000);
                        return;
                      }
                    } catch (err) {
                      console.error(
                        "[ONBOARDING] Error checking settings after sync:",
                        err
                      );
                    } finally {
                      setIsLoading(false);
                    }
                  }, 5000); // Give sync time to complete

                  return;
                } else {
                  // CouchDB accessible but no data - require internet for initial setup
                  console.log(
                    "[ONBOARDING] No data in CouchDB or local - internet required"
                  );
                  setOnboardingError(
                    "No shop data found. Please connect to the internet for initial setup."
                  );
                  setRequiresInternet(true);
                  setHasCompletedOnboarding(false);
                  setIsLoading(false);
                  return;
                }
              } catch (couchError: any) {
                // Can't connect to CouchDB
                console.error(
                  "[ONBOARDING] Cannot connect to CouchDB:",
                  couchError
                );
                // No local data and can't connect to CouchDB - need internet
                console.log(
                  "[ONBOARDING] No local data and CouchDB unreachable - internet required"
                );
                setOnboardingError(
                  "Cannot connect to cloud. Please connect to the internet for initial setup."
                );
                setRequiresInternet(true);
                setHasCompletedOnboarding(false);
                setIsLoading(false);
                return;
              }
            } else {
              // CouchDB not configured and no local data - require internet
              console.log(
                "[ONBOARDING] CouchDB not configured and no local data - internet required"
              );
              setOnboardingError(
                "No shop data found. Please connect to the internet for initial setup."
              );
              setRequiresInternet(true);
              setHasCompletedOnboarding(false);
              setIsLoading(false);
              return;
            }
          } catch (configError) {
            console.error(
              "[ONBOARDING] Error checking CouchDB config:",
              configError
            );
            // Can't check CouchDB and no local data - require internet
            setOnboardingError(
              "Cannot verify cloud data. Please connect to the internet for initial setup."
            );
            setRequiresInternet(true);
            setHasCompletedOnboarding(false);
            setIsLoading(false);
            return;
          }
        }

        // Have local data but onboarding not complete - check CouchDB first
        console.log(
          "[ONBOARDING] Local data exists but onboarding not complete, checking CouchDB..."
        );

        // Check CouchDB to see if it has the correct onboarding status
        try {
          const couchConfig = await getCouchDBConfigForUser(currentUser);

          if (couchConfig) {
            try {
              // Check remote settings for onboarding status
              const remoteSettingsDB = await getRemoteDB(
                "settings",
                couchConfig
              );
              const remoteInfo = await remoteSettingsDB.info();

              if (remoteInfo.doc_count > 0) {
                // Try to get the settings document from CouchDB
                const remoteResult = await remoteSettingsDB.find({
                  selector: {
                    type: "settings",
                    shopId: shop.shopId,
                  },
                  limit: 1,
                });

                if (remoteResult.docs.length > 0) {
                  const remoteSettings = remoteResult.docs[0] as any;
                  if (remoteSettings.hasCompletedOnboarding === true) {
                    // CouchDB has correct status - directly save it to local
                    console.log(
                      "[ONBOARDING] CouchDB has onboarding completed, updating local settings..."
                    );

                    // Get current local settings to merge
                    const localSettings = await getShopSettings(shop.shopId);

                    // Update local settings with the remote onboarding flag
                    await saveShopSettings({
                      ...localSettings,
                      ...remoteSettings,
                      hasCompletedOnboarding: true,
                      shopId: shop.shopId,
                    });

                    console.log(
                      "[ONBOARDING] Local settings updated from CouchDB, onboarding now complete"
                    );
                    setHasCompletedOnboarding(true);
                    setIsLoading(false);

                    // Also trigger sync in background for other databases
                    try {
                      const { getSyncManager } = await import(
                        "@/lib/syncManager"
                      );
                      const syncManager = getSyncManager();
                      await syncManager.initialize(currentUser);
                      syncManager.syncAll().catch((err) => {
                        console.error("Background sync error:", err);
                      });
                    } catch (syncError) {
                      console.error(
                        "Error starting background sync:",
                        syncError
                      );
                    }

                    return;
                  }
                }
              }
            } catch (couchError) {
              console.error(
                "[ONBOARDING] Error checking CouchDB settings:",
                couchError
              );
              // Continue to show wizard if CouchDB check fails
            }
          }
        } catch (configError) {
          console.error(
            "[ONBOARDING] Error getting CouchDB config:",
            configError
          );
          // Continue to show wizard if config check fails
        }

        // No CouchDB or CouchDB also says onboarding not complete - show wizard
        console.log(
          "[ONBOARDING] Both local and CouchDB indicate onboarding not complete, showing wizard"
        );
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
        setOnboardingError(
          "Error checking onboarding status. Please try again."
        );
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [
    pathname,
    router,
    shop?.shopId,
    isAuthenticated,
    authLoading,
    currentUser,
  ]);

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
      value={{
        hasCompletedOnboarding,
        isLoading,
        completeOnboarding,
        onboardingError,
        requiresInternet,
      }}
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
