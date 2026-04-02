"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2, ShoppingBag } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import ProductCard from "@/components/ProductCard";
import { getProducts } from "@/lib/api";
import { API_BASE } from "@/lib/config";
import { useAuth } from "@/context/AuthContext";
import { useGlobalToast } from "@/context/ToastContext";
import CategoryTrail from "@/components/CategoryTrail";
import PriceDisplay from "@/components/PriceDisplay";
import ProductDetailSkeleton from "@/components/ProductDetailSkeleton";
import { isProductOutOfStock } from "@/lib/utils";

const MAX_CUSTOM_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_CUSTOM_TEXT_LENGTH = 120;

export default function ProductDetailPage() {
  const { isAuthenticated } = useAuth();
  const { id } = useParams();
  const { cart, addToCart } = useStore();

  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]); // ✅ Related products state

  // ✅ Gallery State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);

  // ✅ Custom Inputs State
  const [customText, setCustomText] = useState("");
  const [customImages, setCustomImages] = useState([]);

  const [qty, setQty] = useState(1);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // ✅ Variant selection state
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);

  const [uploadResetKey, setUploadResetKey] = useState(0);

  // ✅ True while loadProduct() is setting the initial size+color
  const isInitialising = useRef(true);
  // ✅ Stores the numeric product id
  const productIdRef = useRef(null);
  const thumbScrollRef = useRef(null);

  const { error } = useGlobalToast();
  // ================= SCROLL TO TOP ON MOUNT =================
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [id]);

  // ================= FETCH PRODUCT =================
  useEffect(() => {
    if (!id) return;

    async function loadProduct() {
      try {
        // 1. Fetch Main Product
        const res = await fetch(`${API_BASE}/api/products/${id}/`)
        const data = await res.json();

        productIdRef.current = data.id;
        setProduct(data);
        setCurrentIndex(0);

        // 2. Fetch & Filter Related Products
        // Note: For better performance, consider a backend endpoint like /api/products/?category=...
        const allData = await getProducts();

        if (Array.isArray(allData)) {
          const relatedPool = allData.filter((p) => {
            if (p.id === data.id) return false;
            if (isProductOutOfStock(p)) return false;

            if (data.sub_category?.slug) {
              return p.sub_category?.slug === data.sub_category.slug;
            }

            return p.category?.slug === data.category?.slug;
          });

          const related = relatedPool
            .sort(
              (a, b) =>
                new Date(b.created_at || 0) - new Date(a.created_at || 0),
            )
            .slice(0, 8);

          setRelatedProducts(related);
        }

        // 3. Initialise Variants
        if (data.stock_type === "variants" && data.variants?.length) {
          const saved = sessionStorage.getItem(`selectedVariant_${data.id}`);

          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.size_name) setSelectedSize(parsed.size_name);
            if (parsed.color_name) setSelectedColor(parsed.color_name);
          } else {
            const available = data.variants.filter((v) => v.stock > 0);

            if (available.length) {
              const lowest = available.reduce((best, cur) => {
                const bestEffective = parseFloat(
                  best.slashed_price || best.mrp,
                );
                const curEffective = parseFloat(cur.slashed_price || cur.mrp);
                const bestMrp = parseFloat(best.mrp);
                const curMrp = parseFloat(cur.mrp);

                if (curEffective !== bestEffective)
                  return curEffective < bestEffective ? cur : best;
                if (curMrp !== bestMrp) return curMrp < bestMrp ? cur : best;
                return best;
              });
              if (lowest.size_name) setSelectedSize(lowest.size_name);
              if (lowest.color_name) setSelectedColor(lowest.color_name);
            }
          }
        }
      } catch (error) {
        console.error("Error loading product:", error);
      }
    }

    loadProduct();

    return () => {
      if (productIdRef.current)
        sessionStorage.removeItem(`selectedVariant_${productIdRef.current}`);
    };
  }, [id]);

  // ================= CLEAR INITIALISING FLAG =================
  useEffect(() => {
    if (
      isInitialising.current &&
      (selectedSize !== null || selectedColor !== null)
    ) {
      isInitialising.current = false;
    }
  }, [selectedSize, selectedColor]);

  // ================= AUTO SIZE SWITCH ON COLOR CHANGE =================
  useEffect(() => {
    if (!selectedColor || !product) return;
    if (isInitialising.current) return;

    const currentComboExists = product.variants.some(
      (v) => v.color_name === selectedColor && v.size_name === selectedSize,
    );

    if (!currentComboExists) {
      const fallback = product.variants.find(
        (v) => v.color_name === selectedColor && v.stock > 0,
      );
      if (fallback) setSelectedSize(fallback.size_name);
    }
  }, [selectedColor, product]);

  // ✅ Find selected variant
  const selectedVariant =
    product?.stock_type === "variants"
      ? product.variants.find(
          (v) =>
            (!selectedSize || v.size_name === selectedSize) &&
            (!selectedColor || v.color_name === selectedColor),
        )
      : null;

  // ================= SAVE SELECTED VARIANT =================
  useEffect(() => {
    if (!product || product.stock_type !== "variants") return;
    if (selectedSize === null && selectedColor === null) return;

    sessionStorage.setItem(
      `selectedVariant_${product.id}`,
      JSON.stringify({
        size_name: selectedSize,
        color_name: selectedColor,
      }),
    );
  }, [selectedSize, selectedColor, product]);

  // ================= THUMBNAIL NAVIGATION =================

  // Arrow buttons: scroll strip by 1 thumb
  const scrollThumbs = (dir) => {
    const el = thumbScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 72, behavior: "smooth" });
  };

  // Main carousel nav: scroll strip just enough to bring active thumb into view.
  // Uses the real copy (middle copy) position for the calculation.
  const ensureThumbVisible = (index) => {
    const el = thumbScrollRef.current;
    if (!el) return;
    const tw = 72;
    // No clone offset — just find thumb position directly
    const thumbLeft = index * tw;
    const thumbRight = thumbLeft + tw;
    const visLeft = el.scrollLeft;
    const visRight = el.scrollLeft + el.clientWidth;

    if (thumbLeft < visLeft) {
      // Thumb is off the left edge — scroll left to show it
      el.scrollBy({ left: thumbLeft - visLeft - 8, behavior: "smooth" });
    } else if (thumbRight > visRight) {
      // Thumb is off the right edge — scroll right to show it
      el.scrollBy({ left: thumbRight - visRight + 8, behavior: "smooth" });
    }
    // Already visible — do nothing, preserve user's scroll position
  };

  // ✅ Derive available sizes & colors
  const sizes = [
    ...new Set(
      product?.variants?.filter((v) => v.size_name)?.map((v) => v.size_name) ||
        [],
    ),
  ];

  const colors = [
    ...new Set(
      product?.variants
        ?.filter((v) => v.color_name)
        ?.map((v) => v.color_name) || [],
    ),
  ];

  const isVariantProduct = product?.stock_type === "variants";
  const activeStock = isVariantProduct
    ? selectedVariant?.stock
    : product?.stock;

  const isSizeAvailable = (size) =>
    product?.variants.some(
      (v) =>
        v.size_name === size &&
        (!selectedColor || v.color_name === selectedColor),
    );

  const isColorAvailable = (color) =>
    product?.variants.some((v) => v.color_name === color);

  if (!product) {
    return <ProductDetailSkeleton />;
  }

  // ✅ Combine Main + Gallery Images (deduplicated)
  const allImages = [
    product.image,
    ...(product.images?.map((img) => img.image) || []),
  ].filter((img, idx, arr) => img && arr.indexOf(img) === idx);

  // ✅ Infinite Carousel
  const goNext = () => {
    setCurrentIndex((prev) => {
      const next = (prev + 1) % allImages.length;
      ensureThumbVisible(next);
      return next;
    });
  };
  const goPrev = () => {
    setCurrentIndex((prev) => {
      const next = prev === 0 ? allImages.length - 1 : prev - 1;
      ensureThumbVisible(next);
      return next;
    });
  };

  // ✅ Swipe Support
  const handleTouchStart = (e) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e) => {
    if (!touchStart) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    if (diff > 50) goNext();
    if (diff < -50) goPrev();
    setTouchStart(null);
  };

  // ✅ Handle Custom Image Uploads
  const handleCustomImageUpload = (e, index) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.size > MAX_CUSTOM_IMAGE_SIZE_BYTES) {
      error("Each uploaded image must be 5 MB or smaller.");
      e.target.value = "";
      return;
    }

    const files = [...customImages];
    files[index] = file;
    setCustomImages(files);
  };

  return (
    <>
      <div className="mx-auto max-w-screen-xl px-4 pt-8 sm:px-6 sm:pt-10 lg:px-10">
        {/* ✅ Center Two-Column Layout */}
        <div className="mb-10 grid grid-cols-1 items-start gap-8 sm:gap-10 md:grid-cols-2 md:gap-12">
          {/* ================= LEFT: IMAGE VIEWER ================= */}
          <div className="flex flex-col items-center">
            {/* ✅ Main Carousel */}
            <div
              className="relative w-full aspect-square rounded-xl overflow-hidden bg-white"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <div
                className="flex h-full transition-transform duration-500 ease-in-out"
                style={{
                  transform: `translateX(-${currentIndex * 100}%)`,
                }}
              >
                {allImages.map((img, index) => (
                  <img
                    key={index}
                    src={img}
                    alt={`product-${index}`}
                    className="w-full h-full flex-shrink-0 object-contain bg-white"
                  />
                ))}
              </div>

              {allImages.length > 1 && (
                <>
                  <button
                    onClick={goPrev}
                    className="absolute left-1 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/25 p-2 hover:bg-white sm:block"
                  >
                    <img
                      src="/left_arrow.svg"
                      alt="left arrow"
                      className="w-5 h-5"
                    />
                  </button>

                  <button
                    onClick={goNext}
                    className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/25 p-2 hover:bg-white sm:block"
                  >
                    <img
                      src="/right_arrow.svg"
                      alt="right arrow"
                      className="w-5 h-5"
                    />
                  </button>
                </>
              )}
            </div>

            {/* ✅ Thumbnails */}
            {allImages.length > 1 && (
              <div className="relative mb-4 mt-4 flex w-full items-center justify-center gap-2 sm:mt-5">
                {/* Left arrow — only when > 5 images */}
                {allImages.length > 5 && (
                  <button
                    onClick={() => scrollThumbs(-1)}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center
                             rounded-full bg-white border border-gray-200
                             shadow hover:shadow-md hover:bg-gray-50 transition"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                )}

                {/* Scrollable infinite thumbnail strip */}
                <div
                  ref={thumbScrollRef}
                  className="flex max-w-full gap-2 overflow-x-auto scrollbar-none px-1 sm:max-w-sm sm:gap-3"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                  {allImages.map((img, index) => (
                    <img
                      key={index}
                      src={img}
                      onClick={() => setCurrentIndex(index)}
                      className={`h-14 w-14 flex-shrink-0 rounded-lg border cursor-pointer bg-white object-contain sm:h-15 sm:w-15 ${
                        index === currentIndex
                          ? "border-black"
                          : "border-gray-300"
                      }`}
                      alt="thumbnail"
                    />
                  ))}
                </div>

                {/* Right arrow — only when > 5 images */}
                {allImages.length > 5 && (
                  <button
                    onClick={() => scrollThumbs(1)}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center
                             rounded-full bg-white border border-gray-200
                             shadow hover:shadow-md hover:bg-gray-50 transition"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ================= RIGHT: PRODUCT DETAILS ================= */}
          <div className="flex h-full w-full flex-col px-0 sm:px-2">
            {/* ✅ TOP BLOCK */}
            <div className="flex h-full flex-col justify-center gap-5 sm:gap-6">
              {/* Title + Price */}
              <div>
                <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{product.title}</h1>
                <div className="mt-3">
                  <CategoryTrail
                    category={product.category}
                    subCategory={product.sub_category}
                    prefix="Viewing In:"
                    className="text-sm"
                    variant="chip"
                    chipClassName="p-2 bg-gray-100 text-gray-600"
                    linkClassName="text-gray-600 transition hover:text-gray-800 hover:underline underline-offset-2"
                  />
                </div>
                <p className="mt-4 text-sm leading-normal whitespace-normal text-justify text-gray-600 sm:text-base">
                  {product.description}
                </p>

                {/* ✅ Custom Image Upload Buttons */}
                {product.allow_custom_image && (
                  <>
                    <h3 className="mt-5 font-semibold">Upload Custom Images</h3>
                    <div className="mt-2 grid w-full grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-4">
                      {Array.from({ length: product.custom_image_limit }).map(
                        (_, index) => {
                          const selectedFile = customImages[index];

                          return (
                            <div
                              key={index}
                              className="flex w-full flex-col"
                            >
                              <label
                                className={`flex w-full items-center justify-center gap-2
                            rounded-lg border cursor-pointer
                            px-2 py-2 sm:px-3
                            text-xs font-medium sm:text-sm
                            hover:bg-gray-200 transition
                            ${
                              selectedFile
                                ? "border-black bg-gray-300"
                                : "border-gray-300"
                            }`}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="w-4 h-4 text-gray-700"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4m0 0l-4 4m4-4l4 4"
                                  />
                                </svg>
                                <span className="truncate">Upload: {index + 1}</span>
                                <input
                                  key={uploadResetKey}
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) =>
                                    handleCustomImageUpload(e, index)
                                  }
                                  className="hidden"
                                />
                              </label>

                              {selectedFile && (
                                <p className="mt-1 w-full truncate text-center text-xs text-gray-700">
                                  {selectedFile.name}
                                </p>
                              )}
                            </div>
                          );
                        },
                      )}
                    </div>
                  </>
                )}

                {/* ✅ Custom Text */}
                {product.allow_custom_text && (
                  <>
                    <h3 className="mt-3 font-semibold">Enter Custom Text</h3>

                    <textarea
                      rows={1}
                      value={customText}
                      maxLength={MAX_CUSTOM_TEXT_LENGTH}
                      onChange={(e) =>
                        setCustomText(e.target.value.slice(0, MAX_CUSTOM_TEXT_LENGTH))
                      }
                      placeholder="Enter text for engraving..."
                      className="mt-1 block w-full resize-none rounded-lg border border-gray-400 p-2 text-sm"
                    />
                    <p className="mt-1 text-right text-xs text-gray-500">
                      {customText.length}/{MAX_CUSTOM_TEXT_LENGTH}
                    </p>
                  </>
                )}

                {/* ✅ Variants */}
                {(product.stock_type === "variants"
                  ? product.variants?.length > 0
                  : true) && (
                  <>
                    <div className="flex flex-wrap gap-3">
                      {product.stock_type === "variants" &&
                        product.variants?.length > 0 && (
                          <div className="space-y-3">
                            {sizes.length > 0 && (
                              <div>
                                <h3 className="mb-1 text-base font-semibold sm:text-lg">
                                  Select Size
                                </h3>
                                <div className="flex flex-wrap gap-2 sm:gap-3">
                                  {sizes.map((size) => (
                                    <button
                                      key={size}
                                      disabled={!isSizeAvailable(size)}
                                      onClick={() => setSelectedSize(size)}
                                      className={`border rounded-lg px-3 py-2 text-sm transition sm:px-4 sm:py-1
                                  ${
                                    selectedSize === size
                                      ? "bg-black text-white"
                                      : "hover:bg-gray-300"
                                  }
                                  ${
                                    !isSizeAvailable(size)
                                      ? "opacity-40 cursor-not-allowed"
                                      : ""
                                  }
                                `}
                                    >
                                      {size}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {colors.length > 0 && (
                              <div>
                                <h3 className="mb-1 text-base font-semibold sm:text-lg">
                                  Select Color
                                </h3>
                                <div className="flex flex-wrap gap-2 sm:gap-3">
                                  {colors.map((color) => (
                                    <button
                                      key={color}
                                      disabled={!isColorAvailable(color)}
                                      onClick={() => setSelectedColor(color)}
                                      className={`border rounded-lg px-3 py-2 text-sm transition sm:px-4 sm:py-1
                                  ${
                                    selectedColor === color
                                      ? "bg-black text-white"
                                      : "hover:bg-gray-300"
                                  }
                                  ${
                                    !isColorAvailable(color)
                                      ? "opacity-40 cursor-not-allowed"
                                      : ""
                                  }
                                `}
                                    >
                                      {color}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                  </>
                )}

                {/* ✅ Stock Availability */}
                {activeStock !== undefined &&
                  activeStock !== null &&
                  (activeStock === 0 ? (
                    <div className="mt-4 flex items-center gap-2 text-sm">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                        Stock
                      </span>
                      <span className="font-medium text-red-700">Out of stock</span>
                    </div>
                  ) : activeStock <= 3 ? (
                    <div className="mt-4 flex items-center gap-2 text-sm">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                        Stock
                      </span>
                      <span className="font-medium text-red-600">Only {activeStock} left</span>
                    </div>
                  ) : null)}

                {/* ✅ Price Block */}
                {product.stock_type === "variants" && selectedVariant ? (
                  <PriceDisplay
                    className="sm:mt-6 mt-3 gap-3"
                    price={selectedVariant.slashed_price || selectedVariant.mrp}
                    originalPrice={selectedVariant.mrp}
                    discountPercent={selectedVariant.discount_percent}
                    currentPriceClassName="text-2xl sm:text-3xl"
                    originalPriceClassName="text-base sm:text-lg"
                    badgeClassName="px-3 py-1 text-xs sm:text-sm"
                    currencyPrefix="₹"
                  />
                ) : (
                  <div className="mt-3">
                    <PriceDisplay
                      price={product.slashed_price || product.mrp}
                      originalPrice={product.mrp}
                      discountPercent={product.discount_percent}
                      currentPriceClassName="text-2xl sm:text-3xl"
                      originalPriceClassName="text-base sm:text-lg"
                      badgeClassName="px-3 py-1 text-xs sm:text-sm"
                      currencyPrefix="₹"
                    />
                  </div>
                )}

                {/* ✅ Qty Selector + Add to Cart Inline */}
                <div className="sm:mt-6 mt-4 flex items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
                  {/* Qty Controls */}
                  <div className="flex min-w-0 basis-3/10 items-center justify-center overflow-hidden rounded-xl border">
                    <button
                      onClick={() => setQty((prev) => Math.max(1, prev - 1))}
                      className="flex-1 px-3 py-2 text-base hover:bg-gray-200 sm:px-4 sm:text-lg"
                    >
                      -
                    </button>

                    <span className="whitespace-nowrap px-2 py-2 text-center text-xs leading-none font-semibold sm:px-4 sm:text-base">
                      Qty {qty}
                    </span>

                    <button
                      onClick={() => setQty((prev) => prev + 1)}
                      className="flex-1 px-3 py-2 text-base hover:bg-gray-200 sm:px-4 sm:text-lg"
                    >
                      +
                    </button>
                  </div>

                  {/* ✅ Add to Cart Button */}
                  <button
                    disabled={
                      (product.stock_type === "variants" && !selectedVariant) ||
                      activeStock === 0 ||
                      isAddingToCart
                    }
                    onClick={async () => {
                      if (isAddingToCart) return;

                      const price =
                        product.stock_type === "variants"
                          ? selectedVariant?.slashed_price ||
                            selectedVariant?.mrp
                          : product.slashed_price || product.mrp;

                      const cartPayload = {
                        ...product,
                        price,
                        variant: selectedVariant,
                        qty,
                        customText: customText?.trim() || null,
                        customImages:
                          customImages.length > 0 ? customImages : null,
                      };

                      if (!isAuthenticated && customImages.length > 0) {
                        error(
                          "Please log in before adding products with custom image uploads.",
                        );
                        return;
                      }

                      const availableStock =
                        selectedVariant?.stock ?? product.stock ?? 0;

                      // 🔥 Count ALL items of the same variant already in cart
                      const sameVariantTotal = cart
                        .filter(
                          (x) =>
                            x.product_id === product.id &&
                            (x.variant?.id || null) ===
                              (selectedVariant?.id || null),
                        )
                        .reduce((sum, x) => sum + x.qty, 0);

                      const remainingStock = availableStock - sameVariantTotal;

                      if (remainingStock <= 0) {
                        error(
                          `Only ${availableStock} item${
                            availableStock > 1 ? "s" : ""
                          } available in stock.`,
                        );

                        setQty(1); // 🔥 reset selector
                        return;
                      }

                      let quantityToAdd = qty;

                      if (qty > remainingStock) {
                        quantityToAdd = remainingStock;

                        error(
                          `Only ${availableStock} item${
                            availableStock > 1 ? "s" : ""
                          } available in stock.`,
                        );
                      }

                      try {
                        setIsAddingToCart(true);

                        const result = await addToCart({
                          ...cartPayload,
                          qty: quantityToAdd,
                        });

                        if (result?.ok) {
                          setCustomText("");
                          setCustomImages([]);
                          setUploadResetKey((k) => k + 1);
                          setQty(1);
                        }
                      } catch (err) {
                        error(err.message || "Unable to add item to cart");
                      } finally {
                        setTimeout(() => setIsAddingToCart(false), 250);
                      }
                    }}
                    className={`flex min-w-0 basis-7/10 items-center justify-center gap-2 rounded-xl py-3 transition sm:flex-1
                  ${
                    isAddingToCart
                      ? "bg-black text-white cursor-wait"
                      : (product.stock_type === "variants" && !selectedVariant) ||
                          activeStock === 0
                      ? "bg-red-600 text-white cursor-not-allowed"
                      : "bg-black text-white hover:bg-gray-800 active:scale-[0.99]"
                  }
                `}
                  >
                    {isAddingToCart ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Adding...
                      </>
                    ) : activeStock === 0 ? (
                      <>
                        <span className="font-semibold">Out of Stock</span>
                      </>
                    ) : (
                      <>
                        {/* 🛒 Normal state */}
                        <ShoppingBag size={20} />
                        Add to Cart
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================= SIMILAR PRODUCTS SECTION ================= */}
        {relatedProducts.length > 0 && (
          <section className="mb-10 mt-16 sm:mt-24">
            {/* Heading Row */}
            <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-serif text-2xl font-bold text-black sm:text-4xl">
                  Similar products
                </h2>
                <p className="mt-1 text-sm text-gray-600 sm:mt-2 sm:text-base">
                  Discover more from{" "}
                  {product.sub_category?.name || product.category?.name}.
                </p>
              </div>

              <Link
                href={
                  product.sub_category
                    ? `/catalog/${product.category?.slug}/${product.sub_category?.slug}`
                    : `/catalog/${product.category?.slug}`
                }
                className="inline-flex self-start items-center gap-2 text-sm font-bold underline sm:self-auto"
              >
                <span>View All</span>
                <Image
                  src="/right_arrow.svg"
                  alt=""
                  width={16}
                  height={16}
                  className="h-4 w-4"
                  aria-hidden="true"
                />
              </Link>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 gap-4 sm:gap-8 md:gap-10 lg:grid-cols-4">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

