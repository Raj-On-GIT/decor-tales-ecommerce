"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getOrderDetail } from "@/lib/api";

function formatStatus(status = "") {
  return status.replaceAll("_", " ");
}

function getStatusClasses(status = "") {
  const normalized = status.toLowerCase();

  if (normalized.includes("delivered")) {
    return "bg-emerald-100 text-emerald-800";
  }

  if (normalized.includes("cancel")) {
    return "bg-rose-100 text-rose-700";
  }

  if (normalized.includes("shipped") || normalized.includes("dispatch")) {
    return "bg-sky-100 text-sky-700";
  }

  return "bg-amber-100 text-amber-800";
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
      } catch (err) {
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
        <div className="mx-auto max-w-screen-xl">
          <div className="rounded-[2rem] border border-white/70 bg-white/80 px-8 py-12 text-center shadow-[0_25px_70px_rgba(15,23,42,0.08)] backdrop-blur">
            <p className="text-lg font-medium text-gray-800">Loading order...</p>
          </div>
        </div>
      </section>
    );
  }

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
                <- Back to orders
              </Link>
              <h1 className="mt-3 font-serif text-3xl font-bold text-gray-900 sm:text-4xl">
                Order #{order.order_number}
              </h1>
            </div>

            <span
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] ${getStatusClasses(order.status)}`}
            >
              {formatStatus(order.status)}
            </span>
          </div>
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
                    Order Total
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-gray-900">
                    Rs {Number(order.total || 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
