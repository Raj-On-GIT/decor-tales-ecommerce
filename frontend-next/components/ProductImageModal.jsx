"use client";

import { useState, useRef, useEffect } from "react";
import { useStore } from "@/context/StoreContext";
import { ShoppingBag } from "lucide-react";

export default function ProductImageModal({ product, isOpen, onClose }) {
  const { addToCart } = useStore();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [customText, setCustomText] = useState("");
  const carouselRef = useRef(null);
  
  const images = product.images || [];
  const variants = product.variants || [];
  const hasVariants = product.stock_type === 'variants' && variants.length > 0;

  useEffect(() => {
    if (isOpen) {
      setCurrentImageIndex(0);
      setSelectedVariant(null);
      setSelectedFile(null);
      setCustomText("");
    }
  }, [isOpen, product]);

  const handleNext = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrev = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowRight") handleNext();
    if (e.key === "ArrowLeft") handlePrev();
    if (e.key === "Escape") onClose();
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  const currentImage = images[currentImageIndex];

  const getVariantStock = () => {
    if (hasVariants && selectedVariant) {
      return selectedVariant.stock;
    }
    return product.total_stock || product.stock;
  };

  const getDisplayPrice = () => {

    // ✅ MAIN Stock Product Pricing
    if (product.stock_type === "main") {
      return {
        mrp: product.mrp,
        selling: product.slashed_price ?? product.mrp,
        discount: product.discount_percent,
      };
    }

    // ✅ VARIANT Stock Pricing (only when variant selected)
    if (product.stock_type === "variants" && selectedVariant) {
      return {
        mrp: selectedVariant.mrp,
        selling: selectedVariant.slashed_price ?? selectedVariant.mrp,
        discount: selectedVariant.discount_percent,
      };
    }

    // ✅ No price shown until variant chosen
    return null;
  };

  const priceData = getDisplayPrice();

  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    setTouchEnd(e.changedTouches[0].clientX);
    handleSwipe();
  };

  const handleSwipe = () => {
    if (touchStart - touchEnd > 50) {
      handleNext();
    }
    if (touchStart - touchEnd < -50) {
      handlePrev();
    }
  };

  const handleAddToCart = () => {
    const cartItem = {
      ...product,
      variant: selectedVariant || null,
      customFile: selectedFile,
      customText: customText || null,
    };
    addToCart(cartItem);
  };

  return (
    <div
      className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-3 border-b flex-shrink-0">
          <div className="flex-1">
            <h3 className="text-base font-bold">{product.title}</h3>
            {product.dimensions && (
              <p className="text-xs text-gray-600 mt-0.5">{product.dimensions}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-black text-2xl font-light w-8 h-8 flex items-center justify-center flex-shrink-0"
          >
            ×
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 min-h-0">
          {/* Image Carousel */}
          <div className="p-3">
            <div
              ref={carouselRef}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="bg-gray-50 rounded-lg overflow-hidden relative group cursor-grab active:cursor-grabbing"
            >
              <div className="relative w-full pt-[100%]">
                <img
                  src={currentImage?.image}
                  alt={currentImage?.alt_text || `${product.title} ${currentImageIndex + 1}`}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>

              {/* Image Counter */}
              <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white px-2 py-1 rounded-full text-xs">
                {currentImageIndex + 1} / {images.length}
              </div>

              {/* Navigation Arrows */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={handlePrev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-1 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={handleNext}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-1 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail Gallery */}
            {images.length > 1 && (
              <div className="mt-2">
                <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`flex-shrink-0 w-14 h-14 rounded border-2 overflow-hidden transition-all ${
                        idx === currentImageIndex
                          ? "border-black shadow-md"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      <img
                        src={img.image}
                        alt={`Thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Variant Selection */}
            {hasVariants && (
              <div className="border-t mt-3 pt-3">
                <h5 className="font-semibold text-gray-900 mb-2 text-xs">Select Variant</h5>
                <div className="flex flex-wrap gap-2">
                  {variants.map((variant) => (
                    <button
                      key={variant.id}
                      onClick={() => setSelectedVariant(variant)}
                      disabled={variant.stock === 0}
                      className={`px-3 py-1 rounded text-xs border-2 transition-all ${
                        selectedVariant?.id === variant.id
                          ? "border-black bg-black text-white"
                          : variant.stock === 0
                          ? "border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "border-gray-300 hover:border-black"
                      }`}
                    >
                      {variant.size && variant.color
                        ? `${variant.size} / ${variant.color}`
                        : variant.size || variant.color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* File Upload */}
            {product.allow_custom_image && (
              <div className="border-t mt-3 pt-3">
                <label className="font-semibold text-gray-900 mb-2 text-xs block">
                  Customize with your image (Optional)
                </label>
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs border border-gray-300 rounded p-2"
                />
                {selectedFile && (
                  <p className="text-xs text-gray-600 mt-1">Selected: {selectedFile.name}</p>
                )}
              </div>
            )}

            {/* Custom Text */}
            {product.allow_custom_text && (
              <div className="border-t mt-3 pt-3">
                <label className="font-semibold text-gray-900 mb-2 text-xs block">
                  Add custom text (Optional)
                </label>
                <textarea
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Enter your custom text here"
                  maxLength={200}
                  className="w-full text-xs border border-gray-300 rounded p-2 resize-none"
                  rows="3"
                />
                <p className="text-xs text-gray-500 mt-1">{customText.length}/200</p>
              </div>
            )}

            {/* Product Details */}
            <div className="border-t mt-3 pt-3 space-y-2 text-xs">
              {product.description && (
                <div>
                  <h5 className="font-semibold text-gray-900 mb-0.5">Details</h5>
                  <p className="text-gray-700 line-clamp-2">{product.description}</p>
                </div>
              )}

              {product.dimensions && (
                <div>
                  <h5 className="font-semibold text-gray-900 mb-0.5">Dimensions</h5>
                  <p className="text-gray-700">{product.dimensions}</p>
                </div>
              )}

              {product.material && (
                <div>
                  <h5 className="font-semibold text-gray-900 mb-0.5">Material</h5>
                  <p className="text-gray-700">{product.material}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="flex items-center justify-between p-3 border-t bg-gray-50 flex-shrink-0 gap-2">
          <div className="flex items-center gap-4">
            {/* ✅ Price Display */}
              {priceData ? (
                priceData.selling !== priceData.mrp ? (
                  <div className="flex items-center gap-2">

                    {/* Striked MRP */}
                    <span className="text-sm text-gray-500 line-through">
                      ₹{priceData.mrp}
                    </span>

                    {/* Selling Price */}
                    <span className="text-lg font-bold text-gray-900">
                      ₹{priceData.selling}
                    </span>

                    {/* Discount Badge */}
                    <span className="bg-red-600 text-white text-xs px-2 py-1 rounded">
                      {priceData.discount}% OFF
                    </span>
                  </div>
                ) : (
                  <p className="text-lg font-bold text-gray-900">
                    ₹{priceData.mrp}
                  </p>
                )
              ) : (
                hasVariants && (
                  <p className="text-lg font-semibold text-gray-400">
                    Select a variant to see price
                  </p>
                )
              )}

            <p className="text-xs text-gray-600">
              Stock: {getVariantStock()} available
            </p>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={getVariantStock() === 0 || (hasVariants && !selectedVariant)}
            className="px-4 py-2 bg-black text-white rounded-lg font-semibold text-xs flex items-center gap-2 hover:bg-gray-800 transition-colors whitespace-nowrap disabled:bg-gray-400"
          >
            <ShoppingBag size={16} />
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
