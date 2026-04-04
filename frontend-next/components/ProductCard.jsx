"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, ShoppingBag } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { normalizeCategory } from "@/lib/utils";
import { formatPrice } from "@/lib/formatPrice";

export default function ProductCard({ product }) {
  const { addToCart } = useStore();
  const [isAdding, setIsAdding] = useState(false);

  const categoryName = normalizeCategory(product.category)?.name;

  const requiresCustomization =
    product.stock_type === "variants" ||
    product.allow_custom_image ||
    product.allow_custom_text;

  const hasVariants = product.stock_type === "variants";

  const primaryVariant = hasVariants
    ? product.variants
        ?.filter((variant) => variant.stock > 0)
        ?.sort(
          (left, right) =>
            (left.slashed_price || left.mrp) - (right.slashed_price || right.mrp),
        )[0]
    : null;

  const noStock =
    (hasVariants && product.variants?.every((variant) => variant.stock === 0)) ||
    (!hasVariants && product.stock === 0);

  const handleAddToCart = async () => {
    if (isAdding) return;

    const price = hasVariants
      ? primaryVariant?.slashed_price || primaryVariant?.mrp
      : product.slashed_price || product.mrp;

    const cartItem = {
      id: product.id,
      product_id: product.id,
      title: product.title,
      price: Number(price),
      image: product.image,
      category: product.category,
      stock: hasVariants ? primaryVariant?.stock : product.stock,
      stock_type: product.stock_type,
      variant: hasVariants ? primaryVariant : null,
      qty: 1,
    };

    setIsAdding(true);
    try {
      await addToCart(cartItem);
    } finally {
      setTimeout(() => setIsAdding(false), 250);
    }
  };

  return (
    <div className="group relative rounded-2xl border border-gray-300 bg-[#F0FFF0] p-1 sm:p-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition-all duration-500 ease-out hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
      <Link href={`/products/${product.id}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-gray-50">
          <img
            src={product.image}
            alt={product.title}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-103"
          />
        </div>

        <div className="mb-1 mt-3 min-w-0 pr-12">
          <h3 className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold sm:text-base lg:text-lg">
            {product.title}
          </h3>

          {categoryName ? <p className="text-sm text-gray-500">{categoryName}</p> : null}

          {noStock ? (
            <p className="mt-1 font-semibold text-red-600">Out of stock</p>
          ) : hasVariants && primaryVariant ? (
            primaryVariant.slashed_price ? (
              <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 line-through sm:text-sm">
                    Rs {formatPrice(primaryVariant.mrp)}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 sm:text-base">
                    Rs {formatPrice(primaryVariant.slashed_price)}
                  </span>
                </div>
                <span className="inline-flex w-fit items-center self-start rounded-md bg-green-700 px-1.5 py-[2px] text-[10px] font-semibold text-white sm:rounded-full sm:px-2 sm:py-0.5 sm:text-xs">
                  {primaryVariant.discount_percent}% OFF
                </span>
              </div>
            ) : (
              <p className="mt-1 font-semibold text-gray-900">
                Rs {formatPrice(primaryVariant.mrp)}
              </p>
            )
          ) : product.slashed_price ? (
            <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 line-through sm:text-sm">
                  Rs {formatPrice(product.mrp)}
                </span>
                <span className="text-sm font-semibold text-gray-900 sm:text-base">
                  Rs {formatPrice(product.slashed_price)}
                </span>
              </div>
              <span className="inline-flex w-fit items-center self-start rounded-md bg-green-700 px-1.5 py-[2px] text-[10px] font-semibold text-white sm:rounded-full sm:px-2 sm:py-0.5 sm:text-xs">
                {product.discount_percent}% OFF
              </span>
            </div>
          ) : (
            <p className="mt-1 font-semibold text-gray-900">
              Rs {formatPrice(product.mrp)}
            </p>
          )}
        </div>
      </Link>

      <div className="absolute bottom-[0.625rem] right-[0.625rem]">
        {noStock ? (
          <Link href={`/products/${product.id}`}>
            <button
              type="button"
              className="rounded-full bg-gray-200 p-2 text-gray-800 transition-colors hover:bg-gray-300"
            >
              <img src="/out_of_stock.svg" alt="Out of stock" className="h-5 w-5" />
            </button>
          </Link>
        ) : requiresCustomization ? (
          <Link href={`/products/${product.id}`}>
            <button
              type="button"
              className="rounded-full bg-gray-200 p-2 text-gray-800 transition-colors hover:bg-gray-300"
            >
              <img src="/customize.svg" alt="Customize" className="h-5 w-5" />
            </button>
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isAdding}
            aria-label={isAdding ? "Adding to cart" : "Add to cart"}
            className={`rounded-full p-2 text-gray-800 transition-all duration-200 active:scale-95 ${
              isAdding
                ? "bg-black text-white shadow-lg shadow-black/20"
                : "bg-gray-200 hover:bg-gray-300"
            }`}
          >
            {isAdding ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <ShoppingBag size={20} />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
