"use client";

import { Skeleton } from "boneyard-js/react";
import { boneyardProduct } from "./boneyardCardFixtureData";
import ProductCard from "./ProductCard";

function ProductCardFallback() {
  return (
    <div className="premium-card relative rounded-xl border-[#E7E5E4] bg-[#FAFAF9] p-1 sm:p-1.5">
      <div className="aspect-[3/4] animate-pulse rounded-xl bg-[#E7E5E4]" />
      <div className="mb-1 mt-3 min-w-0 space-y-2 pr-12 pl-1">
        <div className="h-4 w-4/5 animate-pulse rounded bg-[#E7E5E4] sm:h-5" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-[#E7E5E4] sm:h-4" />
        <div className="h-5 w-28 animate-pulse rounded bg-[#E7E5E4]" />
      </div>
      <div className="absolute right-[0.625rem] bottom-[0.625rem] h-10 w-10 animate-pulse rounded-full bg-[#E7E5E4]" />
    </div>
  );
}

export default function ProductCardSkeleton() {
  return (
    <Skeleton
      name="product-card"
      loading
      fallback={<ProductCardFallback />}
      select="viewport"
    >
      <ProductCard product={boneyardProduct} />
    </Skeleton>
  );
}
