"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getWishlist, toggleWishlist as toggleWishlistAPI } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useGlobalToast } from "@/context/ToastContext";

const WishlistContext = createContext(null);
const WISHLIST_STORAGE_KEY = "wishlist";

function readStoredGuestWishlist() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const savedWishlist = localStorage.getItem(WISHLIST_STORAGE_KEY);
    return savedWishlist ? JSON.parse(savedWishlist) : [];
  } catch (error) {
    console.error("Failed to read guest wishlist from storage:", error);
    return [];
  }
}

function writeStoredGuestWishlist(items) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error("Failed to persist guest wishlist:", error);
  }
}

function clearStoredGuestWishlist() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(WISHLIST_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear guest wishlist:", error);
  }
}

function getProductId(item) {
  return item?.product?.id ?? item?.id ?? item?.product_id ?? null;
}

function buildGuestSnapshot(product) {
  return {
    id: product?.id ?? product?.product_id ?? null,
    title: product?.title || "",
    slug: product?.slug || null,
    image: product?.image || null,
    category: product?.category || null,
    mrp: product?.mrp ?? null,
    slashed_price: product?.slashed_price ?? null,
    discount_percent: product?.discount_percent ?? null,
    stock: product?.stock ?? null,
    stock_type: product?.stock_type ?? "main",
    allow_custom_image: Boolean(product?.allow_custom_image),
    allow_custom_text: Boolean(product?.allow_custom_text),
    custom_image_limit: product?.custom_image_limit ?? 1,
    variants: product?.variants || [],
  };
}

function buildGuestItem(product) {
  return {
    product: buildGuestSnapshot(product),
    created_at: new Date().toISOString(),
  };
}

export function WishlistProvider({ children }) {
  const { error } = useGlobalToast();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [wishlist, setWishlist] = useState([]);
  const [wishlistReady, setWishlistReady] = useState(false);
  const [pendingWishlistActions, setPendingWishlistActions] = useState({});

  const wishlistRef = useRef(wishlist);
  wishlistRef.current = wishlist;

  const inFlightRef = useRef(new Set());

  const setPendingAction = useCallback((key, action) => {
    if (!key) return;
    setPendingWishlistActions((prev) => ({ ...prev, [key]: action }));
  }, []);

  const clearPendingAction = useCallback((key) => {
    if (!key) return;
    setPendingWishlistActions((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setWishlist(readStoredGuestWishlist());
      setWishlistReady(true);
      return;
    }

    let cancelled = false;
    setWishlistReady(false);

    async function loadServerWishlist() {
      try {
        const data = await getWishlist();
        if (cancelled) return;
        setWishlist(data.items || []);
        clearStoredGuestWishlist();
      } catch (err) {
        console.error("Failed to load server wishlist:", err);
        if (!cancelled) setWishlist([]);
      } finally {
        if (!cancelled) setWishlistReady(true);
      }
    }

    loadServerWishlist();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated]);

  const toggleWishlist = useCallback(
    async (product) => {
      const productId = getProductId(product);
      if (productId == null) {
        return { ok: false, error: "Invalid product." };
      }

      const previousWishlist = wishlistRef.current;
      const inWishlist = previousWishlist.some(
        (item) => getProductId(item) === productId,
      );

      if (inFlightRef.current.has(productId)) {
        return { ok: true, inWishlist };
      }

      inFlightRef.current.add(productId);
      setPendingAction(productId, "toggle");

      const nextWishlist = inWishlist
        ? previousWishlist.filter((item) => getProductId(item) !== productId)
        : [buildGuestItem(product), ...previousWishlist];

      setWishlist(nextWishlist);
      if (!isAuthenticated) {
        writeStoredGuestWishlist(nextWishlist);
      }

      try {
        if (!isAuthenticated) {
          return { ok: true, inWishlist: !inWishlist };
        }

        const result = await toggleWishlistAPI(productId);

        if (result.in_wishlist) {
          const item = buildGuestItem(product);
          item.wishlist_item_id = result.wishlist_item_id;
          setWishlist((prev) => [
            item,
            ...prev.filter((item) => getProductId(item) !== productId),
          ]);
        }

        return { ok: true, inWishlist: result.in_wishlist };
      } catch (err) {
        setWishlist(previousWishlist);
        if (!isAuthenticated) {
          writeStoredGuestWishlist(previousWishlist);
        }
        error(err.message || "Unable to update wishlist");
        return { ok: false, error: err };
      } finally {
        inFlightRef.current.delete(productId);
        clearPendingAction(productId);
      }
    },
    [error, clearPendingAction, isAuthenticated, setPendingAction],
  );

  const addToWishlist = useCallback(
    async (product) => {
      const productId = getProductId(product);
      if (productId == null) {
        return { ok: false, error: "Invalid product." };
      }

      const alreadyPresent = wishlistRef.current.some(
        (item) => getProductId(item) === productId,
      );
      if (alreadyPresent) {
        return { ok: true, inWishlist: true };
      }

      return toggleWishlist(product);
    },
    [toggleWishlist],
  );

  const removeFromWishlist = useCallback(
    async (productId) => {
      if (productId == null) {
        return { ok: false, error: "Invalid product." };
      }

      const alreadyPresent = wishlistRef.current.some(
        (item) => getProductId(item) === productId,
      );
      if (!alreadyPresent) {
        return { ok: true, inWishlist: false };
      }

      return toggleWishlist({ id: productId });
    },
    [toggleWishlist],
  );

  const isWishlisted = useCallback(
    (productId) =>
      wishlistRef.current.some((item) => getProductId(item) === productId),
    [],
  );

  const isWishlistPending = useCallback(
    (productId) => Boolean(pendingWishlistActions[productId]),
    [pendingWishlistActions],
  );

  const value = useMemo(
    () => ({
      wishlist,
      wishlistIds: new Set(wishlist.map(getProductId)),
      wishlistReady,
      wishlistCount: wishlist.length,
      isWishlisted,
      toggleWishlist,
      addToWishlist,
      removeFromWishlist,
      isWishlistPending,
    }),
    [
      wishlist,
      wishlistReady,
      isWishlisted,
      toggleWishlist,
      addToWishlist,
      removeFromWishlist,
      isWishlistPending,
    ],
  );

  return (
    <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);

  if (context === undefined) {
    throw new Error("useWishlist must be used within WishlistProvider");
  }

  return context;
}
