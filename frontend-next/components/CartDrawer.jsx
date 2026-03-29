"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, ShoppingBag, ArrowRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatPrice } from "@/lib/formatPrice";
import { useStore } from "@/context/StoreContext";
import { useGlobalToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { getCart, getCartStockIssues, syncCartStock } from "@/lib/api";
import ProductListItem from "@/components/ProductListItem";

function getCustomizationTag(item) {
  const isCustomized = Boolean(
    item?.customText ||
      item?.custom_text ||
      item?.customImages?.length ||
      item?.custom_images?.length ||
      item?.customImage ||
      item?.custom_image,
  );

  if (isCustomized) {
    return "customized";
  }

  const canBeCustomized = Boolean(
    item?.allow_custom_text || item?.allow_custom_image,
  );

  return canBeCustomized ? "standard" : null;
}

export default function CartDrawer({ isCartOpen, setIsCartOpen }) {
  const {
    cart,
    removeFromCart,
    decreaseQty,
    increaseQty,
    replaceCart,
    total,
    getCartAction,
    isCartItemPending,
  } = useStore();
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const { error } = useGlobalToast();
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    if (!isCartOpen || !isAuthenticated) {
      return;
    }

    async function refreshCartStock() {
      try {
        const latestCart = await getCart();
        const syncedCart = await syncCartStock(latestCart.items || []);
        const nextItems = syncedCart.items || latestCart.items || [];

        replaceCart(nextItems);

        if (syncedCart.changed) {
          error("Cart updated to match current stock. Customized items were kept first.");
        }
      } catch (err) {
        console.error("Cart refresh failed:", err);
      }
    }

    refreshCartStock();
  }, [error, isAuthenticated, isCartOpen, replaceCart]);

  const stockIssues = getCartStockIssues(cart);
  const stockIssueMap = new Map(
    stockIssues.map((issue) => [issue.cart_item_id, issue]),
  );

  async function handleProceedToCheckout() {
    if (!isAuthenticated) {
      setIsCartOpen(false);
      router.push("/checkout");
      return;
    }

    setCheckingOut(true);

    try {
      const latestCart = await getCart();
      const syncedCart = await syncCartStock(latestCart.items || []);
      const nextItems = syncedCart.items || latestCart.items || [];

      replaceCart(nextItems);

      if (syncedCart.changed || syncedCart.issues.length > 0) {
        const firstIssue = syncedCart.adjustments[0] || syncedCart.issues[0];
        const itemLabel = firstIssue.variantLabel
          ? `${firstIssue.title} (${firstIssue.variantLabel})`
          : firstIssue.title;

        error(
          firstIssue.suggestedQty > 0
            ? `${itemLabel} was reduced to ${firstIssue.suggestedQty} to match current stock.`
            : `${itemLabel} is now out of stock and was removed from your cart.`,
        );
        return;
      }

      setIsCartOpen(false);
      router.push("/checkout");
    } catch {
      error("Failed to verify stock before checkout");
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsCartOpen(false)}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b p-6">
              <h2 className="text-xl font-serif font-bold">Your Cart</h2>

              <button
                onClick={() => setIsCartOpen(false)}
                className="rounded-full p-2 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {cart.length === 0 ? (
                <div className="py-20 text-center text-gray-500">
                  <ShoppingBag size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Your cart is empty.</p>

                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="mt-4 text-sm font-bold underline"
                  >
                    Start Browsing
                  </button>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {cart.map((item) => {
                    const itemAction = getCartAction(item);
                    const itemPending = isCartItemPending(item);
                    const stockIssue = stockIssueMap.get(item.cart_item_id);
                    const customizationTag = getCustomizationTag(item);

                    return (
                      <motion.div
                        key={`${item.cart_item_id || item.id}-${item.variant?.id || "v0"}`}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{
                          opacity: itemPending ? 0.6 : 1,
                          y: 0,
                          scale: itemAction === "adding" ? 1.01 : 1,
                        }}
                        exit={{ opacity: 0, x: 16 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ProductListItem
                          href={`/products/${item.id}`}
                          image={item.image || "https://via.placeholder.com/100"}
                          title={item.title}
                          category={item.category}
                          subCategory={item.sub_category}
                          categoryTrailProps={{
                            variant: "chip",
                            chipClassName: "bg-gray-100 text-gray-600",
                            linkClassName:
                              "text-gray-600 transition hover:text-gray-800 hover:underline underline-offset-2",
                          }}
                          variant={item.variant}
                          quantity={undefined}
                          primaryContent={(
                            <p className="text-sm font-semibold text-gray-900">
                              Rs {formatPrice(item.price)}
                            </p>
                          )}
                          secondaryContent={
                            customizationTag ? (
                              <p className="text-[11px] uppercase tracking-[0.16em] text-gray-400">
                                {customizationTag === "customized" ? "Customized" : "Standard"}
                              </p>
                            ) : null
                          }
                          noteContent={
                            stockIssue ? (
                              <p className="text-xs font-medium text-red-600">
                                {stockIssue.suggestedQty > 0
                                  ? `Only ${stockIssue.suggestedQty} can be ordered right now`
                                  : "Out of stock"}
                              </p>
                            ) : null
                          }
                          onNavigate={() => setIsCartOpen(false)}
                          actions={(
                            <div className="flex flex-col items-end gap-4">
                              <button
                                onClick={() => removeFromCart(item)}
                                disabled={itemPending}
                                className="text-gray-600 transition hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {itemAction === "removing" ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : (
                                  <X size={16} />
                                )}
                              </button>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={async () => {
                                    try {
                                      await decreaseQty(item);
                                    } catch (err) {
                                      console.error("Qty decrease failed:", err);
                                    }
                                  }}
                                  disabled={itemPending}
                                  className="h-8 w-8 rounded-full border text-sm transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {itemAction === "updating" || itemAction === "removing" ? (
                                    <Loader2 size={12} className="mx-auto animate-spin" />
                                  ) : (
                                    "-"
                                  )}
                                </button>
                                <span className="w-6 text-center text-sm font-semibold">
                                  {item.qty}
                                </span>
                                <button
                                  onClick={async () => {
                                    try {
                                      await increaseQty(item);
                                    } catch (err) {
                                      console.error("Qty increase failed:", err);
                                    }
                                  }}
                                  disabled={itemPending}
                                  className="h-8 w-8 rounded-full border text-sm transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {itemAction === "updating" ? (
                                    <Loader2 size={12} className="mx-auto animate-spin" />
                                  ) : (
                                    "+"
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                          className="border-0 bg-transparent p-0"
                          contentClassName="items-center"
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t bg-gray-50 p-6">
                <div className="mb-4 flex justify-between text-lg font-bold">
                  <span>Subtotal</span>
                  <span>Rs {formatPrice(total)}</span>
                </div>

                <p className="mb-6 text-center text-xs text-gray-500">
                  Shipping & taxes calculated at checkout.
                </p>

                <button
                  type="button"
                  onClick={handleProceedToCheckout}
                  disabled={checkingOut}
                  className="flex w-full items-center justify-center rounded-lg bg-gray-900 py-3 font-medium text-white transition hover:bg-black"
                >
                  {checkingOut ? "Checking Stock..." : "Proceed to Checkout"}
                  <ArrowRight size={16} className="ml-2" />
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
