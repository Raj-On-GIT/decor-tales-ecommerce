"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { getCart, removeFromCart as removeFromCartAPI, updateCartItem } from "@/lib/api";
import { addToCart as addToCartAPI } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useGlobalToast } from "@/context/ToastContext";

const StoreContext = createContext(null);

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

export function StoreProvider({ children }) {
  const { error } = useGlobalToast();
  const [cart, setCart] = useState(() => {
    if (typeof window !== "undefined") {
      const savedCart = localStorage.getItem("cart");
      return savedCart ? JSON.parse(savedCart) : [];
    }
    return [];
  });
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadServerCart() {
      try {
        const data = await getCart();
        if (!data?.items) return;

        // ✅ No remapping — already shaped in api.js
        setCart(data.items);
        localStorage.setItem("cart", JSON.stringify(data.items));
      } catch (err) {
        console.error("Failed to load server cart:", err);
      }
    }

    loadServerCart();
  }, [isAuthenticated]);

  /* ---------------------------------- */
  /* STOCK RESOLVER (YOUR EXISTING ONE) */
  /* ---------------------------------- */
  function getAvailableStock(product) {
    if (product.stock_type === "variant" || product.stock_type === "variants") {
      return product.variant?.stock || 0;
    }

    return product.stock || 0;
  }

  /* ---------------------------------- */
  /* ADD TO CART (QTY CAPPED)           */
  /* ---------------------------------- */
  async function addToCart(product) {
    const availableStock = getAvailableStock(product);
    const productIdentity = getCartIdentity(product);

    const existing = cart.find(
      (x) => getCartIdentity(x) === productIdentity,
    );

    // 🔥 ADD THIS BLOCK (safe early guard)
    if (existing && existing.qty >= availableStock) {
      error(
        `Only ${availableStock} item${
          availableStock > 1 ? "s" : ""
        } available in stock.`,
      );
      return; // do not proceed further
    }

    let exceededStock = false;
    let finalQty;

    if (existing) {
      const newQty = existing.qty + (product.qty || 1);

      if (newQty > availableStock) {
        exceededStock = true;
      }

      finalQty = Math.min(newQty, availableStock);

      setCart((prev) =>
        prev.map((x) =>
          getCartIdentity(x) === productIdentity
            ? { ...x, qty: finalQty }
            : x,
        ),
      );
    } else {
      const initialQty = product.qty || 1;

      if (initialQty > availableStock) {
        exceededStock = true;
      }

      finalQty = Math.min(initialQty, availableStock);

      setCart((prev) => [
        ...prev,
        {
          cart_item_id: crypto.randomUUID(),
          price: Number(String(product.price).replace(/,/g, "").trim()),
          ...product,
          qty: finalQty,
        },
      ]);
    }

    // ✅ Now this is reliable
    if (exceededStock) {
      error(
        `Only ${availableStock} item${
          availableStock > 1 ? "s" : ""
        } available in stock.`,
      );
    }

    if (isAuthenticated) {
      try {
        await addToCartAPI(
          product.id,
          product.qty || 1,
          product.variant?.id || null,
          product.customText || null,
          product.customImages || product.custom_images || null,
        );

        const data = await getCart();
        replaceCart(data.items);
      } catch (err) {
        console.error("Add to cart failed:", err);
      }
    }
  }

  /* ---------------------------------- */
  /* REMOVE ITEM                        */
  /* ---------------------------------- */
  async function removeFromCart(product) {
    const rowId = getCartRowId(product);

    if (isAuthenticated) {
      try {
        await removeFromCartAPI(rowId);
        const data = await getCart();
        replaceCart(data.items);
      } catch (err) {
        console.error("Backend remove failed:", err);
        return;
      }
    }

    if (rowId) {
      setCart((prev) => prev.filter((x) => getCartRowId(x) !== rowId));
      return;
    }

    const productIdentity = getCartIdentity(product);
    setCart((prev) => prev.filter((x) => getCartIdentity(x) !== productIdentity));
  }

  /* ---------------------------------- */
  /* DECREASE QTY                       */
  /* ---------------------------------- */
  async function decreaseQty(product) {
    const rowId = getCartRowId(product);
    const productIdentity = getCartIdentity(product);
    const existing = cart.find((x) =>
      rowId ? getCartRowId(x) === rowId : getCartIdentity(x) === productIdentity,
    );

    if (!existing) return;

    const newQty = existing.qty - 1;

    if (isAuthenticated) {
      try {
        if (newQty <= 0) {
          await removeFromCartAPI(rowId);
        } else {
          await updateCartItem(rowId, newQty);
        }

        // 🔥 After backend update, reload cart
        const data = await getCart();
        replaceCart(data.items);
      } catch (err) {
        console.error("Decrease failed:", err);
      }

      return;
    }

    // Guest logic (local only)
    setCart((prev) =>
      prev
        .map((x) =>
          (rowId
            ? getCartRowId(x) === rowId
            : getCartIdentity(x) === productIdentity)
            ? { ...x, qty: x.qty - 1 }
            : x,
        )
        .filter((x) => x.qty > 0),
    );
  }

  /* ---------------------------------- */
  /* CLEAR CART                         */
  /* ---------------------------------- */
  const clearCart = useCallback(() => {
    setCart([]);
    localStorage.removeItem("cart");
  }, []);

  /* ---------------------------------- */
  /* REPLACE CART (SERVER SYNC)         */
  /* ---------------------------------- */
  function replaceCart(newCartItems) {
    setCart(newCartItems || []);

    if (typeof window !== "undefined") {
      localStorage.setItem("cart", JSON.stringify(newCartItems || []));
    }
  }

  /* ---------------------------------- */
  /* TOTAL                              */
  /* ---------------------------------- */
  const total = cart.reduce((sum, x) => sum + x.qty * Number(x.price || 0), 0);

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    function handleLogout() {
      setCart([]);
      localStorage.removeItem("cart");
    }

    window.addEventListener("user-logout", handleLogout);

    return () => {
      window.removeEventListener("user-logout", handleLogout);
    };
  }, []);

  /* ---------------------------------- */
  /* PROVIDER                           */
  /* ---------------------------------- */
  return (
    <StoreContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        decreaseQty,
        clearCart,
        replaceCart,
        total,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

/* ---------------------------------- */
/* HOOK                               */
/* ---------------------------------- */
export function useStore() {
  const context = useContext(StoreContext);

  if (!context) {
    throw new Error("useStore must be used inside StoreProvider");
  }

  return context;
}
