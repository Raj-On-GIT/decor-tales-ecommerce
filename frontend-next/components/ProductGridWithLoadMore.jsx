"use client";

import { useState } from "react";
import ProductCard from "@/components/ProductCard";
import ViewportReveal from "@/components/ViewportReveal";
import { BACKEND } from "@/lib/api";

const PRODUCTS_PER_PAGE = 12;

export default function ProductGridWithLoadMore({
  initialProducts = [],
  count = 0,
  hasMore = false,
  apiPath,
  emptyMessage = "No products found.",
}) {
  const [products, setProducts] = useState(initialProducts);
  const [moreAvailable, setMoreAvailable] = useState(hasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const handleLoadMore = async () => {
    if (loadingMore) return;

    setLoadingMore(true);
    setError(null);

    try {
      const res = await fetch(
        `${BACKEND}${apiPath}?limit=${PRODUCTS_PER_PAGE}&offset=${products.length}`,
      );

      if (!res.ok) {
        throw new Error("Failed to load more products");
      }

      const data = await res.json();
      setProducts((prev) => [...prev, ...(data.products || [])]);
      setMoreAvailable(Boolean(data.has_more));
    } catch {
      setError("Couldn't load more products. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  };

  if (products.length === 0 && count === 0) {
    return <p className="text-center text-gray-500">{emptyMessage}</p>;
  }

  return (
    <div>
      <ViewportReveal
        stagger
        className="grid grid-cols-2 gap-5 sm:grid-cols-3 sm:gap-8 md:gap-10 lg:grid-cols-4"
      >
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </ViewportReveal>

      {moreAvailable && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-sm transition hover:border-gray-400 hover:bg-[#FAFAF9] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-black" />
                Loading more...
              </>
            ) : (
              "Load more products"
            )}
          </button>
        </div>
      )}

      {error && (
        <p className="mt-4 text-center text-sm text-rose-600">{error}</p>
      )}
    </div>
  );
}
