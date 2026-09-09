"use client";

import { useMemo } from "react";
import ProductCard from "./ProductCard";
import { PRODUCT_GRID_CLASS } from "@/lib/utils";

export default function HomeGalleryClient({ products }) {
  // Filter products to show first 8
  const filteredProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    return products.slice(0, 8);
  }, [products]);

  return (
    <>
      {/* Product Grid */}
      <div className={PRODUCT_GRID_CLASS}>
        {filteredProducts.length > 0 ? (
          filteredProducts.map((p, index) => (
            <ProductCard
              key={p.id}
              product={p}
              className={index >= 6 ? "md:hidden lg:block" : undefined}
            />
          ))
        ) : (
          <p className="col-span-full text-center text-gray-600">
            No products found.
          </p>
        )}
      </div>
    </>
  );
}
