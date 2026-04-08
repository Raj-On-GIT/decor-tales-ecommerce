"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addToCart as addToCartAPI, getCart } from "@/lib/api";
import {
  clearAuthSession,
  getSessionUser,
  refreshAccessToken,
} from "@/lib/auth";

const AuthContext = createContext({
  user: null,
  isAuthenticated: false,
  loading: true,
  login: () => {},
  logout: () => {},
});

function getCustomImageIdentity(item) {
  const images = item?.customImages ?? item?.custom_images ?? [];

  if (!Array.isArray(images) || images.length === 0) {
    return item?.custom_image ?? null;
  }

  return images
    .map((image) => {
      if (typeof image === "string") return image;
      return image?.name ?? image?.url ?? null;
    })
    .filter(Boolean)
    .join("|");
}

function getCartIdentity(item) {
  return [
    item?.id ?? item?.product_id ?? null,
    item?.variant?.id ?? null,
    item?.customText ?? item?.custom_text ?? null,
    getCustomImageIdentity(item),
  ].join("::");
}

function mergeCartMetadata(previousCart = [], nextCart = []) {
  const previousItemsByIdentity = new Map(
    previousCart.map((item) => [getCartIdentity(item), item]),
  );

  return nextCart.map((item) => {
    const previousItem = previousItemsByIdentity.get(getCartIdentity(item));

    if (!previousItem) {
      return item;
    }

    return {
      ...item,
      allow_custom_text:
        item?.allow_custom_text ?? previousItem?.allow_custom_text ?? false,
      allow_custom_image:
        item?.allow_custom_image ?? previousItem?.allow_custom_image ?? false,
    };
  });
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const rehydrateAuth = async () => {
    try {
      if (typeof window === "undefined") {
        setLoading(false);
        return;
      }

      const sessionUser = await getSessionUser({ tryRefresh: true });

      if (!sessionUser) {
        setUser(null);
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      setUser(sessionUser);
      setIsAuthenticated(true);
      window.dispatchEvent(new Event("user-login"));
      setLoading(false);
    } catch (error) {
      console.error("Error rehydrating auth:", error);
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    function handleForcedLogout() {
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
    }

    window.addEventListener("user-logout", handleForcedLogout);

    return () => {
      window.removeEventListener("user-logout", handleForcedLogout);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void rehydrateAuth();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    if (!isAuthenticated) {
      return undefined;
    }

    async function maintainSession() {
      const refreshed = await refreshAccessToken();

      if (!refreshed.ok) {
        if (refreshed.shouldLogout) {
          clearAuthSession();
          setUser(null);
          setIsAuthenticated(false);
        }
        return;
      }

      const sessionUser = await getSessionUser();
      if (!sessionUser) {
        return;
      }

      setUser(sessionUser);
      setIsAuthenticated(true);
    }

    function handleVisibilityOrFocus() {
      if (document.visibilityState === "visible") {
        void maintainSession();
      }
    }

    const intervalId = window.setInterval(() => {
      void maintainSession();
    }, 4 * 60 * 1000);

    window.addEventListener("focus", handleVisibilityOrFocus);
    window.addEventListener("online", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      window.removeEventListener("online", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [isAuthenticated]);

  const login = async (payload) => {
    try {
      if (!payload?.user?.id) {
        console.error("Invalid user payload provided to login()");
        return;
      }

      const guestCart =
        typeof window !== "undefined"
          ? JSON.parse(localStorage.getItem("cart") || "[]")
          : [];

      if (guestCart.length > 0) {
        for (const item of guestCart) {
          try {
            const productId = item.product_id || item.id;

            if (!productId) continue;

            const availableStock = item.variant?.stock ?? item.stock ?? 0;

            if (item.qty > availableStock) continue;

            await addToCartAPI(
              productId,
              item.qty,
              item.variant?.id || null,
              item.customText || null,
              item.customImages || item.custom_images || null,
            );
          } catch (err) {
            console.error("Guest cart merge failed:", err);
          }
        }
      }

      try {
        const data = await getCart();
        if (typeof window !== "undefined") {
          const mergedItems = mergeCartMetadata(guestCart, data.items || []);
          localStorage.setItem("cart", JSON.stringify(mergedItems));
        }
      } catch (error) {
        console.error("Failed to reload cart after merge", error);
      }

      setUser(payload.user);
      setIsAuthenticated(true);
      window.dispatchEvent(new Event("user-login"));
    } catch (error) {
      console.error("Error in login():", error);
    }
  };

  const logout = () => {
    try {
      clearAuthSession();
      setUser(null);
      setIsAuthenticated(false);
      router.push("/");
    } catch (error) {
      console.error("Error in logout():", error);
    }
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

export default AuthContext;
