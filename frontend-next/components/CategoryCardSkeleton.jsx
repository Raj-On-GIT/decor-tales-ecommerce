"use client";

import { Skeleton } from "boneyard-js/react";
import { boneyardCategory } from "./boneyardCardFixtureData";
import CategoryCard from "./CategoryCard";

function CategoryCardFallback() {
  return (
    <div className="premium-card relative flex h-full flex-col overflow-hidden rounded-xl border-[#E7E5E4] bg-[#FAFAF9] p-1 sm:p-1.5">
      <div className="h-32 w-full shrink-0 animate-pulse rounded-xl bg-[#E7E5E4] sm:h-48" />
      <div className="mb-2 mt-3 flex flex-1 flex-col items-center justify-center space-y-2 px-2 text-center">
        <div className="h-5 w-3/4 animate-pulse rounded bg-[#E7E5E4] sm:h-6" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-[#E7E5E4] sm:h-4" />
      </div>
      <div className="absolute right-4 bottom-4 h-7 w-7 animate-pulse rounded-full bg-[#E7E5E4]" />
    </div>
  );
}

export default function CategoryCardSkeleton() {
  return (
    <Skeleton
      name="category-card"
      loading
      fallback={<CategoryCardFallback />}
      select="viewport"
    >
      <CategoryCard category={boneyardCategory} />
    </Skeleton>
  );
}
