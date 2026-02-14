"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { formatPrice } from "@/lib/formatPrice";


export default function ProductDetailPage() {
  const { id } = useParams();
  const { addToCart } = useStore();

  const [product, setProduct] = useState(null);

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

  // ✅ True while loadProduct() is setting the initial size+color so that
  //    the AUTO SIZE SWITCH effect does not stomp over them.
  const isInitialising = useRef(true);
  // ✅ Stores the numeric product id so the cleanup can clear the right sessionStorage key
  const productIdRef = useRef(null);



  // ================= FETCH PRODUCT =================
  useEffect(() => {
    if (!id) return;

    async function loadProduct() {
      const res = await fetch(
        `http://127.0.0.1:8000/api/products/${id}/`
      );

      const data = await res.json();
      productIdRef.current = data.id;
      setProduct(data);
      setCurrentIndex(0);

      // Initialise variant selection in one place so there are no race
      // conditions between multiple useEffects firing on the same render.
      if (data.stock_type === "variants" && data.variants?.length) {
        // 1️⃣  Prefer whatever the user had selected before the reload
        const saved = sessionStorage.getItem(`selectedVariant_${data.id}`);

        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.size_name)  setSelectedSize(parsed.size_name);
          if (parsed.color_name) setSelectedColor(parsed.color_name);
        } else {
          // 2️⃣  Nothing saved → auto-select the lowest-priced in-stock variant
          const available = data.variants.filter((v) => v.stock > 0);

          if (available.length) {
            const lowest = available.reduce((best, cur) => {
              const bestEffective = parseFloat(best.slashed_price || best.mrp);
              const curEffective  = parseFloat(cur.slashed_price  || cur.mrp);
              const bestMrp = parseFloat(best.mrp);
              const curMrp  = parseFloat(cur.mrp);

              if (curEffective !== bestEffective) return curEffective < bestEffective ? cur : best;
              if (curMrp !== bestMrp)             return curMrp < bestMrp ? cur : best;
              return best;
            });
            if (lowest.size_name)  setSelectedSize(lowest.size_name);
            if (lowest.color_name) setSelectedColor(lowest.color_name);
          }
        }
      }

    }

    loadProduct();

    // Clear the saved variant when the user leaves this page so that
    // coming back from the gallery always starts fresh on the lowest-price variant.
    return () => {
      if (productIdRef.current) sessionStorage.removeItem(`selectedVariant_${productIdRef.current}`);
    };
  }, [id]);





  // ================= CLEAR INITIALISING FLAG =================
  // Flip isInitialising to false only after React has committed the size+color
  // state that loadProduct() set. This prevents AUTO SIZE SWITCH from running
  // during the render cycle where the initial values are being applied.
  useEffect(() => {
    if (isInitialising.current && (selectedSize !== null || selectedColor !== null)) {
      isInitialising.current = false;
    }
  }, [selectedSize, selectedColor]);

  // ================= AUTO SIZE SWITCH ON COLOR CHANGE =================
  // Only reset the size when the currently-selected size does not exist for
  // the newly-selected color. If the size IS available, keep it as-is.
  // Skip entirely during the initial load — loadProduct() already sets both
  // color and size atomically, so we must not interfere.
  useEffect(() => {
    if (!selectedColor || !product) return;
    if (isInitialising.current) return;

    // Check whether the current size is valid for this color
    const currentComboExists = product.variants.some(
      (v) => v.color_name === selectedColor && v.size_name === selectedSize
    );

    if (!currentComboExists) {
      // Fall back to the first available size for this color
      const fallback = product.variants.find(
        (v) => v.color_name === selectedColor && v.stock > 0
      );
      if (fallback) setSelectedSize(fallback.size_name);
    }
  }, [selectedColor, product]);


    // ✅ Find selected variant (works for size-only, color-only, both)
  const selectedVariant =
    product?.stock_type === "variants"
      ? product.variants.find(
          (v) =>
            (!selectedSize || v.size_name === selectedSize) &&
            (!selectedColor || v.color_name === selectedColor),
        )
      : null;
  
  // ================= SAVE SELECTED VARIANT =================
  // Only persist once the user (or the initialiser) has actually set a value.
  // Skipping when both are null prevents overwriting a saved variant before
  // the fetch initialiser has had a chance to restore it.
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


  

  // ✅ Derive available sizes & colors from variants
const sizes = [
  ...new Set(
    product?.variants
      ?.filter((v) => v.size_name)
      ?.map((v) => v.size_name) || []
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


  const isOutOfStock = activeStock === 0;

  const isSizeAvailable = (size) =>
    product?.variants.some(
      (v) =>
        v.size_name === size &&
        (!selectedColor || v.color_name === selectedColor),
    );

  const isColorAvailable = (color) =>
    product?.variants.some((v) => v.color_name === color);

  if (!product) return <h2 className="p-10">Loading...</h2>;

  // ✅ Combine Main + Gallery Images
  const allImages = [
    product.image,
    ...(product.images?.map((img) => img.image) || []),
  ];

  // ✅ Infinite Carousel
  const goNext = () => setCurrentIndex((prev) => (prev + 1) % allImages.length);

  const goPrev = () =>
    setCurrentIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));

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
    <div className="max-w-6xl mx-auto px-6 py-5">
      {/* ✅ Center Two-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
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
                  <img src="/left_arrow.svg" alt="left arrow" className="w-5 h-5"/>
                </button>

                <button
                  onClick={goNext}
                  className="absolute right-1 top-1/2 -translate-y-1/2 bg-white/25 p-2 rounded-full hover:bg-white"
                >
                  <img src="/right_arrow.svg" alt="right arrow" className="w-5 h-5"/>
                </button>
              </>
            )}
          </div>

          {/* ✅ Thumbnails */}
          {allImages.length > 1 && (
            <div className="flex gap-3 mt-5 flex-wrap justify-center">
              {allImages.map((img, index) => (
                <img
                  key={index}
                  src={img}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-20 h-20 rounded-lg border cursor-pointer object-contain bg-white p-1 ${
                    index === currentIndex ? "border-black" : "border-gray-300"
                  }`}
                  alt="thumbnail"
                />
              ))}
            </div>
          )}
        </div>

        {/* ================= RIGHT: PRODUCT DETAILS ================= */}
        <div className="flex flex-col w-full px-2 h-full">
          {/* ✅ TOP BLOCK (same height as image) */}
          <div className="flex flex-col justify-center h-full gap-6">
            {/* Title + Price */}
            <div>
              <h1 className="text-4xl font-bold">{product.title}</h1>
              <p className="text-gray-700 mt-2">In: {product.category}</p>
              <p className="text-gray-600 mt-2 leading-relaxed whitespace-normal text-justify">
                {product.description}
              </p>

              {/* ✅ Custom Image Upload Buttons */}
              {product.allow_custom_image && (
                <>
                  <h3 className="font-semibold mt-5">Upload Custom Images</h3>

                  {/* ✅ Grid: Max 4 per row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1 w-full">
                    {Array.from({ length: product.custom_image_limit }).map(
                      (_, index) => {
                        const selectedFile = customImages[index];

                        return (
                          <div
                            key={index}
                            className="flex flex-col items-center"
                          >
                            {/* ✅ Upload Button */}
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
                              {/* ✅ Upload Icon */}
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
                              {/* ✅ Inline Text */}
                              Upload: {index + 1}
                              {/* ✅ Hidden File Input */}
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                  handleCustomImageUpload(e, index)
                                }
                                className="hidden"
                              />
                            </label>

                            {/* ✅ File Name Display */}
                            {selectedFile && (
                              <p className="text-xs text-gray-700 mt-1 w-full text-center truncate">
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
                    {/* ================= VARIANT SELECTION ================= */}
                    {product.stock_type === "variants" &&
                      product.variants?.length > 0 && (
                        <div className="mt-5 space-y-3">
                          {/* ✅ Size Selector */}
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

                          {/* ✅ Color Selector */}
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
                  /* ❌ Out of stock */
                  <p className="text-sm text-red-700 font-semibold mt-3">
                    Out of stock
                  </p>
                ) : activeStock <= 3 ? (
                  /* 🔴 Low stock */
                  <p className="text-sm text-red-600 font-semibold mt-3">
                    Only {activeStock} left
                  </p>
                ) : (
                  /* 🟢 Normal stock */
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
                    ₹{formatPrice(selectedVariant.slashed_price || selectedVariant.mrp)}
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
                    <h2 className="text-3xl font-bold">₹{formatPrice(product.mrp)}</h2>
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
                    (product.stock_type === "variants" && !selectedVariant) || (activeStock === 0)
                  }
                  onClick={() => {

                    const price =
                      product.stock_type === "variants"
                        ? selectedVariant?.slashed_price || selectedVariant?.mrp
                        : product.slashed_price || product.mrp;

                    addToCart({
                      ...product,
                      price: formatPrice(price),
                      variant: selectedVariant,
                      qty,
                      customText,
                      customImages,
                    })

                  }}
                  className={`w-full flex-1 flex items-center justify-center gap-2
                  py-3 rounded-xl transition
                  ${
                    (product.stock_type === "variants" && !selectedVariant) || (activeStock === 0)
                      ? "bg-red-600 text-white cursor-not-allowed"
                      : "bg-black text-white hover:bg-gray-800"
                  }
                `}
                >
                  {activeStock === 0 ? (
                    <>
                      <span className="font-semibold"> 
                      Out of Stock</span>
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
    </div>
  );
}