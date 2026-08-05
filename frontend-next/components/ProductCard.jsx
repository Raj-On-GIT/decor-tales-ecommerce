"use client";

import { useState } from "react";
import Image from "next/image";
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
    <div className="premium-card group relative p-1 sm:p-1.5 transition-all duration-500 ease-out hover:-translate-y-1 bg-[#FAFAF9] hover:bg-[#F0F0EF] rounded-xl border-[#E7E5E4]">
      <Link href={`/products/${product.id}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-[#F5F5F4]">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            />
          ) : null}
        </div>

        <div className="mb-1 mt-3 min-w-0 pr-12 pl-1">
          <h3 className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-[#1C1917] sm:text-base lg:text-lg">
            {product.title}
          </h3>

          {categoryName ? <p className="text-sm text-[#78716C]">{categoryName}</p> : null}

          {noStock ? (
            <p className="mt-1 font-semibold text-red-600">Out of stock</p>
          ) : hasVariants && primaryVariant ? (
            primaryVariant.slashed_price ? (
              <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#A8A29E] line-through sm:text-sm">
                    ₹{formatPrice(primaryVariant.mrp)}
                  </span>
                  <span className="text-sm font-semibold text-[#1C1917] sm:text-base">
                    ₹{formatPrice(primaryVariant.slashed_price)}
                  </span>
                </div>
              <span className="inline-flex w-fit items-center rounded-md bg-[#E6CCBE] px-1.5 py-[2px] text-[10px] font-semibold text-[#1C1917] sm:rounded-full sm:px-2 sm:py-0.5 sm:text-xs tracking-wide">
                {primaryVariant.discount_percent}% OFF
              </span>
              </div>
            ) : (
              <p className="mt-1 font-semibold text-[#1C1917]">
                ₹{formatPrice(primaryVariant.mrp)}
              </p>
            )
          ) : product.slashed_price ? (
            <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#A8A29E] line-through sm:text-sm">
                  ₹{formatPrice(product.mrp)}
                </span>
                <span className="text-sm font-semibold text-[#1C1917] sm:text-base">
                  ₹{formatPrice(product.slashed_price)}
                </span>
              </div>
              <span className="inline-flex w-fit items-center rounded-md bg-[#E6CCBE] px-1.5 py-[2px] text-[10px] font-semibold text-[#1C1917] sm:rounded-full sm:px-2 sm:py-0.5 sm:text-xs tracking-wide">
                {product.discount_percent}% OFF
              </span>
            </div>
          ) : (
            <p className="mt-1 font-semibold text-[#1C1917]">
              ₹{formatPrice(product.mrp)}
            </p>
          )}
        </div>
      </Link>

      <div className="absolute bottom-[0.625rem] right-[0.625rem]">
        {noStock ? (
          <Link href={`/products/${product.id}`}>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600 transition-colors hover:bg-red-100 border border-red-100"
            >
              <img src="/out_of_stock.svg" alt="Out of stock" className="h-5 w-5 opacity-70" />
            </button>
          </Link>
        ) : requiresCustomization ? (
          <Link href={`/products/${product.id}`}>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#1C1917] transition-all duration-300 hover:bg-[#1C1917] hover:text-white border border-[#E7E5E4] shadow-sm hover:shadow-md group/btn"
            >
              <img src="/customize.svg" alt="Customize" className="h-5 w-5 opacity-70 group-hover/btn:opacity-100 group-hover/btn:invert" />
            </button>
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isAdding}
            aria-label={isAdding ? "Adding to cart" : "Add to cart"}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 active:scale-95 shadow-sm hover:shadow-md border border-[#E7E5E4] ${
              isAdding
                ? "bg-[#D4A373] text-[#1C1917] border-[#D4A373]"
                : "bg-white text-[#1C1917] hover:bg-[#1C1917] hover:text-white hover:border-[#1C1917]"
            }`}
          >
            {isAdding ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <ShoppingBag size={18} className="transition-transform group-hover:scale-110" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
