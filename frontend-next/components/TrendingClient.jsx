"use client";

import { useMemo } from "react";
import ProductCard from "./ProductCard";

export default function TrendingClient({ products }) {
  const trendingProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    return products.slice(0, 20);
  }, [products]);

  if (trendingProducts.length === 0) return null;

  return (
    <div
      className="
        grid

        grid-cols-2
        sm:grid-cols-2
        lg:grid-cols-4

        gap-5 sm:gap-8 md:gap-10
      "
    >
      {trendingProducts.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
