"use client";

import React, { useEffect, useRef } from "react";
import { Text, Box, Stack, useMantineTheme, Transition } from "@mantine/core";
import {
  LottieAnimation,
  LottieInstance,
  LottieOptions,
  LottieAPI,
} from "@/types/lottie";

// Extend Window interface to include Lottie
declare global {
  interface Window {
    lottie?: LottieAPI;
  }
}

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  message?: string;
  showProgress?: boolean;
  fullScreen?: boolean;
  subText?: string;
  accentColor?: string;
  progress?: number;
  animationData?: LottieAnimation;
  animationPath?: string;
}

// Define size mappings as a type
interface SizeMapping {
  text: string;
  containerWidth: number;
  containerHeight: number;
  lottieSize: number;
}

// Define size map with proper typing
const sizeMap: Record<string, SizeMapping> = {
  sm: {
    text: "sm",
    containerWidth: 240,
    containerHeight: 180,
    lottieSize: 80,
  },
  md: {
    text: "md",
    containerWidth: 280,
    containerHeight: 200,
    lottieSize: 100,
  },
  lg: {
    text: "lg",
    containerWidth: 320,
    containerHeight: 220,
    lottieSize: 120,
  },
};

export default function LoadingSpinner({
  size = "md",
  message = "Loading...",
  fullScreen = true,
  subText,
  animationData,
  animationPath,
}: LoadingSpinnerProps) {
  const theme = useMantineTheme();
  const lottieContainerRef = useRef<HTMLDivElement>(null);
  const lottieInstanceRef = useRef<LottieInstance | null>(null);

  // Determine color to use
  const selectedSize = sizeMap[size] || sizeMap.md;

  useEffect(() => {
    // Function to load Lottie from CDN
    const loadLottieFromCDN = () => {
      // Check if lottie is already available in window
      if (typeof window !== "undefined" && window.lottie) {
        initLottieAnimation(window.lottie);
        return;
      }

      // Create script element to load lottie-web from CDN
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.10.2/lottie.min.js";
      script.async = true;

      script.onload = () => {
        // Once loaded, initialize the animation
        if (window.lottie) {
          initLottieAnimation(window.lottie);
        }
      };

      script.onerror = () => {
        console.error("Failed to load Lottie from CDN");
      };

      document.head.appendChild(script);
    };

    // Initialize Lottie animation
    const initLottieAnimation = (lottie: LottieAPI) => {
      if (!lottieContainerRef.current) return;

      // Destroy previous instance if it exists
      if (lottieInstanceRef.current) {
        lottieInstanceRef.current.destroy();
      }

      // Create new Lottie instance with properly typed options
      const options: LottieOptions = {
        container: lottieContainerRef.current,
        renderer: "svg",
        loop: true,
        autoplay: true,
      };

      // Add either animationData or path, but not both
      if (animationData) {
        options.animationData = animationData;
      } else if (animationPath) {
        options.path = animationPath;
      }

      lottieInstanceRef.current = lottie.loadAnimation(options);
    };

    // Load Lottie
    loadLottieFromCDN();

    // Cleanup function
    return () => {
      if (lottieInstanceRef.current) {
        lottieInstanceRef.current.destroy();
        lottieInstanceRef.current = null;
      }
    };
  }, [animationData, animationPath]);

  return (
    <Transition
      mounted={true}
      transition="fade"
      duration={400}
      timingFunction="ease"
    >
      {(styles) => (
        <Box
          style={{
            ...styles,
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
            backdropFilter: fullScreen ? "blur(8px)" : "none",
            WebkitBackdropFilter: fullScreen ? "blur(8px)" : "none",
            background: fullScreen ? `rgba(255, 255, 255, 0.2)` : "transparent",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            overflow: "hidden",
            pointerEvents: "auto",
          }}
        >
          <Stack
            align="center"
            gap={theme.spacing.lg}
            py={theme.spacing.xl}
            px={theme.spacing.lg}
            style={{
              width: selectedSize.containerWidth,
              height: selectedSize.containerHeight,
              borderRadius: theme.radius.lg,
              background: `rgba(48,14,95,255)`,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
              justifyContent: "center",
              border: `1px solid rgba(48,14,95,255)`,
              position: "relative",
            }}
          >
            {/* Lottie Animation Container */}
            <Box
              ref={lottieContainerRef}
              style={{
                width: selectedSize.lottieSize,
                height: selectedSize.lottieSize,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            />

            <Box>
              <Text
                size={selectedSize.text}
                fw={500}
                ta="center"
                c="dark"
                mb={subText ? theme.spacing.xs : 0}
              >
                {message}
              </Text>

              {subText && (
                <Text size="xs" c="dimmed" ta="center">
                  {subText}
                </Text>
              )}
            </Box>
          </Stack>
        </Box>
      )}
    </Transition>
  );
}
