"use client";

// This file provides helper functions for PWA functionality

// Helper to safely check if we're in a browser environment
const isBrowser = typeof window !== "undefined";

/**
 * Register the service worker manually
 */
export async function registerServiceWorkerManually(): Promise<boolean> {
  if (!isBrowser || !("serviceWorker" in navigator)) {
    console.log("Service worker not supported in this environment");
    return false;
  }

  try {
    // First check if we're in a secure context (needed for service workers)
    if (!window.isSecureContext) {
      console.warn("Service Worker registration failed - not a secure context");
      return false;
    }

    // Register our custom service worker
    const registration = await navigator.serviceWorker.register(
      "/sw-custom.js",
      {
        scope: "/",
        updateViaCache: "none", // Don't use cached versions
        type: "classic", // Explicitly set the type
      }
    );

    console.log("Service worker registered successfully:", registration.scope);

    // Force update
    await registration.update();

    return true;
  } catch (error) {
    console.error("Service worker registration failed:", error);
    // Log more detailed error information
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return false;
  }
}

/**
 * Check if service worker is registered
 */
export async function isServiceWorkerRegistered(): Promise<boolean> {
  if (!isBrowser || !("serviceWorker" in navigator)) {
    return false;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    return registrations.length > 0;
  } catch (error) {
    console.error("Error checking service worker registration:", error);
    return false;
  }
}

/**
 * Unregister all service workers
 */
export async function unregisterAllServiceWorkers(): Promise<void> {
  if (!isBrowser || !("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
      console.log("Service worker unregistered:", registration.scope);
    }
  } catch (error) {
    console.error("Error unregistering service workers:", error);
  }
}
