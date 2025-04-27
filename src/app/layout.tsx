import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MantineProvider } from "@mantine/core";
import PWARegistration from "@/components/PWARegistration";
import ShopkeeperAppShell from "@/components/AppShell";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import PWADebug from "@/components/PWADebug";
import ClientOnly from "@/components/ClientOnly";
import { DateFilterProvider } from "@/contexts/DateFilterContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import "@mantine/core/styles.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ShopKeeper PWA",
  description: "Offline-first shop management app",
  manifest: "/manifest.json", // Link to the manifest file
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ShopKeeper",
  },
  formatDetection: {
    telephone: false,
  },
  applicationName: "ShopKeeper PWA",
  referrer: "origin-when-cross-origin",
  keywords: ["shop", "inventory", "sales", "offline", "pwa"],
  authors: [{ name: "ShopKeeper Team" }],
  creator: "ShopKeeper Team",
  publisher: "ShopKeeper",
};

// Add viewport settings for PWA
export const viewport: Viewport = {
  themeColor: "#007bff", // Match theme_color in manifest
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  minimumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Apple specific tags */}
        <link rel="apple-touch-icon" href="/icons/ios/180.png" />
        <link
          rel="apple-touch-icon"
          sizes="152x152"
          href="/icons/ios/152.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/icons/ios/180.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="167x167"
          href="/icons/ios/167.png"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ShopKeeper" />

        {/* Microsoft specific tags */}
        <meta name="msapplication-TileColor" content="#007bff" />
        <meta name="msapplication-tap-highlight" content="no" />

        {/* Safari specific tags */}
        <meta name="theme-color" content="#007bff" />

        {/* Add other head elements like favicons here */}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClientOnly>
          <MantineProvider defaultColorScheme="auto">
            <OnboardingProvider>
              <DateFilterProvider>
                <ShopkeeperAppShell>{children}</ShopkeeperAppShell>
                <PWAInstallPrompt
                  debug={false}
                  title="Install ShopKeeper"
                  description="Install this app on your device for offline access and faster performance!"
                />
                <PWARegistration />
                {process.env.NODE_ENV === "development" && <PWADebug />}
              </DateFilterProvider>
            </OnboardingProvider>
          </MantineProvider>
        </ClientOnly>
      </body>
    </html>
  );
}
