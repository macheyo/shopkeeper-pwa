"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import LoadingSpinner from "./LoadingSpinner";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
  allowedRoles?: Array<"owner" | "manager" | "employee">;
}

export default function ProtectedRoute({
  children,
  requireAuth = true,
  allowedRoles,
}: ProtectedRouteProps) {
  const { isAuthenticated, currentUser, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const redirectTargetRef = useRef<string | null>(null);

  // Public routes that don't require authentication
  const publicRoutes = ["/login", "/register"];
  const isPublicRoute = useMemo(
    () => publicRoutes.includes(pathname) || pathname.startsWith("/invite/"),
    [pathname, publicRoutes]
  );

  // Handle redirects in useEffect
  useEffect(() => {
    // Don't do anything while loading
    if (isLoading) return;

    // If we're already on the target route we were redirecting to, clear it
    if (redirectTargetRef.current === pathname) {
      redirectTargetRef.current = null;
      return;
    }

    // If we're already redirecting to a different route, don't redirect again
    if (redirectTargetRef.current && redirectTargetRef.current !== pathname) {
      return;
    }

    // If route is public and user is authenticated, redirect to home
    if (isPublicRoute && isAuthenticated && pathname !== "/") {
      redirectTargetRef.current = "/";
      router.replace("/");
      return;
    }

    // If route is public and user is not authenticated, allow access
    if (isPublicRoute && !isAuthenticated) {
      redirectTargetRef.current = null;
      return;
    }

    // If authentication is required but user is not authenticated, redirect to login
    if (requireAuth && !isAuthenticated && pathname !== "/login") {
      redirectTargetRef.current = "/login";
      router.replace("/login");
      return;
    }

    // If user is authenticated but role is not allowed, redirect to home
    if (
      requireAuth &&
      isAuthenticated &&
      currentUser &&
      allowedRoles &&
      !allowedRoles.includes(currentUser.role) &&
      pathname !== "/"
    ) {
      redirectTargetRef.current = "/";
      router.replace("/");
      return;
    }

    // Clear redirect target if all checks pass
    redirectTargetRef.current = null;
  }, [
    isLoading,
    isAuthenticated,
    currentUser,
    requireAuth,
    allowedRoles,
    pathname,
    isPublicRoute,
    router,
  ]);

  // Show loading while checking authentication
  if (isLoading) {
    return <LoadingSpinner size="md" message="Loading..." />;
  }

  // If route is public and user is authenticated, show loading while redirecting
  if (isPublicRoute && isAuthenticated) {
    return <LoadingSpinner size="md" message="Redirecting..." />;
  }

  // If route is public and user is not authenticated, render children
  if (isPublicRoute && !isAuthenticated) {
    return <>{children}</>;
  }

  // If authentication is required but user is not authenticated, show loading while redirecting
  if (requireAuth && !isAuthenticated) {
    return <LoadingSpinner size="md" message="Redirecting to login..." />;
  }

  // If role check fails, show loading while redirecting
  if (
    requireAuth &&
    currentUser &&
    allowedRoles &&
    !allowedRoles.includes(currentUser.role)
  ) {
    return <LoadingSpinner size="md" message="Access denied. Redirecting..." />;
  }

  return <>{children}</>;
}
