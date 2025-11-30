"use client";

/**
 * Device Fingerprinting
 * Generates a unique identifier for the device/browser
 * Used to tie licenses to specific devices
 */

/**
 * Get device fingerprint
 * Combines various browser/device properties to create a unique identifier
 */
export async function getDeviceFingerprint(): Promise<string> {
  const components: string[] = [];

  // User Agent
  if (typeof navigator !== "undefined" && navigator.userAgent) {
    components.push(navigator.userAgent);
  }

  // Language
  if (typeof navigator !== "undefined" && navigator.language) {
    components.push(navigator.language);
  }

  // Screen properties
  if (typeof screen !== "undefined") {
    components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
  }

  // Timezone
  if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      components.push(timezone);
    } catch {
      // Ignore timezone errors
    }
  }

  // Hardware concurrency
  if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
    components.push(navigator.hardwareConcurrency.toString());
  }

  // Device memory (if available)
  if (
    typeof navigator !== "undefined" &&
    "deviceMemory" in navigator &&
    (navigator as { deviceMemory?: number }).deviceMemory
  ) {
    components.push(
      (navigator as { deviceMemory?: number }).deviceMemory?.toString() || ""
    );
  }

  // Canvas fingerprint (if available)
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px 'Arial'";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#f60";
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = "#069";
      ctx.fillText("Device fingerprint", 2, 15);
      ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
      ctx.fillText("Device fingerprint", 4, 17);
      const canvasFingerprint = canvas.toDataURL();
      components.push(canvasFingerprint.substring(0, 100)); // First 100 chars
    }
  } catch {
    // Canvas fingerprinting not available
  }

  // WebGL fingerprint (if available)
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (gl) {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info") as {
        UNMASKED_VENDOR_WEBGL: number;
        UNMASKED_RENDERER_WEBGL: number;
      } | null;
      if (debugInfo) {
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        components.push(vendor || "");
        components.push(renderer || "");
      }
    }
  } catch {
    // WebGL fingerprinting not available
  }

  // Combine all components
  const combined = components.join("|");

  // Hash the combined string
  const encoder = new TextEncoder();
  const data = encoder.encode(combined);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hashHex;
}

/**
 * Get a stable device ID (stored in localStorage for persistence)
 * Falls back to generating a new fingerprint if not found
 */
export async function getStableDeviceId(): Promise<string> {
  if (typeof window === "undefined") {
    // Server-side: generate a temporary ID
    return "server-device-id";
  }

  const STORAGE_KEY = "shopkeeper_device_id";

  // Try to get existing device ID
  const existingId = localStorage.getItem(STORAGE_KEY);
  if (existingId) {
    return existingId;
  }

  // Generate new device ID
  const fingerprint = await getDeviceFingerprint();
  const deviceId = `device_${fingerprint.substring(0, 32)}`;

  // Store for future use
  try {
    localStorage.setItem(STORAGE_KEY, deviceId);
  } catch {
    // localStorage might not be available
  }

  return deviceId;
}
