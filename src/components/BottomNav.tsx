"use client";

import React, { useEffect, useState } from "react";
import { Group, Text } from "@mantine/core";
import {
  IconHome,
  IconPackage,
  IconShoppingCart,
  IconSend,
} from "@tabler/icons-react";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const navItems = [
    {
      icon: IconHome,
      label: "Home",
      path: "/",
      color: "blue",
      animation: "icon-bounce",
    },
    {
      icon: IconPackage,
      label: "Products",
      path: "/products",
      color: "green",
      animation: "icon-pulse",
    },
    {
      icon: IconShoppingCart,
      label: "Sales",
      path: "/sales",
      color: "blue",
      animation: "icon-wiggle",
    },
    {
      icon: IconSend,
      label: "Reports",
      path: "/reports",
      color: "violet",
      animation: "icon-spin",
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
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      // Check if we're at the bottom of the page
      const isAtBottom = currentScrollY + windowHeight >= documentHeight - 10;

      if (isAtBottom) {
        // Hide navbar when at the bottom of the page
        setVisible(false);
      }
      // Show navbar when scrolling up or at the top
      else if (currentScrollY <= 10 || currentScrollY < lastScrollY) {
        setVisible(true);
      }
      // Hide navbar when scrolling down and not at the top
      else if (currentScrollY > lastScrollY && currentScrollY > 10) {
        setVisible(false);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

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
        transform: visible ? "translateY(0)" : "translateY(100%)",
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
