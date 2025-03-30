// src/types/next-pwa.d.ts
declare module "next-pwa" {
  import { NextConfig } from "next";

  interface PWAConfig {
    dest?: string;
    disable?: boolean;
    register?: boolean;
    skipWaiting?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    runtimeCaching?: any[]; // Define more specific type if needed
    // Add other next-pwa options if you use them
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }

  function withPWA(options: PWAConfig): (config: NextConfig) => NextConfig;

  export = withPWA;
}
