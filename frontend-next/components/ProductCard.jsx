"use client";

import { ShoppingBag } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import Link from "next/link";
import { normalizeCategory } from "@/lib/utils";
import { formatPrice } from "@/lib/formatPrice";


export default function ProductCard({ product }) {
  const { addToCart } = useStore();
  const categoryName = normalizeCategory(product.category)?.name;

  const requiresCustomization =
  product.stock_type === "variants" ||
  product.allow_custom_image ||
  product.allow_custom_text;

  const hasVariants = product.stock_type === "variants";

  // ✅ Find first available variant (stock > 0)
  const primaryVariant = hasVariants
  ? product.variants
      ?.filter(v => v.stock > 0)
      ?.sort(
        (a, b) =>
          (a.slashed_price || a.mrp) -
          (b.slashed_price || b.mrp)
      )[0]
  : null;

  // ✅ Check if all variants are out of stock
  const noStock = (hasVariants && product.variants?.every(v => v.stock === 0)) || (!hasVariants && product.stock === 0);
  


  return (
    <div className="group">
      {/* ✅ Clicking opens Product Detail Page */}
      <Link href={`/products/${product.id}`}>
        <div className="aspect-[3/4] rounded-xl overflow-hidden bg-gray-100 relative cursor-pointer">
          <img
            src={product.image}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        </div>
      </Link>

      <div className="mt-4 flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <h3
            className="
              font-semibold

              text-sm sm:text-base lg:text-lg

              whitespace-nowrap
              overflow-hidden
              text-ellipsis
            "
          >
            {product.title}
          </h3>

          {categoryName && (
            <p className="text-gray-500 text-sm">{categoryName}</p>
          )}

          
          {/* ✅ Price Display */}

          {noStock ? (

            /* ❌ OUT OF STOCK (Main OR Variant) */
            <p className="text-red-600 font-semibold mt-1">
              Out of stock
            </p>

          ) : hasVariants && primaryVariant ? (

            /* 🔽 VARIANT PRICE (FIRST AVAILABLE) */
            primaryVariant.slashed_price ? (
              <div
                className="
                  flex flex-col
                  sm:flex-row sm:items-center
                  gap-1 sm:gap-2
                  mt-1
                "
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 line-through text-xs sm:text-sm">
                    ₹{formatPrice(primaryVariant.mrp)}
                  </span>

                  <span className="text-gray-900 font-semibold text-sm sm:text-base">
                    ₹{formatPrice(primaryVariant.slashed_price)}
                  </span>
                </div>

                <span
                  className="
                    bg-green-700 text-white

                    text-[10px] sm:text-xs
                    font-semibold

                    px-1.5 py-[2px]
                    sm:px-2 sm:py-0.5

                    rounded-md sm:rounded-full

                    inline-flex items-center
                    w-fit self-start
                  "
                >
                  {primaryVariant.discount_percent}% OFF
                </span>
              </div>
            ) : (
              <p className="text-gray-900 font-semibold mt-1">
                ₹{formatPrice(primaryVariant.mrp)}
              </p>
            )

          ) : (

            /* 🔽 MAIN STOCK — YOUR ORIGINAL CODE UNCHANGED */
            product.slashed_price ? (
              <div
                className="
                  flex flex-col
                  sm:flex-row sm:items-center
                  gap-1 sm:gap-2
                  mt-1
                "
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 line-through text-xs sm:text-sm">
                    ₹{formatPrice(product.mrp)}
                  </span>

                  <span className="text-gray-900 font-semibold text-sm sm:text-base">
                    ₹{formatPrice(product.slashed_price)}
                  </span>
                </div>


                <span
                  className="
                    bg-green-700 text-white

                    text-[10px] sm:text-xs
                    font-semibold

                    px-1.5 py-[2px]
                    sm:px-2 sm:py-0.5

                    rounded-md sm:rounded-full

                    inline-flex items-center
                    w-fit self-start
                  "
                >
                  {product.discount_percent}% OFF
                </span>
              </div>
            ) : (
              <p className="text-gray-900 font-semibold mt-1">
                ₹{formatPrice(product.mrp)}
              </p>
            )

          )}


        </div>

        
        {/* ❌ OUT OF STOCK BUTTON */}
        {noStock ? (

          <Link href={`/products/${product.id}`}>
          <button
            className="p-2 rounded-full
                      bg-gray-200 text-gray-800
                      hover:bg-gray-300
                      transition-colors"
          >
            <img src="/out_of_stock.svg" alt="Out of Stock" className="w-5 h-5" />
          </button>
          </Link>

        ) : requiresCustomization ? (

          /* 🔧 Customize Button */
          <Link href={`/products/${product.id}`}>
          <button
            className="p-2 rounded-full
               bg-gray-200 text-gray-800
               hover:bg-gray-300
               transition-colors"
          >
            <img
              src="/customize.svg"
              alt="Customize"
              className="w-5 h-5"
            />
          </button>
          </Link>

          ) : (

          /* 🛒 Add to Cart Button */
          <button

            onClick={() => {
              const price = hasVariants
                ? primaryVariant?.slashed_price || primaryVariant?.mrp
                : product.slashed_price || product.mrp;

              addToCart({
                id: hasVariants ? primaryVariant.id : product.id,
                title: product.title,
                price: price,
                image: product.image,
                category: product.category,
              });
            }}

            className="p-2 rounded-full
                      bg-gray-200 text-gray-800
                      hover:bg-gray-300
                      transition-colors"
          >
            <ShoppingBag size={20} />
          </button>

        )}

      </div>
    </div>
  );
}
