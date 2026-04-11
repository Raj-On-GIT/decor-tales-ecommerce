"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import {
  addToCart as addToCartAPI,
  getCart,
  removeFromCart as removeFromCartAPI,
  syncCartStock,
  updateCartItem,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useGlobalToast } from "@/context/ToastContext";

const StoreContext = createContext(null);
const CART_STORAGE_KEY = "cart";

function readStoredGuestCart() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const savedCart = localStorage.getItem(CART_STORAGE_KEY);
    return savedCart ? JSON.parse(savedCart) : [];
  } catch (error) {
    console.error("Failed to read guest cart from storage:", error);
    return [];
  }
}

function writeStoredGuestCart(items) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error("Failed to persist guest cart:", error);
  }
}

function clearStoredGuestCart() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(CART_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear guest cart:", error);
  }
}

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

function getCartRowId(item) {
  return item?.cart_item_id ?? item?.cartItemId ?? null;
}

function getCartIdentity(item) {
  return [
    item?.id ?? item?.product_id ?? null,
    item?.variant?.id ?? null,
    item?.customText ?? item?.custom_text ?? null,
    getCustomImageIdentity(item),
  ].join("::");
}

function getPendingKey(item) {
  return getCartRowId(item) || getCartIdentity(item);
}

function mergeCartItemMetadata(previousItem, nextItem) {
  if (!previousItem) {
    return nextItem;
  }

  return {
    ...nextItem,
    allow_custom_text:
      nextItem?.allow_custom_text ?? previousItem?.allow_custom_text ?? false,
    allow_custom_image:
      nextItem?.allow_custom_image ?? previousItem?.allow_custom_image ?? false,
  };
}

function mergeCartMetadata(previousCart = [], nextCart = []) {
  const previousItemsByIdentity = new Map(
    previousCart.map((item) => [getCartIdentity(item), item]),
  );

  return nextCart.map((item) =>
    mergeCartItemMetadata(previousItemsByIdentity.get(getCartIdentity(item)), item),
  );
}

export function StoreProvider({ children }) {
  const { error } = useGlobalToast();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [cart, setCart] = useState([]);
  const [pendingCartActions, setPendingCartActions] = useState({});
  const [isCheckoutLocked, setIsCheckoutLocked] = useState(false);
  const [cartReady, setCartReady] = useState(false);

  const setPendingAction = useCallback((key, action) => {
    if (!key) return;
    setPendingCartActions((prev) => ({ ...prev, [key]: action }));
  }, []);

  const clearPendingAction = useCallback((key) => {
    if (!key) return;
    setPendingCartActions((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!isAuthenticated) {
      setCart(readStoredGuestCart());
      setCartReady(true);
      return;
    }

    async function loadServerCart() {
      try {
        const data = await getCart();
        if (!data?.items) {
          setCart([]);
          clearStoredGuestCart();
          return;
        }

        const syncedCart = await syncCartStock(data.items);
        const nextItems = syncedCart.items || data.items;

        setCart(nextItems);
        clearStoredGuestCart();

        if (syncedCart.changed) {
          error("Cart quantities were updated to match current stock.");
        }
      } catch (err) {
        setCart([]);
        clearStoredGuestCart();
        console.error("Failed to load server cart:", err);
      } finally {
        setCartReady(true);
      }
    }

    setCartReady(false);
    loadServerCart();
  }, [authLoading, error, isAuthenticated]);

  function getAvailableStock(product) {
    if (product.stock_type === "variant" || product.stock_type === "variants") {
      return product.variant?.stock || 0;
    }

    return product.stock || 0;
  }

  function guardCheckoutLock() {
    if (!isCheckoutLocked) {
      return false;
    }

    error("Cart editing is disabled while payment is being processed.");
    return true;
  }

  async function addToCart(product) {
    if (guardCheckoutLock()) {
      return { ok: false };
    }

    const availableStock = getAvailableStock(product);
    const productIdentity = getCartIdentity(product);
    const pendingKey = getPendingKey(product);
    const previousCart = cart;

    const existing = cart.find((x) => getCartIdentity(x) === productIdentity);

    if (existing && existing.qty >= availableStock) {
      error(
        `Only ${availableStock} item${availableStock > 1 ? "s" : ""} available in stock.`,
      );
      return { ok: false };
    }

    let exceededStock = false;
    let finalQty;
    let optimisticRowId = existing?.cart_item_id ?? crypto.randomUUID();

    if (existing) {
      const newQty = existing.qty + (product.qty || 1);

      if (newQty > availableStock) exceededStock = true;
      finalQty = Math.min(newQty, availableStock);

      setCart((prev) =>
        prev.map((x) =>
          getCartIdentity(x) === productIdentity ? { ...x, qty: finalQty } : x,
        ),
      );
    } else {
      const initialQty = product.qty || 1;

      if (initialQty > availableStock) exceededStock = true;
      finalQty = Math.min(initialQty, availableStock);

      setCart((prev) => [
        ...prev,
        {
          cart_item_id: optimisticRowId,
          price: Number(String(product.price).replace(/,/g, "").trim()),
          ...product,
          qty: finalQty,
        },
      ]);
    }

    if (exceededStock) {
      error(
        `Only ${availableStock} item${availableStock > 1 ? "s" : ""} available in stock.`,
      );
    }

    if (!isAuthenticated) {
      return { ok: true };
    }

    setPendingAction(pendingKey, "adding");

    try {
      const response = await addToCartAPI(
        product.id ?? product.product_id,
        product.qty || 1,
        product.variant?.id || null,
        product.customText || null,
        product.customImages || product.custom_images || null,
      );

      const serverCartItem = response?.cart_item;

      if (serverCartItem?.id) {
        setCart((prev) =>
          prev.map((x) =>
            getCartIdentity(x) === productIdentity
              ? {
                  ...x,
                  cart_item_id: serverCartItem.id,
                  qty: serverCartItem.quantity ?? x.qty,
                }
              : x,
          ),
        );
      }

      clearPendingAction(pendingKey);
      clearPendingAction(optimisticRowId);
      return { ok: true };
    } catch (err) {
      setCart(previousCart);
      clearPendingAction(pendingKey);
      clearPendingAction(optimisticRowId);
      error(err.message || "Unable to add item to cart");
      console.error("Add to cart failed:", err);
      return { ok: false, error: err };
    }
  }

  async function removeFromCart(product) {
    if (guardCheckoutLock()) {
      return { ok: false };
    }

    const rowId = getCartRowId(product);
    const productIdentity = getCartIdentity(product);
    const pendingKey = getPendingKey(product);
    const previousCart = cart;

    setPendingAction(pendingKey, "removing");

    if (rowId) {
      setCart((prev) => prev.filter((x) => getCartRowId(x) !== rowId));
    } else {
      setCart((prev) => prev.filter((x) => getCartIdentity(x) !== productIdentity));
    }

    if (!isAuthenticated) {
      clearPendingAction(pendingKey);
      return { ok: true };
    }

    try {
      await removeFromCartAPI(rowId);
      clearPendingAction(pendingKey);
      return { ok: true };
    } catch (err) {
      setCart(previousCart);
      clearPendingAction(pendingKey);
      error("Unable to remove item from cart");
      console.error("Backend remove failed:", err);
      return { ok: false, error: err };
    }
  }

  async function decreaseQty(product) {
    if (guardCheckoutLock()) {
      return { ok: false };
    }

    const rowId = getCartRowId(product);
    const productIdentity = getCartIdentity(product);
    const pendingKey = getPendingKey(product);
    const previousCart = cart;
    const existing = cart.find((x) =>
      rowId ? getCartRowId(x) === rowId : getCartIdentity(x) === productIdentity,
    );

    if (!existing) return { ok: false };

    const newQty = existing.qty - 1;
    const nextAction = newQty <= 0 ? "removing" : "updating";
    setPendingAction(pendingKey, nextAction);

    setCart((prev) =>
      prev
        .map((x) =>
          (rowId ? getCartRowId(x) === rowId : getCartIdentity(x) === productIdentity)
            ? { ...x, qty: x.qty - 1 }
            : x,
        )
        .filter((x) => x.qty > 0),
    );

    if (!isAuthenticated) {
      clearPendingAction(pendingKey);
      return { ok: true };
    }

    try {
      if (newQty <= 0) {
        await removeFromCartAPI(rowId);
      } else {
        await updateCartItem(rowId, newQty);
      }

      clearPendingAction(pendingKey);
      return { ok: true };
    } catch (err) {
      setCart(previousCart);
      clearPendingAction(pendingKey);
      error("Unable to update cart quantity");
      console.error("Decrease failed:", err);
      return { ok: false, error: err };
    }
  }

  async function increaseQty(product) {
    if (guardCheckoutLock()) {
      return { ok: false };
    }

    const rowId = getCartRowId(product);
    const productIdentity = getCartIdentity(product);
    const pendingKey = getPendingKey(product);
    const previousCart = cart;
    const existing = cart.find((x) =>
      rowId ? getCartRowId(x) === rowId : getCartIdentity(x) === productIdentity,
    );

    if (!existing) return { ok: false };

    const availableStock = existing.variant?.stock ?? existing.stock ?? 0;
    const sameVariantTotal = cart
      .filter(
        (item) =>
          (item.id || item.product_id || null) ===
            (existing.id || existing.product_id || null) &&
          (item.variant?.id || null) === (existing.variant?.id || null),
      )
      .reduce((sum, item) => sum + item.qty, 0);

    if (sameVariantTotal >= availableStock) {
      error(
        `Only ${availableStock} item${availableStock > 1 ? "s" : ""} available in stock.`,
      );
      return { ok: false };
    }

    const newQty = existing.qty + 1;
    setPendingAction(pendingKey, "updating");

    setCart((prev) =>
      prev.map((item) =>
        (rowId ? getCartRowId(item) === rowId : getCartIdentity(item) === productIdentity)
          ? { ...item, qty: newQty }
          : item,
      ),
    );

    if (!isAuthenticated) {
      clearPendingAction(pendingKey);
      return { ok: true };
    }

    try {
      await updateCartItem(rowId, newQty);
      clearPendingAction(pendingKey);
      return { ok: true };
    } catch (err) {
      setCart(previousCart);
      clearPendingAction(pendingKey);
      error(err.message || "Unable to update cart quantity");
      console.error("Increase failed:", err);
      return { ok: false, error: err };
    }
  }

  const clearCart = useCallback(() => {
    setCart([]);
    clearStoredGuestCart();
  }, []);

  const replaceCart = useCallback((newCartItems) => {
    setCart(newCartItems || []);
  }, []);

  function getCartAction(item) {
    return pendingCartActions[getPendingKey(item)] || null;
  }

  function isCartItemPending(item) {
    return Boolean(getCartAction(item));
  }

  const total = cart.reduce((sum, x) => sum + x.qty * Number(x.price || 0), 0);

  useEffect(() => {
    if (authLoading || isAuthenticated || !cartReady) {
      return;
    }

    writeStoredGuestCart(cart);
  }, [authLoading, cart, cartReady, isAuthenticated]);

  useEffect(() => {
    function handleLogout() {
      setCart([]);
      setCartReady(true);
      clearStoredGuestCart();
    }

    function handleGuestCartMerged() {
      clearStoredGuestCart();
    }

    window.addEventListener("user-logout", handleLogout);
    window.addEventListener("guest-cart-merged", handleGuestCartMerged);

    return () => {
      window.removeEventListener("user-logout", handleLogout);
      window.removeEventListener("guest-cart-merged", handleGuestCartMerged);
    };
  }, []);

  return (
    <StoreContext.Provider
      value={{
        cart,
        cartReady,
        addToCart,
        removeFromCart,
        decreaseQty,
        increaseQty,
        clearCart,
        replaceCart,
        total,
        getCartAction,
        isCartItemPending,
        isCheckoutLocked,
        setCartLock: setIsCheckoutLocked,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);

  if (!context) {
    throw new Error("useStore must be used inside StoreProvider");
  }

  return context;
}
