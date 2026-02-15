"use client";

import { incrementCartAdd } from "@/lib/api";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [cart, setCart] = useState(() => {
    if (typeof window !== "undefined") {
      const savedCart = localStorage.getItem("cart");
      return savedCart ? JSON.parse(savedCart) : [];
    }
    return [];
  });
  console.log("Cart Items:", cart);


  /* ---------------------------------- */
  /* TOAST STATE                        */
  /* ---------------------------------- */
  const [toast, setToast] = useState(null);

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  }

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
    setCart((prev) => {
      const variantId = product.variant?.id || null;

      const availableStock =
        getAvailableStock(product);

      const found = prev.find(
        (x) =>
          x.id === product.id &&
          (x.variant?.id || null) === variantId
      );

      /* ---------- EXISTING ITEM ---------- */
      if (found) {
        const newQty =
          found.qty + (product.qty || 1);

        // ✅ CAP INSTEAD OF BLOCK
        const finalQty = Math.min(
          newQty,
          availableStock
        );

        if (newQty > availableStock) {
          showToast(
            `Maximum ${availableStock} allowed`
          );
        }

        return prev.map((x) =>
          x.id === product.id &&
          (x.variant?.id || null) === variantId
            ? { ...x, qty: finalQty }
            : x
        );
      }

      /* ---------- NEW ITEM ---------- */
      const initialQty = product.qty || 1;

      const finalQty = Math.min(
        initialQty,
        availableStock
      );

      if (initialQty > availableStock) {
        showToast(
          `Maximum ${availableStock} allowed`
        );
      }

      // Fire-and-forget: increment cart_add_count on the backend
      const trackId = product.variant ? product.variant.id : product.id;
      const baseProductId = product.id;
      incrementCartAdd(baseProductId);

      return [
        ...prev,
        {
          price: Number(
            String(product.price)
              .replace(/,/g, "") // remove commas
              .trim()
          ),
          ...product,
          qty: finalQty,
        },
      ];
    });
  }

  /* ---------------------------------- */
  /* REMOVE ITEM                        */
  /* ---------------------------------- */
  function removeFromCart(product) {
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
  function decreaseQty(product) {
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
        total,
      }}
    >
      {children}

      {/* 🔔 MINIMAL TOAST POPUP */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-black text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50">
          {toast}
        </div>
      )}
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