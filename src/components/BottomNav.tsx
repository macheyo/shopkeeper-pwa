"use client";

import React, { useEffect, useState } from "react";
import { Group, Text } from "@mantine/core";
import {
  IconHome,
  IconShoppingCart,
  IconSend,
  IconShoppingBag,
  IconRefresh,
} from "@tabler/icons-react";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [scrollTimeout, setScrollTimeout] = useState<NodeJS.Timeout | null>(
    null
  );

  const navItems = [
    {
      icon: IconHome,
      label: "Home",
      path: "/",
      color: "blue",
      animation: "icon-bounce",
    },
    {
      icon: IconShoppingCart,
      label: "Sales",
      path: "/sales",
      color: "blue",
      animation: "icon-wiggle",
    },
    {
      icon: IconShoppingBag,
      label: "Purchases",
      path: "/purchases",
      color: "teal",
      animation: "icon-bounce",
    },
    {
      icon: IconSend,
      label: "Reports",
      path: "/reports",
      color: "violet",
      animation: "icon-spin",
    },
    {
      icon: IconRefresh,
      label: "Sync",
      path: "/sync",
      color: "cyan",
      animation: "icon-bounce",
    },
  ];

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(path);
  };

  // Handle scroll behavior
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Always show navbar at the top of the page
      if (currentScrollY <= 10) {
        setVisible(true);
        return;
      }

      // Hide navbar only when scrolling down
      if (currentScrollY > lastScrollY) {
        setVisible(false);
      }

      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // Set new timeout to show navbar after scrolling stops
      const timeout = setTimeout(() => {
        setVisible(true);
      }, 1000); // Show navbar 1 second after scrolling stops

      setScrollTimeout(timeout);
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [lastScrollY, scrollTimeout]);

  return (
    <Group
      justify="space-around"
      style={{
        position: "fixed",
        bottom: visible ? 0 : -60, // Hide below the viewport when not visible
        left: 0,
        right: 0,
        background: "var(--mantine-color-body)",
        borderTop: "1px solid var(--mantine-color-default-border)",
        padding: "8px 0",
        zIndex: 1000,
        transition: "bottom 0.3s ease, transform 0.2s ease",
        boxShadow: "var(--mantine-shadow-sm)",
        transform: visible ? "translateY(0)" : "translateY(60px)",
      }}
      hiddenFrom="sm"
    >
      {navItems.map((item) => (
        <a
          key={item.path}
          href={item.path}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            opacity: isActive(item.path) ? 1 : 0.7,
            textDecoration: "none",
            transition: "all 0.2s ease",
          }}
          onTouchStart={(e) => {
            e.currentTarget.style.transform = "scale(0.95)";
          }}
          onTouchEnd={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <item.icon
            size={24}
            color={
              isActive(item.path)
                ? `var(--mantine-color-${item.color}-7)`
                : "var(--mantine-color-gray-7)"
            }
            stroke={1.5}
            style={{
              transition: "transform 0.2s ease",
              transform: isActive(item.path) ? "translateY(-2px)" : "none",
            }}
            className={`tabler-icon ${
              isActive(item.path) ? item.animation : ""
            }`}
          />
          <Text
            size="xs"
            mt={4}
            fw={isActive(item.path) ? 700 : 500}
            c={isActive(item.path) ? `${item.color}.7` : "gray.7"}
            style={{
              transition: "all 0.2s ease",
            }}
          >
            {item.label}
          </Text>
        </a>
      ))}
    </Group>
  );
}
