"use client";

import { useMemo } from "react";
import ProductCard from "./ProductCard";

export default function HomeGalleryClient({ products }) {
  // Filter products to show first 4
  const filteredProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    return products.slice(0, 4);
  }, [products]);

  return (
    <>
      {/* Product Grid */}
      <div
        className="
          grid

          grid-cols-2
          sm:grid-cols-2
          lg:grid-cols-4

          gap-5 sm:gap-8 md:gap-10
        "
      >
        {filteredProducts.length > 0 ? (
          filteredProducts.map((p) => <ProductCard key={p.id} product={p} />)
        ) : (
          <p className="col-span-full text-center text-gray-600">
            No products found.
          </p>
        )}
      </div>
    </>
  );
}
