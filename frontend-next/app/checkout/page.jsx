"use client";

import { useState } from "react";
import { useStore } from "@/context/StoreContext";
import { createOrder } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function CheckoutPage() {
  const { cart, total, clearCart } = useStore();
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
  });

  async function handleSubmit(e) {
    e.preventDefault();

    if (cart.length === 0) {
      alert("Cart is empty!");
      return;
    }

    const items = cart.map((item) => ({
      product: item.id,
      quantity: item.qty,
      price_at_purchase: item.price,
    }));

    const order = await createOrder({
      customer_name: form.name,
      customer_phone: form.phone,
      shipping_address: form.address,
      total_amount: total,
      items,
    });

    clearCart();

    router.push(`/success?token=${order.token}`);
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-serif font-bold mb-6">Checkout</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          required
          placeholder="Full Name"
          className="w-full border p-3 rounded"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        <input
          required
          placeholder="Phone Number"
          className="w-full border p-3 rounded"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />

        <textarea
          required
          placeholder="Shipping Address"
          className="w-full border p-3 rounded"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />

        <button className="w-full bg-black text-white py-3 rounded-lg font-bold">
          Place Order (₹{total})
        </button>
      </form>
    </div>
  );
}
