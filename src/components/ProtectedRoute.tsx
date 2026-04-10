/**
 * ProtectedRoute — wraps app routes that require authentication.
 *
 * Auth guard (Phase 1.2):
 *   Not authenticated → redirect to /api/login.
 *
 * Restaurant guard (Phase 1.3):
 *   Authenticated but no restaurant in DB → redirect to /setup.
 *
 * Spinner blocks only on auth + restaurant. All other data (menu, billing)
 * loads in the background via TanStack Query in each individual page.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useRestaurant } from "@/hooks/use-restaurant";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const { isLoading: isRestaurantLoading, isNotFound } = useRestaurant(isAuthenticated);

  // Redirect unauthenticated users to Replit login
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      window.location.href = "/api/login";
    }
  }, [isAuthLoading, isAuthenticated]);

  // New user with no restaurant yet → send to onboarding
  useEffect(() => {
    if (isAuthenticated && !isRestaurantLoading && isNotFound) {
      navigate("/setup", { replace: true });
    }
  }, [isAuthenticated, isRestaurantLoading, isNotFound, navigate]);

  // Show spinner while auth or restaurant are resolving
  const isLoading = isAuthLoading || (isAuthenticated && isRestaurantLoading);
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (isNotFound) return null;

  return <>{children}</>;
}
