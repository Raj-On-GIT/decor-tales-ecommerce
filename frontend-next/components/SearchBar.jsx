"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { searchProducts } from "@/lib/api";
import { Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

export default function SearchBar({ isOpen, onClose, isMobile = false }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const latestQueryRef = useRef("");
  const router = useRouter();
  const handleClose = useCallback(() => {
    setQuery("");
    setResults(null);
    onClose();
  }, [onClose]);

  // Focus input
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 200);
    return () => clearTimeout(timer);
  }, [handleClose, isOpen]);

  // Debounced search with race protection
  useEffect(() => {
    if (!query || query.length < 3) {
      setResults(null);
      return;
    }

    latestQueryRef.current = query;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const data = await searchProducts(query);
        if (latestQueryRef.current === query) {
          setResults(data);
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        if (latestQueryRef.current === query) {
          setLoading(false);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) {
        handleClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClose, isOpen]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === "Escape") handleClose();
    };

    document.addEventListener("keydown", handleEscape);
    return () =>
      document.removeEventListener("keydown", handleEscape);
  }, [handleClose, isOpen]);

  const navigate = (path) => {
    handleClose();
    router.push(path);
  };

  const handleSubcategoryClick = (subcategory) => {
    const categorySlug =
      typeof subcategory.category === "object"
        ? subcategory.category?.slug
        : null;

    const path = categorySlug
      ? `/catalog/${categorySlug}/${subcategory.slug}`
      : `/catalog/all/${subcategory.slug}`;

    navigate(path);
  };

  const totalResults = results
    ? (results.products?.length || 0) +
      (results.categories?.length || 0) +
      (results.subcategories?.length || 0)
    : 0;

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center ${
        isMobile ? "w-full md:w-auto" : ""
      }`}
    >

      {/* Animated input container */}
      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: isMobile ? "100%" : "280px", opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`flex items-center gap-2 overflow-hidden border-b-2 border-gray-900 pb-1 origin-right ${
          isMobile ? "w-full" : ""
        }`}
      >
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Search size={16} className="text-gray-400 flex-shrink-0" />
        </motion.div>

        <motion.input
          ref={inputRef}
          type="text"
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="flex-1 bg-transparent border-none outline-none
                     text-gray-900 placeholder:text-gray-400
                     text-sm font-medium w-full"
        />

        <AnimatePresence>
          {query && (
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.15 }}
              onClick={() => {
                setQuery("");
                setResults(null);
                inputRef.current?.focus();
              }}
              className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              <X size={14} />
            </motion.button>
          )}
        </AnimatePresence>

        <motion.button
          initial={{ opacity: 0, rotate: -90 }}
          animate={{ opacity: 1, rotate: 0 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-700 flex-shrink-0 ml-1"
        >
          <X size={16} />
        </motion.button>
      </motion.div>

      {/* Results dropdown */}
      <AnimatePresence>
        {query.length >= 3 && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={`absolute top-full right-0 mt-3 w-96 max-w-[calc(100vw-2rem)]
                       bg-[#F0FFDF] border border-gray-200 rounded-lg shadow-xl
                       max-h-96 overflow-y-auto z-50 ${
                         isMobile ? "left-0 right-auto w-full max-w-none" : ""
                       }`}
          >
            {loading ? (
            <div className="p-6 flex items-center justify-center gap-3 text-gray-500 text-sm">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin"></div>
              <span>Searching...</span>
            </div>
          ) : totalResults === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                No results for &quot;{query}&quot;
              </div>
            ) : (
              <>
                {/* Products */}
                {results.products?.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-black/5 border-b border-gray-200">
                      Products
                    </div>
                    {results.products.map((product, i) => (
                      <motion.button
                        key={product.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => navigate(`/products/${product.id}`)}
                        className="w-full px-4 py-3 flex items-center gap-3 
                                   hover:bg-white/60 transition text-left border-b border-gray-100 last:border-0"
                      >
                        <img
                          src={product.image}
                          alt={product.title}
                          className="w-12 h-12 object-cover rounded border border-gray-200 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 text-sm truncate">
                            {product.title}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {product.category?.name}
                          </div>
                        </div>
                        <div className="font-semibold text-gray-900 text-sm flex-shrink-0">
                          ₹{product.mrp || product.variants?.[0]?.mrp}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}

                {/* Categories */}
                {results.categories?.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-black/5 border-b border-gray-200">
                      Categories
                    </div>
                    {results.categories.map((category, i) => (
                      <motion.button
                        key={category.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => navigate(`/catalog/${category.slug}`)}
                        className="w-full px-4 py-2.5 text-left hover:bg-white/60 transition border-b border-gray-100 last:border-0"
                      >
                        <div className="font-medium text-gray-900 text-sm">
                          {category.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {category.productCount} products
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}

                {/* Subcategories */}
                {results.subcategories?.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-black/5 border-b border-gray-200">
                      Subcategories
                    </div>
                    {results.subcategories.map((subcategory, i) => (
                      <motion.button
                        key={subcategory.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => handleSubcategoryClick(subcategory)}
                        className="w-full px-4 py-2.5 text-left hover:bg-white/60 transition border-b border-gray-100 last:border-0"
                      >
                        <div className="font-medium text-gray-900 text-sm">
                          {subcategory.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {typeof subcategory.category === "object" &&
                          subcategory.category?.name
                            ? `in ${subcategory.category.name}`
                            : "View products"}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
