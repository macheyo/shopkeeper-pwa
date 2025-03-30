"use client";

import { useState, useEffect } from "react";
import { Button, Transition } from "@mantine/core";

// Check if the app is already installed as a PWA
const isAppInstalled = () => {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    // For iOS Safari
    (window.navigator as { standalone?: boolean }).standalone === true
  );
};

interface CollapsibleFabProps {
  icon: React.ReactNode;
  text: string;
  onClick: () => void;
  color?: string;
}

export default function CollapsibleFab({
  icon,
  text,
  onClick,
  color = "blue",
}: CollapsibleFabProps) {
  const [installed, setInstalled] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [buttonHovered, setButtonHovered] = useState(false);

  // Check if app is installed on mount
  useEffect(() => {
    setInstalled(isAppInstalled());
  }, []);

  // Handle scroll behavior for the FAB
  useEffect(() => {
    if (!installed) return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      // Check if we're at the bottom of the page
      const isAtBottom = currentScrollY + windowHeight >= documentHeight - 10;

      if (isAtBottom) {
        // Hide button when at the bottom of the page
        setVisible(false);
      }
      // Show button when scrolling up or at the top
      else if (currentScrollY <= 10 || currentScrollY < lastScrollY) {
        setVisible(true);
        setExpanded(true);
      }
      // Collapse button when scrolling down and not at the top
      else if (currentScrollY > lastScrollY && currentScrollY > 10) {
        setExpanded(false);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY, installed]);

  // If not installed, render a regular button
  if (!installed) {
    return (
      <Button leftSection={icon} onClick={onClick} color={color}>
        {text}
      </Button>
    );
  }

  // If installed, render a collapsible FAB
  return (
    <div
      style={{
        position: "fixed",
        bottom: visible ? "70px" : "-100px", // Hide below viewport when not visible
        right: "20px",
        zIndex: 1001, // Higher than the navbar's z-index
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.3s ease",
        opacity: visible ? 1 : 0,
        transform: buttonHovered ? "scale(1.05)" : "scale(1)",
      }}
    >
      <Button
        onClick={onClick}
        color={color}
        radius="xl"
        style={{
          transition: "all 0.3s ease",
          minWidth: expanded ? "auto" : "40px",
          width: expanded ? "auto" : "40px",
          padding: expanded ? "8px 16px" : "8px",
          overflow: "hidden",
          boxShadow: buttonHovered
            ? "0 6px 16px rgba(0, 0, 0, 0.15)"
            : "0 4px 12px rgba(0, 0, 0, 0.1)",
        }}
        onMouseEnter={() => setButtonHovered(true)}
        onMouseLeave={() => setButtonHovered(false)}
      >
        {icon}
        <Transition
          mounted={expanded}
          transition={{
            in: { opacity: 1, width: "auto", marginLeft: 8 },
            out: { opacity: 0, width: 0, marginLeft: 0 },
            transitionProperty: "opacity, width, margin",
          }}
          duration={200}
          timingFunction="ease"
        >
          {(styles) => <span style={styles}>{text}</span>}
        </Transition>
      </Button>
    </div>
  );
}
