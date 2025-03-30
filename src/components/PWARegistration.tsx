"use client";

import { useEffect } from "react";
import { registerServiceWorkerManually } from "@/lib/pwaHelper";

export default function PWARegistration() {
  useEffect(() => {
    // Directly attempt to register the service worker on component mount
    // The registerServiceWorkerManually function handles checks for browser support and secure context
    registerServiceWorkerManually()
      .then((success) => {
        if (success) {
          console.log(
            "PWARegistration component: Service worker registration attempted successfully."
          );
        } else {
          console.log(
            "PWARegistration component: Service worker registration attempt failed or was not applicable."
          );
        }
      })
      .catch((error) => {
        console.error(
          "PWARegistration component: Error during service worker registration attempt:",
          error
        );
      });

    // Optional: Keep event listeners if needed for debugging or specific features
    const handleControllerChange = () => {
      console.log("Service worker controller changed");
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type) {
        console.log("Message from service worker:", event.data.type);
      }
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        handleControllerChange
      );
      navigator.serviceWorker.addEventListener("message", handleMessage);

      // Optional: Keep periodic update check if needed
      // const updateInterval = setInterval(() => { ... }, 3600000);

      return () => {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          handleControllerChange
        );
        navigator.serviceWorker.removeEventListener("message", handleMessage);
        // clearInterval(updateInterval);
      };
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  // This component doesn't render anything visible
  return null;
}
