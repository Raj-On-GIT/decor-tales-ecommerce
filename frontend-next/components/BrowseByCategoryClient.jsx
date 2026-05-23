"use client";

import Link from "next/link";
import Image from "next/image";
import ViewportReveal from "./ViewportReveal";

export default function BrowseByCategoryClient({ categories, reveal = false }) {
  if (!categories || categories.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-600">No categories available.</p>
      </div>
    );
  }

  const gridClassName =
    "grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4";
  const content = categories.map((category) => (
    <Link key={category.id} href={`/catalog/${category.slug}`}>
      <div className="group cursor-pointer h-full">
        <div className="premium-card relative flex flex-col h-full overflow-hidden rounded-xl p-1 sm:p-1.5 transition-all duration-500 ease-out hover:-translate-y-1 bg-[#FAFAF9] border-[#E7E5E4]">
          <div className="relative h-32 w-full overflow-hidden rounded-xl bg-[#F5F5F4] sm:h-48 shrink-0">
            {category.image ? (
              <Image
                src={category.image}
                alt={category.name}
                fill
                style={{ objectFit: "cover" }}
                className="transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                unoptimized={true}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#E7E5E4]/50">
                <span className="text-[#A8A29E] text-sm">No Image</span>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col justify-center items-center mb-2 mt-3 px-2 text-center">
            <h3 className="mb-1 text-base font-bold text-[#1C1917] sm:text-lg">
              {category.name}
            </h3>

            <p className="text-xs text-[#78716C] sm:text-sm">
              {category.subcategoryCount > 0
                ? `${category.subcategoryCount} ${
                    category.subcategoryCount === 1 ? "subcategory" : "subcategories"
                  }`
                : `${category.productCount} ${
                    category.productCount === 1 ? "product" : "products"
                  }`}
            </p>
          </div>

          <div className="absolute bottom-4 right-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:bottom-4 sm:right-4 bg-white/80 backdrop-blur-sm rounded-full p-1.5 shadow-sm border border-[#E7E5E4]">
            <svg
              className="h-4 w-4 text-[#1C1917]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  ));

  if (reveal) {
    return (
      <ViewportReveal className={gridClassName} stagger>
        {content}
      </ViewportReveal>
    );
  }

  return <div className={gridClassName}>{content}</div>;
}