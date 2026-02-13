"use client";

import { createContext, useContext, useState } from "react";

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [cart, setCart] = useState([]);

  function addToCart(product) {
    setCart((prev) => {
      const variantId = product.variant?.id || null;

      const found = prev.find(
        (x) =>
          x.id === product.id &&
          (x.variant?.id || null) === variantId
      );

      if (found) {
        return prev.map((x) =>
          x.id === product.id &&
          (x.variant?.id || null) === variantId
            ? { ...x, qty: x.qty + product.qty }
            : x
        );
      }

      return [
        ...prev,
        {
          ...product,
          qty: product.qty || 1,
        },
      ];
    });
  }


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


  function clearCart() {
    setCart([]);
  }

  const total = cart.reduce(
    (sum, x) => sum + x.qty * Number(x.price || 0),
    0
  );


  return (
    <StoreContext.Provider
      value={{ cart, addToCart, removeFromCart, decreaseQty, clearCart, total }}
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
