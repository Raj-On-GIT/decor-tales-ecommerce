"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import {
  getAddresses,
  getCart,
  createOrderWithAddress,
} from "@/lib/api";
import { useGlobalToast } from "@/context/ToastContext";

export default function CheckoutPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { replaceCart } = useStore();
  const router = useRouter();
  const { success, error } = useGlobalToast();

  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [cart, setCart] = useState([]);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadData() {
      try {
        const addr = await getAddresses();
        setAddresses(addr);

        const defaultAddr = addr.find((a) => a.is_default);
        if (defaultAddr) setSelectedAddress(defaultAddr.id);

        const cartData = await getCart();
        setCart(cartData.items || []);
      } catch {
        error("Failed to load checkout data");
      }
    }

    loadData();
  }, [isAuthenticated]);

  const total = cart.reduce(
    (sum, item) => sum + item.qty * Number(item.price),
    0
  );

  async function handlePlaceOrder() {
    if (!selectedAddress) {
      error("Please select a shipping address");
      return;
    }

    setPlacing(true);

    try {
      const response = await createOrderWithAddress(selectedAddress);

      replaceCart([]);
      success("Order placed successfully");

      router.push(`/orders/${response.order.id}`);
    } catch (err) {
      error(err.message);
    } finally {
      setPlacing(false);
    }
  }

  if (!cart.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F0FFDF] via-white to-[#FFECC0]">
        <p className="text-gray-600">Your cart is empty.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FFDF] via-white to-[#FFECC0] px-6 py-16">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16">

        {/* LEFT – Address Section */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/90 backdrop-blur rounded-3xl shadow-xl p-10"
        >
          <h2 className="text-3xl font-serif font-semibold mb-8">
            Shipping Address
          </h2>

          <div className="space-y-5">
            {addresses.map((addr) => (
              <label
                key={addr.id}
                className={`block p-6 rounded-2xl cursor-pointer transition-all duration-200 ${
                  selectedAddress === addr.id
                    ? "ring-2 ring-gray-900 bg-white"
                    : "bg-gray-50 hover:bg-gray-100"
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
                    <div className="font-semibold text-lg">
                      {addr.full_name}
                      {addr.is_default && (
                        <span className="ml-3 text-xs bg-black text-white px-3 py-1 rounded-full">
                          Default
                        </span>
                      )}
                    </div>

                    <div className="text-gray-600 mt-2 text-sm leading-relaxed">
                      {addr.address_line_1}
                      {addr.address_line_2 && `, ${addr.address_line_2}`}
                      <br />
                      {addr.city}, {addr.state} – {addr.postal_code}
                      <br />
                      Phone: {addr.phone}
                    </div>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </motion.div>

        {/* RIGHT – Order Summary */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/90 backdrop-blur rounded-3xl shadow-xl p-10"
        >
          <h2 className="text-3xl font-serif font-semibold mb-8">
            Order Summary
          </h2>

          <div className="space-y-6">
            {cart.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-16 h-16 rounded-xl object-cover"
                    />
                  )}
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-sm text-gray-500">
                      Qty: {item.qty}
                    </div>
                  </div>
                </div>

                <div className="font-medium">
                  ₹{(item.qty * Number(item.price)).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t mt-10 pt-6 flex justify-between text-lg font-semibold">
            <span>Total</span>
            <span>₹{total.toFixed(2)}</span>
          </div>

          <button
            onClick={handlePlaceOrder}
            disabled={placing}
            className="mt-10 w-full bg-black text-white py-4 rounded-2xl text-lg font-medium tracking-wide transition-all hover:opacity-90 disabled:opacity-50"
          >
            {placing ? "Placing Order..." : "Confirm & Place Order"}
          </button>
        </motion.div>

      </div>
    </div>
  );
}