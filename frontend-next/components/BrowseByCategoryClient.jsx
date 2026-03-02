"use client";

import Link from "next/link";
import Image from "next/image";

export default function BrowseByCategoryClient({ categories }) {
  if (!categories || categories.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No categories available.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {categories.map(category =>
      (
        <Link
          key={category.id}
          href={`/catalog/${category.slug}`}
        >
          <div className="group cursor-pointer">
            {/* Category Card */}
            <div className="bg-[#F0FFDF] rounded-2xl overflow-hidden h-64 flex flex-col items-center justify-between p-4 relative border border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] transition-all duration-500 ease-out hover:-translate-y-0.5 hover:border-gray-300">
              {/* Image */}
              <div className="w-full h-40 relative mb-4 rounded-lg overflow-hidden bg-gray-50">
                {category.image ? (
                  <Image
                    src={category.image}
                    alt={category.name}
                    fill
                    style={{ objectFit: "cover" }}
                    className="group-hover:scale-103 transition-transform duration-500 ease-out"
                    unoptimized={true}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-500">No Image</span>
                  </div>
                )}
              </div>
              
              {/* Content */}
              <div className="text-center">
                {/* Category Name */}
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  {category.name}
                </h3>
                
                {/* Product Count */}
                <p className="text-sm text-gray-600">
                  {category.subcategoryCount > 0
                    ? `${category.subcategoryCount} subcategories`
                    : `${category.productCount} ${
                        category.productCount === 1 ? "product" : "products"
                      }`}
                </p>

              </div>
          
              {/* Hover Arrow */}
              <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
