"use client";

import Link from "next/link";
import { Heart, Loader2 } from "lucide-react";
import { useWishlist } from "@/context/WishlistContext";
import { useAuth } from "@/context/AuthContext";
import ProductCard from "@/components/ProductCard";
import ViewportReveal from "@/components/ViewportReveal";

export default function WishlistPage() {
  const { wishlist, wishlistReady, wishlistCount } = useWishlist();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const products = wishlist.map((item) => item.product);

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.26em] text-gray-500">
        {isAuthenticated ? "Your Account" : "Saved Items"}
      </p>
      <h1 className="mt-1 font-serif text-2xl font-bold text-gray-900 sm:text-4xl">
        My Wishlist
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        {wishlistReady
          ? `${wishlistCount} ${wishlistCount === 1 ? "item" : "items"} saved for later.`
          : "Loading your wishlist…"}
      </p>
      {!isAuthenticated && !authLoading && (
        <p className="mt-2 text-sm text-gray-500">
          Your wishlist is saved on this device.{" "}
          <Link
            href="/login"
            className="font-semibold text-[#1C1917] underline underline-offset-2 transition hover:text-[#002424]"
          >
            Sign in
          </Link>{" "}
          to keep it on all your devices.
        </p>
      )}

      <div className="mt-6 sm:mt-8">
        {!wishlistReady ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
            <Loader2 size={20} className="animate-spin opacity-50" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <Heart size={36} className="mx-auto mb-3 opacity-25" />
            <p>Your wishlist is empty.</p>
            <p className="mt-1 text-sm">
              Tap the heart on any product to save it here.
            </p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-full bg-[#1C1917] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#002424]"
            >
              Shop products
            </Link>
          </div>
        ) : (
          <ViewportReveal
            stagger
            className="grid grid-cols-2 gap-5 sm:grid-cols-3 sm:gap-8 md:gap-10 lg:grid-cols-4"
          >
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </ViewportReveal>
        )}
      </div>
    </div>
  );
}
