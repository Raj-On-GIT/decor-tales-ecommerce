"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import {
  getCart,
  removeFromCart as removeFromCartAPI,
  updateCartItem,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useGlobalToast } from "@/context/ToastContext";

const StoreContext = createContext(null);

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
    if (
      product.stock_type === "variant" ||
      product.stock_type === "variants"
    ) {
      return product.variant?.stock || 0;
    }

    return product.stock || 0;
  }


  /* ---------------------------------- */
  /* ADD TO CART (QTY CAPPED)           */
  /* ---------------------------------- */
  function addToCart(product) {
  const variantId = product.variant?.id || null;
  const availableStock = getAvailableStock(product);

  const existing = cart.find(
    (x) =>
      x.id === product.id &&
      (x.variant?.id || null) === variantId
  );

  // 🔥 ADD THIS BLOCK (safe early guard)
  if (existing && existing.qty >= availableStock) {
    error(
      `Only ${availableStock} item${
        availableStock > 1 ? "s" : ""
      } available in stock.`
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
        x.id === product.id &&
        (x.variant?.id || null) === variantId
          ? { ...x, qty: finalQty }
          : x
      )
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
        price: Number(
          String(product.price).replace(/,/g, "").trim()
        ),
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
      } available in stock.`
    );
  }
}

  /* ---------------------------------- */
  /* REMOVE ITEM                        */
  /* ---------------------------------- */
  async function removeFromCart(product) {
    if (isAuthenticated) {
      try {
        await removeFromCartAPI(product.id); // cart_item.id
      } catch (err) {
        console.error("Backend remove failed:", err);
        return;
      }
    }

    setCart((prev) =>
      prev.filter(
        (x) =>
          !(
            x.id === product.id &&
            (x.variant?.id || null) ===
              (product.variant?.id || null)
          )
      )
    );
  }

  /* ---------------------------------- */
  /* DECREASE QTY                       */
  /* ---------------------------------- */
  async function decreaseQty(product) {
  const existing = cart.find(
    (x) =>
      x.id === product.id &&
      (x.variant?.id || null) ===
        (product.variant?.id || null)
  );

  if (!existing) return;

  const newQty = existing.qty - 1;

  if (isAuthenticated) {
    try {
      if (newQty <= 0) {
        await removeFromCartAPI(product.id);
      } else {
        await updateCartItem(product.id, newQty);
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
        x.id === product.id &&
        (x.variant?.id || null) ===
          (product.variant?.id || null)
          ? { ...x, qty: x.qty - 1 }
          : x
      )
      .filter((x) => x.qty > 0)
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
      localStorage.setItem(
        "cart",
        JSON.stringify(newCartItems || [])
      );
    }
  }

  /* ---------------------------------- */
  /* TOTAL                              */
  /* ---------------------------------- */
  const total = cart.reduce(
    (sum, x) =>
      sum + x.qty * Number(x.price || 0),
    0
  );

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
    throw new Error(
      "useStore must be used inside StoreProvider"
    );
  }

  return context;
}
