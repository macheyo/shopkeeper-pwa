"use client";

import { useEffect, useState, ReactNode } from "react";

interface ClientOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * ClientOnly component ensures that children are only rendered on the client side,
 * preventing hydration mismatches between server and client rendering.
 *
 * @param children The components to render only on the client side
 * @param fallback Optional content to show during server-side rendering
 */
export default function ClientOnly({
  children,
  fallback = null,
}: ClientOnlyProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Add Mantine color scheme script manually to avoid hydration issues
    const head = document.head;
    const colorSchemeScript = document.createElement("script");

    // Create the script content that Mantine would normally inject
    colorSchemeScript.innerHTML = `
      try {
        var m = localStorage.getItem('mantine-color-scheme-value');
        if (m === 'dark' || m === 'light' || m === 'auto') {
          document.documentElement.setAttribute('data-mantine-color-scheme', m);
        }
      } catch (e) {}
    `;

    head.appendChild(colorSchemeScript);
    setIsMounted(true);

    return () => {
      // Clean up when component unmounts
      if (colorSchemeScript && colorSchemeScript.parentNode) {
        colorSchemeScript.parentNode.removeChild(colorSchemeScript);
      }
    };
  }, []);

  if (!isMounted) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
