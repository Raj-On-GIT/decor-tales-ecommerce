"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { formatPrice } from "@/lib/formatPrice";
// ✅ Import ProductCard (Ensure this path matches your project structure)
import ProductCard from "@/components/ProductCard";
import Footer from "@/components/Footer";

export default function ProductDetailPage() {
  const { id } = useParams();
  const { addToCart } = useStore();

  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]); // ✅ Related products state

  // ✅ Gallery State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);

  // ✅ Custom Inputs State
  const [customText, setCustomText] = useState("");
  const [customImages, setCustomImages] = useState([]);

  const [qty, setQty] = useState(1);

  // ✅ Variant selection state
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);

  // ✅ True while loadProduct() is setting the initial size+color
  const isInitialising = useRef(true);
  // ✅ Stores the numeric product id
  const productIdRef = useRef(null);
  const thumbScrollRef = useRef(null);

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
        const res = await fetch(`http://127.0.0.1:8000/api/products/${id}/`);
        const data = await res.json();
        
        productIdRef.current = data.id;
        setProduct(data);
        setCurrentIndex(0);

        // 2. Fetch & Filter Related Products
        // Note: For better performance, consider a backend endpoint like /api/products/?category=...
        const allRes = await fetch("http://127.0.0.1:8000/api/products/");
        const allData = await allRes.json();

        if (Array.isArray(allData)) {
            // Prefer subcategory match first, fall back to category
            const inSubCategory = data.sub_category
              ? allData.filter(
                  (p) =>
                    p.sub_category?.slug === data.sub_category.slug &&
                    p.id !== data.id
                )
              : [];

            const inCategory = allData.filter(
              (p) =>
                p.category?.slug === data.category?.slug &&
                p.id !== data.id &&
                !inSubCategory.find((s) => s.id === p.id)
            );

            // Subcategory products first, then fill up with same-category products
            const pool =
              inSubCategory.length > 0
                ? [...inSubCategory, ...inCategory]
                : inCategory;

            const related = pool
              .sort(
                (a, b) =>
                  new Date(b.created_at || 0) - new Date(a.created_at || 0)
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
                const bestEffective = parseFloat(best.slashed_price || best.mrp);
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
      (v) => v.color_name === selectedColor && v.size_name === selectedSize
    );

    if (!currentComboExists) {
      const fallback = product.variants.find(
        (v) => v.color_name === selectedColor && v.stock > 0
      );
      if (fallback) setSelectedSize(fallback.size_name);
    }
  }, [selectedColor, product]);

  // ✅ Find selected variant
  const selectedVariant =
    product?.stock_type === "variants"
      ? product.variants.find(
          (v) =>
            (!selectedSize || v.size_name === selectedSize) && (!selectedColor || v.color_name === selectedColor)
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
      })
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
    const thumbLeft  = index * tw;
    const thumbRight = thumbLeft + tw;
    const visLeft    = el.scrollLeft;
    const visRight   = el.scrollLeft + el.clientWidth;

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
        []
    ),
  ];

  const colors = [
    ...new Set(
      product?.variants
        ?.filter((v) => v.color_name)
        ?.map((v) => v.color_name) || []
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
        (!selectedColor || v.color_name === selectedColor)
    );

  const isColorAvailable = (color) =>
    product?.variants.some((v) => v.color_name === color);

  if (!product) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5">
      {/* Spinning ring */}
      <div className="relative w-15 h-15">
        <div className="absolute inset-0 rounded-full border-10 border-gray-200 dark:border-gray-700" />
        <div className="absolute inset-0 rounded-full border-10 border-transparent border-t-black dark:border-t-white animate-spin" />
      </div>
      {/* Pulsing text */}
      <p className="text-sm font-medium tracking-widest text-gray-400 dark:text-gray-500 animate-pulse">
        Loading...
      </p>
    </div>
  );

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
    const files = [...customImages];
    files[index] = e.target.files[0];
    setCustomImages(files);
  };



  return (
    <>
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 pt-5">
      {/* ✅ Center Two-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start px-15 mb-10">
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
                  className="absolute left-1 top-1/2 -translate-y-1/2 bg-white/25 p-2 rounded-full hover:bg-white"
                >
                  <img
                    src="/left_arrow.svg"
                    alt="left arrow"
                    className="w-5 h-5"
                  />
                </button>

                <button
                  onClick={goNext}
                  className="absolute right-1 top-1/2 -translate-y-1/2 bg-white/25 p-2 rounded-full hover:bg-white"
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
            <div className="relative mt-5 mb-4 w-full flex items-center justify-center gap-2">

              {/* Left arrow — only when > 5 images */}
              {allImages.length > 5 && (
                <button
                  onClick={() => scrollThumbs(-1)}
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center
                             rounded-full bg-white border border-gray-200
                             shadow hover:shadow-md hover:bg-gray-50 transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
                       viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6"/>
                  </svg>
                </button>
              )}

              {/* Scrollable infinite thumbnail strip */}
              <div
                ref={thumbScrollRef}

                className="flex gap-3 overflow-x-auto scrollbar-none max-w-sm"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {allImages.map((img, index) => (
                  <img
                    key={index}
                    src={img}
                    onClick={() => setCurrentIndex(index)}
                    className={`flex-shrink-0 w-15 h-15 rounded-lg border cursor-pointer object-contain bg-white p-1 ${
                      index === currentIndex ? "border-black" : "border-gray-300"
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
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
                       viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
              )}

            </div>
          )}
        </div>

        {/* ================= RIGHT: PRODUCT DETAILS ================= */}
        <div className="flex flex-col w-full px-2 h-full">
          {/* ✅ TOP BLOCK */}
          <div className="flex flex-col justify-center h-full gap-6">
            {/* Title + Price */}
            <div>
              <h1 className="text-4xl font-bold">{product.title}</h1>
              <p className="text-gray-700 mt-2">In: {product.category?.name}</p>
              <p className="text-gray-600 mt-2 leading-relaxed whitespace-normal text-justify">
                {product.description}
              </p>

              {/* ✅ Custom Image Upload Buttons */}
              {product.allow_custom_image && (
                <>
                  <h3 className="font-semibold mt-5">Upload Custom Images</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1 w-full">
                    {Array.from({ length: product.custom_image_limit }).map(
                      (_, index) => {
                        const selectedFile = customImages[index];

                        return (
                          <div
                            key={index}
                            className="flex flex-col items-center"
                          >
                            <label
                              className={`flex items-center justify-center gap-2
                            border rounded-lg cursor-pointer
                            px-2 py-1 w-full
                            text-sm font-medium
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
                              Upload: {index + 1}
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                  handleCustomImageUpload(e, index)
                                }
                                className="hidden"
                              />
                            </label>

                            {selectedFile && (
                              <p className="text-xs text-gray-700 mt-1 w-full text-center truncate">
                                {selectedFile.name}
                              </p>
                            )}
                          </div>
                        );
                      }
                    )}
                  </div>
                </>
              )}

              {/* ✅ Custom Text */}
              {product.allow_custom_text && (
                <>
                  <h3 className="font-semibold mt-3">Enter Custom Text</h3>

                  <textarea
                    rows={1}
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="Enter text for engraving..."
                    className="block w-full border rounded-lg p-2 text-sm resize-none mt-1"
                  />
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
                        <div className="mt-5 space-y-3">
                          {sizes.length > 0 && (
                            <div>
                              <h3 className="text-lg font-semibold mb-1">
                                Select Size
                              </h3>
                              <div className="flex flex-wrap gap-3">
                                {sizes.map((size) => (
                                  <button
                                    key={size}
                                    disabled={!isSizeAvailable(size)}
                                    onClick={() => setSelectedSize(size)}
                                    className={`px-4 py-1 border rounded-lg transition
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
                              <h3 className="text-lg font-semibold mb-1">
                                Select Color
                              </h3>
                              <div className="flex flex-wrap gap-3">
                                {colors.map((color) => (
                                  <button
                                    key={color}
                                    disabled={!isColorAvailable(color)}
                                    onClick={() => setSelectedColor(color)}
                                    className={`px-4 py-1 border rounded-lg transition
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
                  <p className="text-sm text-red-700 font-semibold mt-3">
                    Out of stock
                  </p>
                ) : activeStock <= 3 ? (
                  <p className="text-sm text-red-600 font-semibold mt-3">
                    Only {activeStock} left
                  </p>
                ) : (
                  <p className="text-sm text-gray-600 mt-3">
                    Available stock: {activeStock}
                  </p>
                ))}

              {/* ✅ Price Block */}
              {product.stock_type === "variants" && selectedVariant ? (
                <div className="flex items-center gap-3 mt-3">
                  {selectedVariant.slashed_price && (
                    <span className="text-gray-500 line-through text-lg">
                      ₹{formatPrice(selectedVariant.mrp)}
                    </span>
                  )}

                  <span className="text-black font-bold text-3xl">
                    ₹
                    {formatPrice(
                      selectedVariant.slashed_price || selectedVariant.mrp
                    )}
                  </span>

                  {selectedVariant.discount_percent && (
                    <span className="bg-green-700 text-white text-sm px-3 py-1 rounded-full">
                      {selectedVariant.discount_percent}% OFF
                    </span>
                  )}
                </div>
              ) : (
                <div className="mt-3">
                  {product.slashed_price ? (
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 line-through text-lg">
                        ₹{formatPrice(product.mrp)}
                      </span>
                      <span className="text-black font-bold text-3xl">
                        ₹{formatPrice(product.slashed_price)}
                      </span>
                      <span className="bg-green-700 text-white text-sm px-3 py-1 rounded-full">
                        {product.discount_percent}% OFF
                      </span>
                    </div>
                  ) : (
                    <h2 className="text-3xl font-bold">
                      ₹{formatPrice(product.mrp)}
                    </h2>
                  )}
                </div>
              )}

              {/* ✅ Qty Selector + Add to Cart Inline */}
              <div className="flex items-center gap-4 mt-4">
                {/* Qty Controls */}
                <div className="flex items-center border rounded-xl overflow-hidden">
                  <button
                    onClick={() => setQty((prev) => Math.max(1, prev - 1))}
                    className="px-4 py-2 text-lg hover:bg-gray-200"
                  >
                    -
                  </button>

                  <span className="px-4 py-2 font-semibold">Qty {qty}</span>

                  <button
                    onClick={() => setQty((prev) => prev + 1)}
                    className="px-4 py-2 text-lg hover:bg-gray-200"
                  >
                    +
                  </button>
                </div>

                {/* ✅ Add to Cart Button */}
                <button
                  disabled={
                    (product.stock_type === "variants" && !selectedVariant) ||
                    activeStock === 0
                  }
                  onClick={() => {
                    const price =
                      product.stock_type === "variants"
                        ? selectedVariant?.slashed_price || selectedVariant?.mrp
                        : product.slashed_price || product.mrp;

                    addToCart({
                      ...product,
                      price: price,
                      variant: selectedVariant,
                      qty,
                      customText,
                      customImages,
                    });
                  }}
                  className={`w-full flex-1 flex items-center justify-center gap-2
                  py-3 rounded-xl transition
                  ${
                    (product.stock_type === "variants" && !selectedVariant) ||
                    activeStock === 0
                      ? "bg-red-600 text-white cursor-not-allowed"
                      : "bg-black text-white hover:bg-gray-800"
                  }
                `}
                >
                  {activeStock === 0 ? (
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
        <section className="mt-20 sm:mt-24 mb-10">
          {/* Heading Row */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-8">
            <div>
              <h2 className="font-serif font-bold text-black text-2xl sm:text-4xl">
                Similar products
              </h2>
              <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
                Discover more from {product.category?.name}.
              </p>
            </div>

            <a
              href={
                product.sub_category
                  ? `/catalog/${product.category?.slug}/${product.sub_category?.slug}`
                  : `/catalog/${product.category?.slug}`
              }
              className="text-sm font-bold underline self-start sm:self-auto"
            >
              View All →
            </a>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-8 md:gap-10">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
    <Footer />
    </>
  );
}