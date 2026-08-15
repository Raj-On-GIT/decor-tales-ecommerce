"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Shapes, ShoppingBag, Heart } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { useWishlist } from "@/context/WishlistContext";
import { useGlobalToast } from "@/context/ToastContext";
import { normalizeCategory } from "@/lib/utils";
import { formatPrice } from "@/lib/formatPrice";
import DiscountBadge from "@/components/DiscountBadge";

export default function ProductCard({ product, className = "" }) {
  const { addToCart } = useStore();
  const { toggleWishlist, isWishlisted, isWishlistPending } = useWishlist();
  const toast = useGlobalToast();
  const [isAdding, setIsAdding] = useState(false);

  const wishlisted = isWishlisted(product.id);
  const wishlistPending = isWishlistPending(product.id);

  const handleToggleWishlist = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (wishlistPending) return;

    const result = await toggleWishlist(product);

    if (result?.ok) {
      if (result.inWishlist) {
        toast.success("Added to wishlist", 1500);
      } else {
        toast.info("Removed from wishlist", 1500);
      }
    }
  };

  const categoryName = normalizeCategory(product.category)?.name;

  const hasCustomOptions =
    product.allow_custom_image || product.allow_custom_text;

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

  const priceInfo = hasVariants ? primaryVariant : product;

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
    <div className={`premium-card group relative p-1 sm:p-1.5 transition-all duration-500 ease-out hover:-translate-y-1 bg-[#FAFAF9] hover:bg-[#F0F0EF] rounded-xl border-[#E7E5E4] ${className}`}>
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
          ) : (
            <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <div className="flex items-center gap-2">
                {priceInfo.slashed_price ? (
                  <span className="text-xs text-[#A8A29E] line-through sm:text-sm">
                    ₹{formatPrice(priceInfo.mrp)}
                  </span>
                ) : null}
                <span className="text-sm font-semibold text-[#1C1917] sm:text-base">
                  ₹{formatPrice(priceInfo.slashed_price || priceInfo.mrp)}
                </span>
              </div>
              <DiscountBadge discountPercent={priceInfo.discount_percent} />
            </div>
          )}
        </div>
      </Link>

      {/* Wishlist Toggle */}
      <button
        type="button"
        onClick={handleToggleWishlist}
        disabled={wishlistPending}
        aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#1C1917] shadow-sm border border-[#E7E5E4] transition-all duration-300 active:scale-95 hover:shadow-md disabled:opacity-70"
      >
        {wishlistPending ? (
          <Loader2 size={18} className="animate-spin text-[#B91C1C]" />
        ) : (
          <Heart
            size={18}
            className={`transition-colors ${
              wishlisted ? "fill-[#B91C1C] text-[#B91C1C]" : "text-[#1C1917]"
            }`}
          />
        )}
      </button>

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
        ) : hasCustomOptions ? (
          <Link href={`/products/${product.id}`}>
            <button
              type="button"
              aria-label="Customize"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#1C1917] transition-all duration-300 hover:bg-[#1C1917] hover:text-white border border-[#E7E5E4] shadow-sm hover:shadow-md group/btn"
            >
              <img src="/customize.svg" alt="Customize" className="h-5 w-5 opacity-70 group-hover/btn:opacity-100 group-hover/btn:invert" />
            </button>
          </Link>
        ) : hasVariants ? (
          <Link href={`/products/${product.id}`}>
            <button
              type="button"
              aria-label="Choose variant"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#1C1917] transition-all duration-300 hover:bg-[#1C1917] hover:text-white border border-[#E7E5E4] shadow-sm hover:shadow-md group/btn"
            >
              <Shapes size={18} className="opacity-70 group-hover/btn:opacity-100" />
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
