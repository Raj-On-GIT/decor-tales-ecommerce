"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getOrderDetail } from "@/lib/api";
import PageLoader from "@/components/ui/PageLoader";

const ORDER_PROGRESS_STEPS = [
  { key: "pending", label: "Pending" },
  { key: "paid", label: "Paid" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
];

function formatStatus(status = "") {
  return status.replaceAll("_", " ");
}

function normalizeOrderStatus(status = "") {
  const normalized = status.toLowerCase().replaceAll("_", " ").trim();

  if (normalized.includes("cancel")) return "cancelled";
  if (normalized.includes("fail")) return "failed";
  if (normalized.includes("deliver")) return "delivered";
  if (normalized.includes("ship") || normalized.includes("dispatch")) return "shipped";
  if (normalized.includes("process")) return "processing";
  if (normalized.includes("paid")) return "paid";
  return "pending";
}

function getStatusClasses(status = "") {
  const normalized = normalizeOrderStatus(status);

  if (normalized === "delivered") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (normalized === "cancelled" || normalized === "failed") {
    return "bg-rose-100 text-rose-700";
  }

  if (normalized === "shipped") {
    return "bg-sky-100 text-sky-700";
  }

  if (normalized === "paid") {
    return "bg-teal-100 text-teal-800";
  }

  return "bg-amber-100 text-amber-800";
}

function OrderProgress({ status }) {
  const normalizedStatus = normalizeOrderStatus(status);
  const currentStepIndex = ORDER_PROGRESS_STEPS.findIndex(
    (step) => step.key === normalizedStatus,
  );

  return (
    <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-[#d7ead6] bg-[linear-gradient(135deg,rgba(240,255,223,0.95),rgba(255,255,255,0.98),rgba(226,247,245,0.92))] p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-900/55">
            Order Progress
          </p>
          <p className="mt-2 text-lg font-semibold text-gray-900">
            {normalizedStatus === "delivered"
              ? "Delivered successfully"
              : normalizedStatus === "paid"
                ? "Payment verified"
              : `Currently ${formatStatus(status)}`}
          </p>
        </div>
        <p className="text-sm text-gray-600">
          {currentStepIndex + 1} of {ORDER_PROGRESS_STEPS.length} completed
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {ORDER_PROGRESS_STEPS.map((step, index) => {
          const isCompleted = index <= currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isLast = index === ORDER_PROGRESS_STEPS.length - 1;

          return (
            <div key={step.key} className="relative">
              {!isLast && (
                <div className="absolute left-[calc(50%+1rem)] right-[-1rem] top-4 hidden h-[3px] rounded-full bg-[#d6e9df] sm:block">
                  <div
                    className={`h-full rounded-full transition-all ${
                      index < currentStepIndex ? "w-full bg-[#0f766e]" : "w-0 bg-[#0f766e]"
                    }`}
                  />
                </div>
              )}

              <div className="relative flex items-center gap-3 rounded-[1.25rem] border border-white/70 bg-white/75 px-4 py-3 backdrop-blur sm:block sm:min-h-[132px] sm:px-5 sm:py-5">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition sm:h-10 sm:w-10 ${
                    isCompleted
                      ? "border-[#0f766e] bg-[#0f766e] text-white shadow-[0_10px_25px_rgba(15,118,110,0.24)]"
                      : "border-[#c5d4ce] bg-white text-gray-500"
                  }`}
                >
                  {index + 1}
                </div>

                <div className="min-w-0">
                  <p
                    className={`text-sm font-semibold uppercase tracking-[0.18em] ${
                      isCompleted ? "text-teal-900" : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {isCurrent
                      ? "Current update"
                      : isCompleted
                        ? "Completed"
                        : "Awaiting"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const { id } = useParams();

  const [order, setOrder] = useState(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    async function loadOrder() {
      try {
        const data = await getOrderDetail(id);
        setOrder(data.order);
      } catch {
        console.error("Failed to load order");
      }
    }

    if (isAuthenticated && id) {
      loadOrder();
    }
  }, [isAuthenticated, id]);

  if (!order) {
    return (
      <section className="min-h-screen bg-gradient-to-br from-[#F0FFDF] via-white to-[#FFECC0] px-4 py-10 sm:px-6 sm:py-12">
        <div className="mx-auto flex min-h-[60vh] max-w-screen-xl items-center justify-center rounded-[2rem] border border-white/70 bg-white/70 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <PageLoader text="Loading order..." />
        </div>
      </section>
    );
  }

  const normalizedStatus = normalizeOrderStatus(order.status);
  const isCancelled = normalizedStatus === "cancelled";
  const isFailed = normalizedStatus === "failed";

  return (
    <section className="min-h-screen bg-gradient-to-br from-[#F0FFDF] via-white to-[#FFECC0] px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-screen-xl">
        <div className="mb-8 rounded-[2rem] border border-white/70 bg-white/70 px-6 py-7 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Link
                href="/orders"
                className="text-sm font-medium text-[#002424] transition hover:text-black"
              >
                {"<-"} Back to orders
              </Link>
              <h1 className="mt-3 font-serif text-3xl font-bold text-gray-900 sm:text-4xl">
                Order #{order.order_number}
              </h1>
            </div>

            {isCancelled || isFailed ? (
              <span
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] ${getStatusClasses(order.status)}`}
              >
                {formatStatus(order.status)}
              </span>
            ) : null}
          </div>

          {!isCancelled && !isFailed ? <OrderProgress status={order.status} /> : null}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-[0_25px_70px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="font-serif text-3xl font-semibold text-gray-900">
                Items in this order
              </h2>
              <div className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600">
                {order.items.length} item{order.items.length === 1 ? "" : "s"}
              </div>
            </div>

            <div className="space-y-4">
              {order.items.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-4 rounded-[1.5rem] border border-gray-100 bg-white/90 p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex items-center gap-4">
                    {item.product.image && (
                      <img
                        src={item.product.image}
                        className="h-20 w-20 rounded-xl object-cover"
                        alt={item.product.title}
                      />
                    )}

                    <div>
                      <p className="font-medium text-gray-900">
                        {item.product.title}
                      </p>

                      {item.variant && (
                        <p className="mt-1 text-sm text-gray-500">
                          {item.variant.size_name &&
                            `Size: ${item.variant.size_name}`}
                          {item.variant.color_name &&
                            `${item.variant.size_name ? " | " : ""}Color: ${item.variant.color_name}`}
                        </p>
                      )}

                      <p className="mt-1 text-sm text-gray-500">
                        Qty: {item.quantity}
                      </p>

                      {(item.custom_text ||
                        item.custom_image ||
                        item.custom_images?.length > 0) && (
                        <details className="mt-2 text-sm">
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
                                {item.custom_images.map((image, imageIndex) => (
                                  <img
                                    key={`order-custom-${imageIndex}`}
                                    src={image}
                                    alt={`custom-${imageIndex + 1}`}
                                    className="h-16 w-16 rounded-lg border object-cover"
                                  />
                                ))}
                              </div>
                            ) : item.custom_image ? (
                              <div className="flex flex-wrap gap-2">
                                <img
                                  src={item.custom_image}
                                  alt="custom"
                                  className="h-16 w-16 rounded-lg border object-cover"
                                />
                              </div>
                            ) : null}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      Rs {Number(item.total || 0).toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-500">
                      Rs {Number(item.price || 0).toFixed(2)} each
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6 xl:sticky xl:top-24 xl:h-fit">
            <div className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-[0_25px_70px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">
              <h2 className="font-serif text-3xl font-semibold text-gray-900">
                Delivery details
              </h2>
              <div className="mt-6 space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                    Shipping Address
                  </p>
                  <div className="mt-2 text-sm leading-7 text-gray-700">
                    <p>{order.shipping_address}</p>
                    <p>{order.city}</p>
                    <p>{order.postal_code}</p>
                    <p>{order.phone}</p>
                  </div>
                </div>

                <div className="rounded-[1.5rem] bg-[#f8faef] px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                    Price Breakdown
                  </p>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Subtotal</span>
                      <span>Rs {Number(order.subtotal || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Coupon</span>
                      <span>
                        {order.coupon_code
                          ? `- Rs ${Number(order.discount || 0).toFixed(2)}`
                          : "Not applied"}
                      </span>
                    </div>
                    {order.coupon_code ? (
                      <div className="flex items-center justify-between text-sm text-emerald-700">
                        <span>{order.coupon_code}</span>
                        <span>Applied</span>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between border-t border-[#d7e5cf] pt-3 text-lg font-semibold text-gray-900">
                      <span>Total</span>
                      <span>Rs {Number(order.total || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
