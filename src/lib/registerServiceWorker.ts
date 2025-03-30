"use client";

export function registerServiceWorker() {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    // Use a more immediate approach to register the service worker
    // rather than waiting for the load event
    if (document.readyState === "complete") {
      registerSW();
    } else {
      window.addEventListener("load", registerSW);
    }
  }
}

function registerSW() {
  // First check if we're in a secure context (needed for service workers)
  if (!window.isSecureContext) {
    console.warn("Service Worker registration failed - not a secure context");
    // In development, we can bypass this check
    if (process.env.NODE_ENV === "development") {
      console.log(
        "Development environment detected, attempting registration anyway"
      );
    } else {
      return;
    }
  }

  // Check if service worker is already registered
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      // Only register if no service worker exists
      if (registrations.length === 0) {
        // Register the service worker
        navigator.serviceWorker
          .register("/sw.js", {
            scope: "/",
            updateViaCache: "none",
            type: "classic", // Explicitly set the type
          })
          .then((registration) => {
            console.log(
              "ServiceWorker registration successful with scope:",
              registration.scope
            );

            // Check for updates immediately
            registration.update();

            // Set up periodic updates
            setInterval(() => {
              registration.update();
              console.log("Checking for service worker updates");
            }, 60 * 60 * 1000); // Check every hour
          })
          .catch((err) => {
            console.error("ServiceWorker registration failed: ", err);
            // Log more detailed error information
            if (err instanceof Error) {
              console.error("Error name:", err.name);
              console.error("Error message:", err.message);
              console.error("Error stack:", err.stack);
            }
          });
      } else {
        console.log(
          "ServiceWorker already registered, using existing registration"
        );

        // Set up periodic updates for existing registration
        const registration = registrations[0];
        registration.update();

        setInterval(() => {
          registration.update();
          console.log("Checking for service worker updates");
        }, 60 * 60 * 1000); // Check every hour
      }
    })
    .catch((error) => {
      console.error("Error checking service worker registrations:", error);
    });
}
