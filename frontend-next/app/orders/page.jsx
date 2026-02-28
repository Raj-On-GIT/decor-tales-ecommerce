"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getMyOrders } from "@/lib/api";
import Link from "next/link";

export default function OrdersPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [loading, isAuthenticated]);

  useEffect(() => {
    async function loadOrders() {
      try {
        const data = await getMyOrders();
        setOrders(data.orders || []);
      } catch (err) {
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
    return <div className="p-6">Loading orders...</div>;
  }

  return (
    <div className="min-h-[60vh] bg-gray-50 p-6">
      <h1 className="text-3xl font-bold mb-6">My Orders</h1>

      {orders.length === 0 ? (
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600">No orders found yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="block bg-white p-6 rounded-lg shadow hover:shadow-md transition"
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">
                    Order #{order.order_number}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(order.created_at).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500">
                    {order.items_count} item(s)
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-bold">₹{order.total}</p>
                  <p className="text-sm capitalize text-gray-600">
                    {order.status}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}