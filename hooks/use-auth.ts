import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

type UseAuthOptions = {
  autoFetch?: boolean;
};

export function useAuth(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = useCallback(async () => {
    console.log("[useAuth] fetchUser called");
    try {
      setLoading(true);
      setError(null);

      console.log("[useAuth] checking for session token...");
      const sessionToken = await Auth.getSessionToken();
      if (!sessionToken) {
        console.log("[useAuth] No session token, setting user to null");
        setUser(null);
        await Auth.clearUserInfo();
        return;
      }

      // Try cached user info first
      const cachedUser = await Auth.getUserInfo();
      if (cachedUser) {
        setUser(cachedUser);
      }

      try {
        const apiUser = await Api.getMe();
        if (apiUser) {
          const userInfo: Auth.User = {
            id: apiUser.id,
            name: apiUser.name,
            email: apiUser.email,
            phoneNumber: apiUser.phoneNumber ?? null,
            phoneVerified: apiUser.phoneVerified ?? false,
            campusId: apiUser.campusId ?? null,
            role: (apiUser.role as any) ?? "user",
            createdAt: apiUser.createdAt,
          };
          setUser(userInfo);
          await Auth.setUserInfo(userInfo);
          console.log("[useAuth] User updated from API");
        } else if (!cachedUser) {
          setUser(null);
          await Auth.clearUserInfo();
        }
      } catch {
        if (!cachedUser) {
          setUser(null);
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch user");
      console.error("[useAuth] fetchUser error");
      setError(error);
      setUser(null);
    } finally {
      setLoading(false);
      console.log("[useAuth] fetchUser completed, loading:", false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await Api.logout();
    } catch {
      console.error("[Auth] Logout API call failed");
      // Continue with logout even if API call fails
    } finally {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      setUser(null);
      setError(null);
    }
  }, []);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    console.log("[useAuth] useEffect triggered");
    if (autoFetch) {
      Auth.getUserInfo().then((cachedUser) => {
        if (cachedUser) {
          setUser(cachedUser);
          setLoading(false);
        }
        void fetchUser();
      });
    } else {
      console.log("[useAuth] autoFetch disabled, setting loading to false");
      setLoading(false);
    }
  }, [autoFetch, fetchUser]);

  return {
    user,
    loading,
    error,
    isAuthenticated,
    refresh: fetchUser,
    logout,
  };
}
