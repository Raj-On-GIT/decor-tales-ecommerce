"use client";

import { ShoppingBag } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import Link from "next/link";
import { normalizeCategory } from "@/lib/utils";
import { formatPrice } from "@/lib/formatPrice";

// 🆕 Phase 7 imports
import {
  addToCart as addToCartAPI,
  getCart,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function ProductCard({ product }) {
const { addToCart, replaceCart } = useStore();
const { isAuthenticated } = useAuth(); // 🆕 Auth state

const categoryName = normalizeCategory(product.category)?.name;

const requiresCustomization =
product.stock_type === "variants" ||
product.allow_custom_image ||
product.allow_custom_text;

const hasVariants = product.stock_type === "variants";

// ✅ First available variant
const primaryVariant = hasVariants
? product.variants
?.filter((v) => v.stock > 0)
?.sort(
(a, b) =>
(a.slashed_price || a.mrp) -
(b.slashed_price || b.mrp)
)[0]
: null;

// ✅ Stock check
const noStock =
(hasVariants && product.variants?.every((v) => v.stock === 0)) ||
(!hasVariants && product.stock === 0);

// 🆕 Unified Add-to-Cart handler
const handleAddToCart = async () => {
  const price = hasVariants
    ? primaryVariant?.slashed_price || primaryVariant?.mrp
    : product.slashed_price || product.mrp;

  const cartItem = {
    id: null, // will be assigned by backend later
    product_id: product.id,  // 🔥 ADD THIS
    title: product.title,
    price: Number(price),
    image: product.image,
    category: product.category,
    stock: hasVariants
      ? primaryVariant?.stock
      : product.stock,
    stock_type: hasVariants
      ? "variant"
      : product.stock_type,
    variant: hasVariants ? primaryVariant : null,
  };

  /* ----------------------------- */
  /* Guest → Local cart            */
  /* ----------------------------- */
  if (!isAuthenticated) {
        addToCart({
      ...cartItem,
      qty: 1, // explicit increment
    });
    return;
  }

  /* ----------------------------- */
  /* Logged user → Server truth    */
  /* ----------------------------- */
  try {
    await addToCartAPI(
      product.id,
      1,
      cartItem.variant?.id || null
    );

    // 🔥 Instead of local increment,
    // reload cart from backend
    const data = await getCart();
    replaceCart(data.items);

  } catch (err) {
    console.error("Server cart add failed:", err);
  }
};

return ( <div className="group relative bg-[#F0FFDF] rounded-2xl p-2 border border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] transition-all duration-500 ease-out hover:-translate-y-0.5 hover:border-gray-300">

  {/* Product Link */}
  <Link href={`/products/${product.id}`}>
    <div className="aspect-[3/4] rounded-xl overflow-hidden bg-gray-50 relative cursor-pointer">
      <img
        src={product.image}
        alt={product.title}
        className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500 ease-out"
      />
    </div>
  </Link>

  <div className="mt-3 mb-1 flex justify-between items-start gap-2">
    <div className="flex-1 min-w-0">
      
      {/* Title */}
      <h3 className="font-semibold text-sm sm:text-base lg:text-lg whitespace-nowrap overflow-hidden text-ellipsis">
        {product.title}
      </h3>

      {categoryName && (
        <p className="text-gray-500 text-sm">
          {categoryName}
        </p>
      )}

      {/* Price Logic */}
      {noStock ? (
        <p className="text-red-600 font-semibold mt-1">
          Out of stock
        </p>

      ) : hasVariants && primaryVariant ? (

        primaryVariant.slashed_price ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 line-through text-xs sm:text-sm">
                ₹{formatPrice(primaryVariant.mrp)}
              </span>

              <span className="text-gray-900 font-semibold text-sm sm:text-base">
                ₹{formatPrice(primaryVariant.slashed_price)}
              </span>
            </div>

            <span className="bg-green-700 text-white text-[10px] sm:text-xs font-semibold px-1.5 py-[2px] sm:px-2 sm:py-0.5 rounded-md sm:rounded-full inline-flex items-center w-fit self-start">
              {primaryVariant.discount_percent}% OFF
            </span>
          </div>
        ) : (
          <p className="text-gray-900 font-semibold mt-1">
            ₹{formatPrice(primaryVariant.mrp)}
          </p>
        )

      ) : (

        product.slashed_price ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 line-through text-xs sm:text-sm">
                ₹{formatPrice(product.mrp)}
              </span>

              <span className="text-gray-900 font-semibold text-sm sm:text-base">
                ₹{formatPrice(product.slashed_price)}
              </span>
            </div>

            <span className="bg-green-700 text-white text-[10px] sm:text-xs font-semibold px-1.5 py-[2px] sm:px-2 sm:py-0.5 rounded-md sm:rounded-full inline-flex items-center w-fit self-start">
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

    {/* Buttons */}
    {noStock ? (

      <Link href={`/products/${product.id}`}>
        <button className="p-2 rounded-full bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors">
          <img src="/out_of_stock.svg" className="w-5 h-5" />
        </button>
      </Link>

    ) : requiresCustomization ? (

      <Link href={`/products/${product.id}`}>
        <button className="p-2 rounded-full bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors">
          <img src="/customize.svg" className="w-5 h-5" />
        </button>
      </Link>

    ) : (

      <button
        onClick={handleAddToCart}
        className="p-2 rounded-full bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors"
      >
        <ShoppingBag size={20} />
      </button>
    )}
  </div>
</div>

);
}
