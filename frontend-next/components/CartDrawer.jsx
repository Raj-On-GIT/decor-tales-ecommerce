"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, ShoppingBag, ArrowRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatPrice } from "@/lib/formatPrice";
import { useStore } from "@/context/StoreContext";
import { useGlobalToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { getCart, getCartStockIssues, syncCartStock } from "@/lib/api";
import CategoryTrail from "@/components/CategoryTrail";
import PriceDisplay from "@/components/PriceDisplay";

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
  } =
    useStore();
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
          {/* OVERLAY */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsCartOpen(false)}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
          />

          {/* DRAWER */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col"
          >
            {/* HEADER */}
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-serif font-bold">Your Cart</h2>

              <button
                onClick={() => setIsCartOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {cart.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
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
                    animate={{ opacity: itemPending ? 0.6 : 1, y: 0, scale: itemAction === "adding" ? 1.01 : 1 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ duration: 0.2 }}
                    className="flex space-x-4 items-start"
                  >
                    {/* IMAGE */}
                    <Link
                      href={`/products/${item.id}`}
                      onClick={() => setIsCartOpen(false)}
                      className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100"
                    >
                      <img
                        src={item.image || "https://via.placeholder.com/100"}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </Link>

                    {/* DETAILS */}
                    <div className="flex-1">
                      <Link
                        href={`/products/${item.id}`}
                        onClick={() => setIsCartOpen(false)}
                        className="font-medium text-gray-900 transition hover:text-[#002424]"
                      >
                        {item.title}
                      </Link>

                      <CategoryTrail
                        category={item.category}
                        subCategory={item.sub_category}
                        className="mt-1 text-xs sm:text-sm"
                        linkClassName="rounded-full border border-[#dbe7d6] bg-[#f8fbf5] px-2.5 py-1 font-medium text-[#002424] transition hover:border-[#002424] hover:bg-white"
                        separatorClassName="text-gray-400"
                      />

                      {/* VARIANT LINE */}
                      {item.variant &&
                        (item.variant.size_name || item.variant.color_name) && (
                          <p className="text-xs text-gray-500">
                            {item.variant.size_name && item.variant.color_name
                              ? `${item.variant.size_name} | ${item.variant.color_name}`
                              : item.variant.size_name ||
                                item.variant.color_name}
                          </p>
                        )}

                     
                      {/* CUSTOMIZATION TAG */}
                      {customizationTag && (
                        <span
                          className={`inline-block mt-1 rounded-full px-2 py-[2px] text-[10px] ${
                            customizationTag === "customized"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {customizationTag === "customized"
                            ? "Customized"
                            : "Standard"}
                        </span>
                      )}

                      {stockIssue && (
                        <p className="mt-2 text-xs font-medium text-red-600">
                          {stockIssue.suggestedQty > 0
                            ? `Only ${stockIssue.suggestedQty} can be ordered right now`
                            : "Out of stock"}
                        </p>
                      )}

                      <PriceDisplay
                        className="mt-2 gap-1.5"
                        price={item.price}
                        originalPrice={item.variant?.mrp || item.mrp}
                        discountPercent={item.variant?.discount_percent || item.discount_percent}
                        currentPriceClassName="text-sm"
                        originalPriceClassName="text-xs"
                        badgeClassName="px-2 py-0.5 text-[10px]"
                        currencyPrefix="Rs "
                      />
                    </div>

                    {/* RIGHT CONTROLS */}
                    <div className="flex flex-col items-end justify-between">
                      {/* REMOVE BUTTON */}
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

                      {/* QTY CONTROLS */}
                      <div className="flex items-center gap-2 mt-4">
                        {/* DECREASE */}
                        <button
                          onClick={async () => {
                            try {
                              await decreaseQty(item);
                            } catch (err) {
                              console.error("Qty decrease failed:", err);
                            }
                          }}
                          disabled={itemPending}
                          className="w-8 h-8 border rounded-full hover:bg-gray-200 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {itemAction === "updating" || itemAction === "removing" ? (
                            <Loader2 size={12} className="mx-auto animate-spin" />
                          ) : (
                            "–"
                          )}
                        </button>
                        <span className="text-sm font-semibold w-6 text-center">
                          {item.qty}
                        </span>
                        {/* INCREASE */}
                        <button
                          onClick={async () => {
                            try {
                              await increaseQty(item);
                            } catch (err) {
                              console.error("Qty increase failed:", err);
                            }
                          }}
                          disabled={itemPending}
                          className="w-8 h-8 border rounded-full hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {itemAction === "updating" ? (
                            <Loader2 size={12} className="mx-auto animate-spin" />
                          ) : (
                            "+"
                          )}
                        </button>
                      </div>
                    </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>

            {/* FOOTER */}
            {cart.length > 0 && (
              <div className="p-6 border-t bg-gray-50">
                <div className="flex justify-between mb-4 text-lg font-bold">
                  <span>Subtotal</span>
                  <span>₹{formatPrice(total)}</span>
                </div>

                <p className="text-xs text-gray-500 mb-6 text-center">
                  Shipping & taxes calculated at checkout.
                </p>

                <button
                  type="button"
                  onClick={handleProceedToCheckout}
                  disabled={checkingOut}
                  className="w-full flex items-center justify-center bg-gray-900 text-white py-3 rounded-lg font-medium hover:bg-black transition"
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
