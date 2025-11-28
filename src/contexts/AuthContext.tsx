"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { UserDoc, ShopDoc } from "@/types";
import {
  getSession,
  createSession,
  clearSession,
  generateUserId,
  generateShopId,
} from "@/lib/auth";
import {
  getUserById,
  createUser,
  createShop,
  getShopById,
} from "@/lib/usersDB";
import { getShopSettings, saveShopSettings } from "@/lib/settingsDB";

interface AuthContextType {
  currentUser: UserDoc | null;
  shop: ShopDoc | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithLicense: (licenseKey: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (
    phoneNumber: string,
    name: string,
    shopName: string
  ) => Promise<{ licenseKey?: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  shop: null,
  isAuthenticated: false,
  isLoading: true,
  loginWithLicense: async () => {},
  logout: async () => {},
  register: async () => ({}),
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserDoc | null>(null);
  const [shop, setShop] = useState<ShopDoc | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = getSession();
        if (session) {
          const user = await getUserById(session.userId);
          if (user && user.status === "active") {
            setCurrentUser(user);

            // Load shop
            const shopData = await getShopById(session.shopId);
            if (shopData) {
              setShop(shopData);
            }
          } else {
            clearSession();
          }
        }
      } catch (error) {
        console.error("Error checking session:", error);
        clearSession();
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  const loginWithLicense = useCallback(
    async (licenseKey: string) => {
      try {
        const { validateLicenseKey } = await import("@/lib/licenseKey");
        const validation = await validateLicenseKey(licenseKey);

        if (!validation.valid || !validation.data) {
          throw new Error(validation.error || "Invalid license key");
        }

        const licenseData = validation.data;

        // Get or create user from license data
        let user: UserDoc;
        try {
          const { getUserByPhoneNumber, createUser } = await import(
            "@/lib/usersDB"
          );
          // Use phoneNumber from license, fallback to email for backwards compatibility
          const phoneNumber =
            licenseData.phoneNumber || licenseData.email || "";
          let existingUser = phoneNumber
            ? await getUserByPhoneNumber(phoneNumber)
            : null;

          if (existingUser) {
            user = existingUser;
            // Update user role if it's in the license
            if (licenseData.role && user.role !== licenseData.role) {
              const { updateUser } = await import("@/lib/usersDB");
              user.role = licenseData.role;
              await updateUser(user);
            }
          } else {
            // Create user from license data
            // Use userId from license if available, otherwise generate one
            const userId = licenseData.userId;
            if (!userId) {
              throw new Error("License key must contain userId");
            }

            if (!phoneNumber) {
              throw new Error("License key must contain phoneNumber or email");
            }

            user = await createUser({
              userId,
              phoneNumber: phoneNumber.replace(/[\s\-\(\)]/g, ""), // Normalize phone number
              email: licenseData.email, // Optional, for backwards compatibility
              name: licenseData.ownerName,
              role: licenseData.role || "owner",
              shopId: licenseData.shopId,
              status: "active",
            });
          }
        } catch (err) {
          console.error("Error getting/creating user:", err);
          throw new Error("Failed to get user information");
        }

        // Get or create shop from license data
        let shopData: ShopDoc;
        try {
          const { getShopById, createShop } = await import("@/lib/usersDB");
          shopData = await getShopById(licenseData.shopId);

          if (!shopData) {
            // Create shop from license data
            shopData = await createShop({
              shopId: licenseData.shopId,
              shopName: licenseData.shopName,
              ownerId: user.userId,
              businessType: "retail",
              baseCurrency: "USD",
              currencies: [{ code: "USD", exchangeRate: 1 }],
            });
          }
        } catch (err) {
          console.error("Error getting/creating shop:", err);
          throw new Error("Failed to get shop information");
        }

        // Create session with license key
        createSession(user, licenseKey);
        setCurrentUser(user);
        setShop(shopData);

        router.push("/");
      } catch (error) {
        console.error("License login error:", error);
        throw error;
      }
    },
    [router]
  );

  const logout = useCallback(async () => {
    clearSession();
    setCurrentUser(null);
    setShop(null);
    router.push("/login");
  }, [router]);

  const register = useCallback(
    async (
      phoneNumber: string,
      name: string,
      shopName: string
    ): Promise<{ licenseKey?: string }> => {
      try {
        // Check if user already exists
        const { getUserByPhoneNumber } = await import("@/lib/usersDB");
        // Normalize phone number
        const normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, "");
        const existingUser = await getUserByPhoneNumber(normalizedPhone);
        if (existingUser) {
          throw new Error("User with this phone number already exists");
        }

        // Generate IDs
        const userId = generateUserId();
        const shopId = generateShopId();

        // Create shop
        const shopData = await createShop({
          shopId,
          shopName,
          ownerId: userId,
          businessType: "retail", // Default, can be updated later
          baseCurrency: "USD", // Default, can be updated during onboarding
          currencies: [{ code: "USD", exchangeRate: 1 }],
        });

        // Create user (owner)
        const user = await createUser({
          userId,
          phoneNumber: normalizedPhone,
          name,
          role: "owner",
          shopId,
          status: "active",
        });

        // Generate trial license (14 days, owner role, tied to device)
        // License will be shown to user in modal - they must save it
        // We'll store it in localStorage after user confirms they saved it
        let licenseKey: string | undefined;
        try {
          const { generateTrialLicense } = await import("@/lib/licenseKey");
          const licenseResult = await generateTrialLicense(
            normalizedPhone,
            shopId,
            shopName,
            name,
            userId
          );
          licenseKey = licenseResult.licenseKey;
          console.log(
            "License generated successfully:",
            licenseKey?.substring(0, 20) + "..."
          );
        } catch (err) {
          console.error("Failed to generate trial license:", err);
          // Continue anyway - registration succeeds even if license generation fails
        }

        // Migrate existing settings if any
        try {
          const existingSettings = await getShopSettings(shopId);
          if (existingSettings) {
            await saveShopSettings({
              ...existingSettings,
              shopId,
            });
          }
        } catch (err) {
          console.error("Error migrating settings:", err);
          // Continue anyway
        }

        // Return license key
        // Don't create session yet - let the registration page handle it after license confirmation
        return { licenseKey };
      } catch (error) {
        console.error("Registration error:", error);
        throw error;
      }
    },
    [router]
  );

  const refreshUser = useCallback(async () => {
    try {
      const session = getSession();
      if (session) {
        const user = await getUserById(session.userId);
        if (user && user.status === "active") {
          setCurrentUser(user);

          // Load shop
          const shopData = await getShopById(session.shopId);
          if (shopData) {
            setShop(shopData);
          }
        } else {
          clearSession();
          setCurrentUser(null);
          setShop(null);
        }
      } else {
        // No session, clear state
        setCurrentUser(null);
        setShop(null);
      }
    } catch (error) {
      console.error("Error refreshing user:", error);
    }
  }, []);

  const value: AuthContextType = {
    currentUser,
    shop,
    isAuthenticated: !!currentUser,
    isLoading,
    loginWithLicense,
    logout,
    register,
    refreshUser,
  };

  // Don't block rendering - let ProtectedRoute handle loading states
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
