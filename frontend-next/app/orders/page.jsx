"use client";

export default function OrdersPage() {
  return (
    <div className="min-h-[60vh] bg-gray-50 p-6">
      <h1 className="text-3xl font-bold mb-4">My Orders</h1>

      <div className="bg-white p-6 rounded-lg shadow">
        <p className="text-gray-600">
          No orders found yet.
        </p>
      </div>
    </div>
  );
}
