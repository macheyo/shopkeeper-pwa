// This script is used to register the service worker

// Check if service workers are supported
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    // Register the service worker
    navigator.serviceWorker
      .register("/sw.js")
      .then(function (registration) {
        // Registration was successful
        console.log(
          "ServiceWorker registration successful with scope: ",
          registration.scope
        );

        // Check if there's an update available
        registration.onupdatefound = function () {
          const installingWorker = registration.installing;
          installingWorker.onstatechange = function () {
            if (installingWorker.state === "installed") {
              if (navigator.serviceWorker.controller) {
                // At this point, the old content will have been purged and the fresh content will
                // have been added to the cache.
                console.log("New content is available; please refresh.");
              } else {
                // At this point, everything has been precached.
                console.log("Content is cached for offline use.");
              }
            }
          };
        };
      })
      .catch(function (error) {
        // Registration failed
        console.error("ServiceWorker registration failed: ", error);
      });
  });
}
