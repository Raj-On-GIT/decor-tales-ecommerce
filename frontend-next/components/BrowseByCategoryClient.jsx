"use client";

import Link from "next/link";
import Image from "next/image";

export default function BrowseByCategoryClient({ categories }) {
  if (!categories || categories.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-600">No categories available.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
      {categories.map(category => (
        <Link key={category.id} href={`/catalog/${category.slug}`}>
          <div className="group cursor-pointer">
            <div className="relative flex min-h-[220px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-[#F0FFDF] p-2 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-500 ease-out hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] sm:h-64">
              <div className="relative h-28 w-full overflow-hidden rounded-xl bg-gray-50 sm:h-40">
                {category.image ? (
                  <Image
                    src={category.image}
                    alt={category.name}
                    fill
                    style={{ objectFit: "cover" }}
                    className="transition-transform duration-500 ease-out group-hover:scale-103"
                    unoptimized={true}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gray-200">
                    <span className="text-gray-500">No Image</span>
                  </div>
                )}
              </div>

              <div className="mb-1 mt-2 text-center sm:mt-3">
                <h3 className="mb-1 text-base font-bold text-gray-900 sm:text-lg">
                  {category.name}
                </h3>

                <p className="text-xs text-gray-600 sm:text-sm">
                  {category.subcategoryCount > 0
                    ? `${category.subcategoryCount} subcategories`
                    : `${category.productCount} ${
                        category.productCount === 1 ? "product" : "products"
                      }`}
                </p>
              </div>

              <div className="absolute bottom-3 right-3 opacity-0 transition-opacity group-hover:opacity-100 sm:bottom-4 sm:right-4">
                <svg
                  className="h-5 w-5 text-gray-700"
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
      ))}
    </div>
  );
}
