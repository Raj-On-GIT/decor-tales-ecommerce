"use client";

import { useEffect } from 'react';
import { useStore } from '@/context/StoreContext';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';

export default function SuccessPage() {
  const { clearCart } = useStore();

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gray-50 text-center">
      <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
      <h1 className="text-4xl font-bold text-gray-800 mb-2">Thank you for your order!</h1>
      <p className="text-lg text-gray-600 mb-6">Your payment was successful and your order is being processed.</p>
      <div className="flex gap-4">
        <Link href="/catalog" className="px-6 py-3 bg-black text-white rounded-lg font-semibold text-sm hover:bg-gray-800 transition-colors">
          Continue Shopping
        </Link>
        <Link href="/orders" className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold text-sm hover:bg-gray-300 transition-colors">
          View Orders
        </Link>
      </div>
    </div>
  );
}
