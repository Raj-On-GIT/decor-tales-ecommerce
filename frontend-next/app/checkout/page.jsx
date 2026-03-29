"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import {
  getAddresses,
  getAvailableCoupons,
  getCart,
  getCartStockIssues,
  createRazorpayOrder,
  markRazorpayPaymentFailed,
  syncCartStock,
  verifyRazorpayPayment,
} from "@/lib/api";
import { useGlobalToast } from "@/context/ToastContext";
import { formatPrice } from "@/lib/formatPrice";
import PageLoader from "@/components/ui/PageLoader";
import { RAZORPAY_KEY } from "@/lib/config";
import ProductListItem from "@/components/ProductListItem";

function loadRazorpayScript() {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }

  if (window.Razorpay) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true), { once: true });
      existingScript.addEventListener("error", () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function getCouponDescriptionLines(coupon) {
  if (Array.isArray(coupon?.description_lines) && coupon.description_lines.length > 0) {
    return coupon.description_lines.filter(Boolean);
  }

  return String(coupon?.description || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[•\-]\s*/, "").trim())
    .filter(Boolean);
}

export default function CheckoutPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { replaceCart, setCartLock } = useStore();
  const router = useRouter();
  const { success, error } = useGlobalToast();

  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [cart, setCart] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [paymentInitializing, setPaymentInitializing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [paymentError, setPaymentError] = useState("");

  useEffect(() => {
    return () => {
      setCartLock(false);
    };
  }, [setCartLock]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadData() {
      try {
        setInitialLoading(true);
        const addr = await getAddresses();
        setAddresses(addr);

        const defaultAddr = addr.find((a) => a.is_default);
        if (defaultAddr) setSelectedAddress(defaultAddr.id);

        const cartData = await getCart();
        const syncedCart = await syncCartStock(cartData.items || []);
        const nextItems = syncedCart.items || cartData.items || [];

        setCart(nextItems);
        replaceCart(nextItems);

        const couponData = await getAvailableCoupons();
        const nextCoupons = couponData.coupons || [];
        setCoupons(nextCoupons);
        setSelectedCoupon((current) => {
          if (!current) return null;
          const updated = nextCoupons.find((coupon) => coupon.code === current.code);
          return updated?.eligible ? updated : null;
        });

        if (syncedCart.changed) {
          error("Cart updated to match current stock before checkout.");
        }
      } catch {
        error("Failed to load checkout data");
      } finally {
        setInitialLoading(false);
      }
    }

    loadData();
  }, [error, isAuthenticated, replaceCart]);

  const total = cart.reduce((sum, item) => sum + item.qty * Number(item.price), 0);
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const selectedCouponDiscount = Number(selectedCoupon?.discount_amount || 0);
  const payableTotal = Math.max(0, total - selectedCouponDiscount);

  async function handlePlaceOrder() {
    if (!selectedAddress) {
      error("Please select a shipping address");
      return;
    }

    setPaymentError("");
    setPaymentInitializing(true);
    setCartLock(true);

    try {
      const latestCart = await getCart();
      const syncedCart = await syncCartStock(latestCart.items || []);
      const nextItems = syncedCart.items || latestCart.items || [];
      const issues = getCartStockIssues(nextItems);

      setCart(nextItems);
      replaceCart(nextItems);

      const couponData = await getAvailableCoupons();
      const nextCoupons = couponData.coupons || [];
      setCoupons(nextCoupons);

      const refreshedSelectedCoupon = selectedCoupon
        ? nextCoupons.find((coupon) => coupon.code === selectedCoupon.code)
        : null;

      if (selectedCoupon && !refreshedSelectedCoupon?.eligible) {
        setSelectedCoupon(null);
        error(
          refreshedSelectedCoupon?.reason ||
            "The selected coupon is no longer eligible for this cart.",
        );
        return;
      }

      if (syncedCart.changed || issues.length > 0) {
        const firstIssue = syncedCart.adjustments[0] || issues[0];
        const itemLabel = firstIssue.variantLabel
          ? `${firstIssue.title} (${firstIssue.variantLabel})`
          : firstIssue.title;

        error(
          firstIssue.suggestedQty > 0
            ? `${itemLabel} was reduced to ${firstIssue.suggestedQty}. Please review your cart before placing the order.`
            : `${itemLabel} is now out of stock and was removed from your cart.`,
        );
        return;
      }

      const isRazorpayLoaded = await loadRazorpayScript();
      if (!isRazorpayLoaded) {
        throw new Error("Unable to load Razorpay checkout. Please try again.");
      }

      const response = await createRazorpayOrder(
        selectedAddress,
        refreshedSelectedCoupon?.code || selectedCoupon?.code || "",
      );

      const razorpayKey = RAZORPAY_KEY || response.payment?.key_id;
      if (!razorpayKey) {
        throw new Error("Razorpay public key is not configured.");
      }

      const razorpay = new window.Razorpay({
        key: razorpayKey,
        amount: response.payment.amount,
        currency: response.payment.currency,
        name: "Luxe Frames",
        description: `Order ${response.order.order_number}`,
        order_id: response.payment.razorpay_order_id,
        handler: async (paymentResult) => {
          try {
            const verification = await verifyRazorpayPayment({
              order_id: response.order.id,
              razorpay_order_id: paymentResult.razorpay_order_id,
              razorpay_payment_id: paymentResult.razorpay_payment_id,
              razorpay_signature: paymentResult.razorpay_signature,
            });

            replaceCart([]);
            setCartLock(false);
            success("Payment successful");
            router.push(
              `/success?orderId=${verification.order.id}&orderNumber=${encodeURIComponent(verification.order.order_number)}`,
            );
          } catch (verificationError) {
            setPaymentError(verificationError.message || "Payment verification failed.");
            error(verificationError.message || "Payment verification failed.");
            setCartLock(false);
          } finally {
            setPaymentInitializing(false);
          }
        },
        prefill: {},
        theme: {
          color: "#002424",
        },
        modal: {
          ondismiss: async () => {
            try {
              await markRazorpayPaymentFailed(
                response.order.id,
                "Payment window closed before completion.",
              );
            } catch {}

            setPaymentError("Payment was cancelled before completion.");
            setPaymentInitializing(false);
            setCartLock(false);
          },
        },
      });

      razorpay.on("payment.failed", async (paymentFailure) => {
        try {
          await markRazorpayPaymentFailed(
            response.order.id,
            paymentFailure?.error?.description || "Payment failed.",
          );
        } catch {}

        setPaymentError(
          paymentFailure?.error?.description || "Payment failed. Please try again.",
        );
        error(paymentFailure?.error?.description || "Payment failed. Please try again.");
        setPaymentInitializing(false);
        setCartLock(false);
      });

      razorpay.open();
    } catch (err) {
      setPaymentError(err.message || "Unable to start payment.");
      error(err.message);
      setCartLock(false);
    } finally {
      if (!window.Razorpay) {
        setPaymentInitializing(false);
      }
    }
  }

  if (authLoading || (isAuthenticated && initialLoading)) {
    return (
      <section className="min-h-screen bg-gradient-to-br from-[#F0FFDF] via-white to-[#FFECC0] px-4 py-10 sm:px-6 sm:py-12">
        <div className="mx-auto flex min-h-[60vh] max-w-screen-xl items-center justify-center rounded-[2rem] border border-white/70 bg-white/70 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <PageLoader text="Loading checkout..." />
        </div>
      </section>
    );
  }

  if (!cart.length) {
    return (
      <section className="min-h-screen bg-gradient-to-br from-[#F0FFDF] via-white to-[#FFECC0] px-4 py-10 sm:px-6 sm:py-12">
        <div className="mx-auto flex min-h-[60vh] max-w-screen-xl items-center justify-center">
          <div className="rounded-[2rem] border border-white/70 bg-white/90 px-8 py-12 text-center shadow-[0_25px_70px_rgba(15,23,42,0.08)] backdrop-blur">
            <p className="text-lg font-medium text-gray-800">Your cart is empty.</p>
            <p className="mt-2 text-sm text-gray-500">
              Add a few pieces before starting checkout.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-gradient-to-br from-[#F0FFDF] via-white to-[#FFECC0] px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-screen-xl">
        <div className="mb-8 rounded-[2rem] border border-white/70 bg-white/70 px-6 py-7 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-800/70">
                Secure Checkout
              </p>
              <h1 className="mt-3 font-serif text-3xl font-bold text-gray-900 sm:text-4xl">
                Review your order before payment
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 sm:text-base">
                Confirm your shipping address and final cart details before
                starting a secure Razorpay payment.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-gray-600">
              <div className="rounded-full bg-[#002424] px-4 py-2 font-medium text-white">
                {itemCount} item{itemCount === 1 ? "" : "s"}
              </div>
              <div className="rounded-full border border-gray-200 bg-white px-4 py-2 font-medium">
                Total: Rs {formatPrice(payableTotal)}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-[0_25px_70px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8"
          >
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">
                  Step 1
                </p>
                <h2 className="mt-2 text-3xl font-serif font-semibold text-gray-900">
                  Shipping Address
                </h2>
              </div>

              {addresses.length > 0 && (
                <button
                  onClick={() => router.push("/account/addresses")}
                  className="rounded-full bg-[#002424] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#013535]"
                >
                  + Add Address
                </button>
              )}
            </div>

            <div className="space-y-5">
              {addresses.length === 0 && (
                <div className="rounded-[1.5rem] border border-dashed border-gray-300 bg-[#f8faef] py-12 text-center">
                  <p className="mb-4 text-gray-600">
                    No shipping address added yet.
                  </p>

                  <button
                    onClick={() => router.push("/account/addresses")}
                    className="rounded-full bg-[#002424] px-6 py-2 text-white transition hover:bg-[#013535]"
                  >
                    Add Address
                  </button>
                </div>
              )}

              {addresses.map((addr) => (
                <label
                  key={addr.id}
                  className={`block cursor-pointer rounded-[1.5rem] border p-6 transition-all duration-200 ${
                    selectedAddress === addr.id
                      ? "border-[#002424] bg-[#f7fbf4] shadow-sm"
                      : "border-transparent bg-gray-50 hover:border-gray-200 hover:bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="address"
                    className="hidden"
                    checked={selectedAddress === addr.id}
                    onChange={() => setSelectedAddress(addr.id)}
                  />

                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-lg font-semibold">
                        {addr.full_name}
                        {addr.is_default && (
                          <span className="ml-3 rounded-full bg-black px-3 py-1 text-xs text-white">
                            Default
                          </span>
                        )}
                      </div>

                      <div className="mt-2 text-sm leading-relaxed text-gray-600">
                        {addr.address_line_1}
                        {addr.address_line_2 && `, ${addr.address_line_2}`}
                        <br />
                        {addr.city}, {addr.state} - {addr.postal_code}
                        <br />
                        Phone: {addr.phone}
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[2rem] border border-white/80 bg-[#fffdf8]/95 p-6 shadow-[0_25px_70px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8 xl:sticky xl:top-24"
          >
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">
                  Step 2
                </p>
                <h2 className="mt-2 text-3xl font-serif font-semibold text-gray-900">
                  Order Summary
                </h2>
              </div>
              <p className="text-sm text-gray-500">Ready for final review</p>
            </div>

            <div className="space-y-4">
              {cart.map((item) => (
                <ProductListItem
                  key={
                    item.cart_item_id ||
                    `${item.id}-${item.variant?.id || "v0"}-${item.custom_text || "plain"}-${item.custom_image || "noimg"}`
                  }
                  href={`/products/${item.id}`}
                  image={item.image}
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
                  primaryContent={(
                    <p className="text-sm font-semibold text-gray-900 sm:text-base">
                      Rs {formatPrice(item.price)}
                    </p>
                  )}
                  customizationContent={
                    (item.custom_text || item.custom_image || item.custom_images?.length > 0) ? (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-gray-600 hover:text-black">
                          View Customization
                        </summary>

                        <div className="mt-2 space-y-2">
                          {item.custom_text && (
                            <div className="text-gray-700">
                              <strong>Text:</strong> {item.custom_text}
                            </div>
                          )}

                          {item.custom_images?.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {item.custom_images.map((image, index) => (
                                <img
                                  key={`${item.cart_item_id || item.id}-custom-${index}`}
                                  src={image}
                                  alt={`custom-${index + 1}`}
                                  className="h-14 w-14 rounded-lg border object-cover"
                                />
                              ))}
                            </div>
                          ) : item.custom_image ? (
                            <div className="flex flex-wrap gap-2">
                              <img
                                src={item.custom_image}
                                alt="custom"
                                className="h-14 w-14 rounded-lg border object-cover"
                              />
                            </div>
                          ) : null}
                        </div>
                      </details>
                    ) : null
                  }
                  actions={(
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        Rs {(item.qty * Number(item.price)).toFixed(2)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">Qty: {item.qty}</p>
                    </div>
                  )}
                  asideClassName="sm:self-center"
                />
              ))}
            </div>

            <div className="mt-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">
                    Step 3
                  </p>
                  <h3 className="mt-2 text-2xl font-serif font-semibold text-gray-900">
                    Available Coupons
                  </h3>
                </div>
                <p className="text-sm text-gray-500">
                  {coupons.length} offer{coupons.length === 1 ? "" : "s"}
                </p>
              </div>

              <div className="mt-4 rounded-[1.5rem] border border-[#dce7db] bg-white/70 p-4 shadow-[0_10px_35px_rgba(15,23,42,0.04)] sm:p-5">
                <p className="text-sm text-gray-500">
                  Apply the best offer available for this order.
                </p>

                <div className="mt-4 space-y-2.5 sm:space-y-3">
                {coupons.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-gray-200 bg-[#fafaf7] px-4 py-4 text-sm text-gray-500">
                    No active coupons are available right now.
                  </p>
                ) : (
                  coupons.map((coupon) => {
                    const isApplied = selectedCoupon?.code === coupon.code;
                    const isEligible = Boolean(coupon.eligible);
                    const descriptionLines = getCouponDescriptionLines(coupon);

                    return (
                      <div
                        key={coupon.code}
                        className={`rounded-[1.25rem] border px-4 py-3.5 transition sm:px-5 sm:py-4 ${
                          isApplied
                            ? "border-[#002424] bg-[#fcfef9] shadow-[0_12px_30px_rgba(0,36,36,0.08)]"
                            : isEligible
                              ? "border-[#d8e5d8] bg-white"
                              : "border-[#e6ebe6] bg-[#fbfcfa]"
                        }`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <span className="rounded-full bg-[#002424] px-3 py-1 text-[11px] font-semibold tracking-[0.24em] text-white">
                                {coupon.code}
                              </span>
                              {coupon.first_order_only ? (
                                <span className="rounded-full bg-[#edf6ee] px-3 py-1 text-[11px] font-medium text-[#185c37]">
                                  New user
                                </span>
                              ) : null}
                              {isApplied ? (
                                <span className="rounded-full border border-[#b8d0bc] bg-[#f3faf3] px-3 py-1 text-[11px] font-medium text-[#185c37]">
                                  Applied
                                </span>
                              ) : null}
                            </div>

                            <h4 className="mt-3 text-base font-semibold text-gray-900 sm:text-lg">
                              {coupon.title}
                            </h4>

                            {descriptionLines.length > 1 ? (
                              <ul className="mt-2 space-y-1.5 pl-4 text-sm leading-6 text-gray-600">
                                {descriptionLines.map((line) => (
                                  <li key={`${coupon.code}-${line}`}>{line}</li>
                                ))}
                              </ul>
                            ) : descriptionLines.length === 1 ? (
                              <p className="mt-2 text-sm leading-6 text-gray-600">
                                {descriptionLines[0]}
                              </p>
                            ) : null}

                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                              <span className="rounded-full bg-[#f5f7f3] px-3 py-1">
                                Min eligible spend: Rs {formatPrice(coupon.min_order_amount)}
                              </span>
                              <span className="rounded-full bg-[#f5f7f3] px-3 py-1">
                                Savings: Rs {formatPrice(coupon.discount_amount)}
                              </span>
                            </div>

                            {!isEligible && coupon.reason ? (
                              <p className="mt-3 text-sm leading-6 text-amber-700">
                                {coupon.reason}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex shrink-0 items-center gap-2 self-start">
                            {isApplied ? (
                              <button
                                type="button"
                                onClick={() => setSelectedCoupon(null)}
                                className="rounded-full border border-[#002424] px-4 py-2 text-sm font-medium text-[#002424] transition hover:bg-[#eef5ee]"
                              >
                                Remove
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={!isEligible}
                                onClick={() => setSelectedCoupon(coupon)}
                                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                                  isEligible
                                    ? "bg-[#002424] text-white hover:bg-[#013535]"
                                    : "cursor-not-allowed bg-gray-200 text-gray-500"
                                }`}
                              >
                                Apply
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-[1.5rem] bg-[#002424] px-5 py-5 text-white">
              <div className="flex justify-between text-sm text-white/70">
                <span>Items</span>
                <span>{itemCount}</span>
              </div>
              <div className="mt-3 flex justify-between text-sm text-white/70">
                <span>Subtotal</span>
                <span>Rs {formatPrice(total)}</span>
              </div>
              <div className="mt-3 flex justify-between text-sm text-white/70">
                <span>Coupon</span>
                <span>
                  {selectedCoupon
                    ? `- Rs ${formatPrice(selectedCouponDiscount)}`
                    : "Not applied"}
                </span>
              </div>
              {selectedCoupon ? (
                <div className="mt-2 flex justify-between text-sm text-emerald-200">
                  <span>{selectedCoupon.code}</span>
                  <span>Applied</span>
                </div>
              ) : null}
              <div className="mt-3 flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>Rs {formatPrice(payableTotal)}</span>
              </div>
            </div>

            {paymentError ? (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {paymentError}
              </div>
            ) : null}

            <div className="mt-5 rounded-[1.5rem] border border-[#dce7db] bg-white/80 px-4 py-3 text-sm text-gray-600">
              Prices and stock are rechecked on the server before payment starts and once more before stock is deducted.
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={paymentInitializing || !selectedAddress || !cart.length}
              className="mt-6 w-full rounded-2xl bg-black py-4 text-lg font-medium tracking-wide text-white transition-all hover:opacity-90 disabled:opacity-50"
            >
              {paymentInitializing ? "Starting Secure Payment..." : "Pay Now"}
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
