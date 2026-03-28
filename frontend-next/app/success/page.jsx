"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import Link from "next/link";
import { CheckCircle } from "lucide-react";

export default function SuccessPage() {
  const { clearCart } = useStore();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const orderNumber = searchParams.get("orderNumber");

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 text-center">
      <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
      <h1 className="text-4xl font-bold text-gray-800 mb-2">
        Payment successful
      </h1>
      <p className="text-lg text-gray-600 mb-6">
        {orderNumber
          ? `Your payment for order ${orderNumber} has been verified and your order is now queued for processing.`
          : "Your payment was verified and your order is now queued for processing."}
      </p>

      <div className="flex gap-4">
        <Link
          href="/"
          className="px-6 py-3 bg-black text-white rounded-lg font-semibold text-sm hover:bg-gray-800 transition-colors"
        >
          Continue Shopping
        </Link>

        <Link
          href={orderId ? `/orders/${orderId}` : "/orders"}
          className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold text-sm hover:bg-gray-300 transition-colors"
        >
          View Order
        </Link>
      </div>
    </div>
  );
}
