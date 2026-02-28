"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { getOrderDetail } from "@/lib/api";

export default function OrderDetailPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const { id } = useParams();

  const [order, setOrder] = useState(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [loading, isAuthenticated]);

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
    return <div className="p-6">Loading order...</div>;
  }

  return (
    <div className="min-h-[60vh] bg-gray-50 p-6">
      <h1 className="text-3xl font-bold mb-6">
        Order #{order.order_number}
      </h1>

      <div className="bg-white p-6 rounded-lg shadow space-y-6">

        {/* Status */}
        <div>
          <p className="text-sm text-gray-500">Status</p>
          <p className="capitalize font-semibold">{order.status}</p>
        </div>

        {/* Shipping */}
        <div>
          <p className="text-sm text-gray-500">Shipping Address</p>
          <p>{order.shipping_address}</p>
          <p>{order.city}</p>
          <p>{order.postal_code}</p>
          <p>{order.phone}</p>
        </div>

        {/* Items */}
        <div>
          <p className="text-sm text-gray-500 mb-3">Items</p>
          <div className="space-y-3">
            {order.items.map((item, index) => (
              <div
                key={index}
                className="flex justify-between items-center border-b pb-3"
              >
                <div className="flex items-center gap-4">
                  {item.product.image && (
                    <img
                      src={item.product.image}
                      className="w-16 h-16 object-cover rounded"
                      alt=""
                    />
                  )}
                  <div>
                    <p className="font-medium">
                      {item.product.title}
                    </p>
                    <p className="text-sm text-gray-500">
                      Qty: {item.quantity}
                    </p>
                  </div>
                </div>

                <div className="font-semibold">
                  ₹{item.total}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="text-right">
          <p className="text-lg font-bold">
            Total: ₹{order.total}
          </p>
        </div>

      </div>
    </div>
  );
}