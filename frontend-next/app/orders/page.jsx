"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getMyOrders } from "@/lib/api";
import CategoryTrail from "@/components/CategoryTrail";
import PriceDisplay from "@/components/PriceDisplay";

function formatOrderDate(value) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatStatus(status = "") {
  return status.replaceAll("_", " ");
}

function getStatusClasses(status = "") {
  const normalized = status.toLowerCase();

  if (normalized.includes("delivered")) {
    return "bg-emerald-100 text-emerald-800";
  }

  if (normalized.includes("paid")) {
    return "bg-teal-100 text-teal-800";
  }

  if (normalized.includes("cancel")) {
    return "bg-rose-100 text-rose-700";
  }

  if (normalized.includes("fail")) {
    return "bg-rose-100 text-rose-700";
  }

  if (normalized.includes("shipped") || normalized.includes("dispatch")) {
    return "bg-sky-100 text-sky-700";
  }

  return "bg-amber-100 text-amber-800";
}

export default function OrdersPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    async function loadOrders() {
      try {
        const data = await getMyOrders();
        setOrders(data.orders || []);
      } catch {
        console.error("Failed to fetch orders");
      } finally {
        setLoadingOrders(false);
      }
    }

    if (isAuthenticated) {
      loadOrders();
    }
  }, [isAuthenticated]);

  if (loadingOrders) {
    return (
      <section className="min-h-screen bg-gradient-to-br from-[#F0FFDF] via-white to-[#FFECC0] px-4 py-10 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-screen-xl">
          <div className="rounded-[2rem] border border-white/70 bg-white/80 px-8 py-12 text-center shadow-[0_25px_70px_rgba(15,23,42,0.08)] backdrop-blur">
            <p className="text-lg font-medium text-gray-800">Loading orders...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-gradient-to-br from-[#F0FFDF] via-white to-[#FFECC0] px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-screen-xl">
        <div className="mb-8 rounded-[2rem] border border-white/70 bg-white/70 px-6 py-7 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-800/70">
            Order History
          </p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-serif text-3xl font-bold text-gray-900 sm:text-4xl">
                Your recent purchases
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 sm:text-base">
                Track each order, review totals, and open the full order detail
                page when you need shipping and item information.
              </p>
            </div>

            <div className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700">
              {orders.length} order{orders.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-[2rem] border border-white/80 bg-white/90 px-8 py-12 text-center shadow-[0_25px_70px_rgba(15,23,42,0.08)] backdrop-blur">
            <p className="text-lg font-medium text-gray-800">No orders found yet.</p>
            <p className="mt-2 text-sm text-gray-500">
              Once you place an order, it will show up here.
            </p>
          </div>
        ) : (
          <div className="grid gap-5">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="group rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-[0_25px_70px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_30px_80px_rgba(15,23,42,0.12)]"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-serif text-2xl font-semibold text-gray-900">
                        Order #{order.order_number}
                      </p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${getStatusClasses(order.status)}`}
                      >
                        {formatStatus(order.status)}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-gray-500 sm:grid-cols-3">
                      <p>{formatOrderDate(order.created_at)}</p>
                      <p>{order.items_count} item(s)</p>
                      <p>Order ID: {order.id}</p>
                    </div>

                    {Array.isArray(order.items) && order.items.length > 0 ? (
                      <div className="mt-5 grid gap-3">
                        {order.items.slice(0, 2).map((item, index) => (
                          <div
                            key={`${order.id}-${item.product.id}-${index}`}
                            className="flex flex-col gap-3 rounded-[1.25rem] border border-gray-100 bg-[#fafcf7] p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              {item.product.image ? (
                                <Link href={`/products/${item.product.id}`} className="shrink-0">
                                  <img
                                    src={item.product.image}
                                    alt={item.product.title}
                                    className="h-14 w-14 rounded-lg object-cover"
                                  />
                                </Link>
                              ) : null}
                              <div className="min-w-0">
                                <Link
                                  href={`/products/${item.product.id}`}
                                  className="line-clamp-1 font-medium text-gray-900 transition hover:text-[#002424]"
                                >
                                  {item.product.title}
                                </Link>
                                <CategoryTrail
                                  category={item.product.category}
                                  subCategory={item.product.sub_category}
                                  className="mt-1 text-xs"
                                  linkClassName="rounded-full border border-[#dbe7d6] bg-white px-2 py-0.5 font-medium text-[#002424] transition hover:border-[#002424]"
                                  separatorClassName="text-gray-400"
                                />
                                {item.variant?.size_name || item.variant?.color_name ? (
                                  <p className="mt-1 text-xs text-gray-500">
                                    {[item.variant?.size_name, item.variant?.color_name]
                                      .filter(Boolean)
                                      .join(" | ")}
                                  </p>
                                ) : null}
                              </div>
                            </div>

                            <div className="sm:text-right">
                              <PriceDisplay
                                price={item.product.slashed_price || item.product.price}
                                originalPrice={item.variant?.mrp || item.product.mrp}
                                discountPercent={item.variant?.discount_percent || item.product.discount_percent}
                                className="sm:justify-end"
                                currentPriceClassName="text-sm"
                                originalPriceClassName="text-xs"
                                badgeClassName="px-2 py-0.5 text-[10px]"
                                currencyPrefix="Rs "
                              />
                              <p className="mt-1 text-xs text-gray-500">
                                Qty: {item.quantity}
                              </p>
                            </div>
                          </div>
                        ))}
                        {order.items.length > 2 ? (
                          <p className="text-xs text-gray-500">
                            +{order.items.length - 2} more item{order.items.length - 2 === 1 ? "" : "s"}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between gap-4 lg:block lg:text-right">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                        Total
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-gray-900">
                        Rs {Number(order.total || 0).toFixed(2)}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-[#002424] transition group-hover:translate-x-1">
                      View details {"->"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
