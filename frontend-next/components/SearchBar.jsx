"use client";

import Image from "next/image";
import { useState, useEffect, useRef, useCallback } from "react";
import { MIN_SEARCH_QUERY_LENGTH, searchProducts } from "@/lib/api";
import { formatPrice } from "@/lib/formatPrice";
import { Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

export default function SearchBar({ isOpen, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const latestQueryRef = useRef("");
  const router = useRouter();

  const handleClose = useCallback(() => {
    setQuery("");
    setResults(null);
    setLoading(false);
    setError("");
    setHighlightedIndex(-1);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 200);

    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    const normalizedQuery = query.trim();

    if (!normalizedQuery || normalizedQuery.length < MIN_SEARCH_QUERY_LENGTH) {
      setResults(null);
      setLoading(false);
      setError("");
      setHighlightedIndex(-1);
      return;
    }

    latestQueryRef.current = normalizedQuery;
    setLoading(true);
    setError("");

    const timer = setTimeout(async () => {
      try {
        const data = await searchProducts(normalizedQuery);
        if (latestQueryRef.current === normalizedQuery) {
          setResults(data);
        }
      } catch (fetchError) {
        console.error("Search error:", fetchError);
        if (latestQueryRef.current === normalizedQuery) {
          setResults(null);
          setError("Search is unavailable right now.");
        }
      } finally {
        if (latestQueryRef.current === normalizedQuery) {
          setLoading(false);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [query, results]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target)) {
        handleClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClose, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [handleClose, isOpen]);

  const navigate = useCallback(
    (path) => {
      handleClose();
      router.push(path);
    },
    [handleClose, router],
  );

  const navigateToFullResults = useCallback(() => {
    const normalizedQuery = query.trim();

    if (normalizedQuery.length < MIN_SEARCH_QUERY_LENGTH) {
      return;
    }

    navigate(`/search?q=${encodeURIComponent(normalizedQuery)}`);
  }, [navigate, query]);

  const handleSubcategoryClick = useCallback(
    (subcategory) => {
      const categorySlug =
        typeof subcategory.category === "object"
          ? subcategory.category?.slug
          : null;

      const path = categorySlug
        ? `/catalog/${categorySlug}/${subcategory.slug}`
        : "/catalog";

      navigate(path);
    },
    [navigate],
  );

  const totalResults = results
    ? (results.products?.length || 0) +
      (results.categories?.length || 0) +
      (results.subcategories?.length || 0)
    : 0;
  const totalMatches = results
    ? (results.meta?.products_total || 0) +
      (results.meta?.categories_total || 0) +
      (results.meta?.subcategories_total || 0)
    : 0;
  const flattenedResults = [
    ...(results?.products || []).map((product) => ({
      key: `product-${product.id}`,
      action: () => navigate(`/products/${product.id}`),
    })),
    ...(results?.categories || []).map((category) => ({
      key: `category-${category.id}`,
      action: () => navigate(`/catalog/${category.slug}`),
    })),
    ...(results?.subcategories || []).map((subcategory) => ({
      key: `subcategory-${subcategory.id}`,
      action: () => handleSubcategoryClick(subcategory),
    })),
    ...(query.trim().length >= MIN_SEARCH_QUERY_LENGTH && totalMatches > 0
      ? [{ key: "view-all", action: navigateToFullResults }]
      : []),
  ];

  const getItemClassName = (index, baseClassName) =>
    `${baseClassName} ${
      highlightedIndex === index ? "bg-white/80" : "hover:bg-white/60"
    }`;

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      if (!flattenedResults.length) return;

      event.preventDefault();
      setHighlightedIndex((currentIndex) =>
        currentIndex < flattenedResults.length - 1 ? currentIndex + 1 : 0,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      if (!flattenedResults.length) return;

      event.preventDefault();
      setHighlightedIndex((currentIndex) =>
        currentIndex > 0 ? currentIndex - 1 : flattenedResults.length - 1,
      );
      return;
    }

    if (event.key === "Enter") {
      if (highlightedIndex >= 0 && flattenedResults[highlightedIndex]) {
        event.preventDefault();
        flattenedResults[highlightedIndex].action();
        return;
      }

      if (query.trim().length >= MIN_SEARCH_QUERY_LENGTH) {
        event.preventDefault();
        navigateToFullResults();
      }
    }
  };

  return (
    <div ref={containerRef} className="relative flex w-full items-center md:w-auto">
      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: "100%", opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="flex w-full items-center gap-2 overflow-hidden border-b-2 border-gray-900 pb-1 origin-right md:w-[280px]"
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
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-gray-900 placeholder:text-gray-400 w-full"
        />

        <motion.button
          initial={{ opacity: 0, rotate: -90 }}
          animate={{ opacity: 1, rotate: 0 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
          onClick={handleClose}
          className="ml-1 text-gray-400 hover:text-gray-700 flex-shrink-0"
        >
          <X size={16} />
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {query.trim().length >= MIN_SEARCH_QUERY_LENGTH && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute top-full left-0 right-0 z-50 mt-3 max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-[#F0FFF0] shadow-xl md:left-auto md:right-0 md:w-96"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-3 p-6 text-sm text-gray-500">
                <div className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-gray-800 animate-spin"></div>
                <span>Searching...</span>
              </div>
            ) : error ? (
              <div className="p-6 text-center text-sm text-red-600">{error}</div>
            ) : totalResults === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                No results for &quot;{query}&quot;
              </div>
            ) : (
              <>
                {results.products?.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 bg-black/5 border-b border-gray-200">
                      Products
                    </div>
                    {results.products.map((product, index) => {
                      const primaryVariant = product.variants
                        ?.filter((variant) => variant.stock > 0)
                        ?.sort(
                          (left, right) =>
                            (left.slashed_price || left.mrp) - (right.slashed_price || right.mrp),
                        )?.[0];
                      const currentPrice =
                        product.slashed_price ||
                        product.mrp ||
                        primaryVariant?.slashed_price ||
                        primaryVariant?.mrp;
                      const originalPrice =
                        product.slashed_price
                          ? product.mrp
                          : primaryVariant?.slashed_price
                            ? primaryVariant?.mrp
                            : null;

                      return (
                        <motion.button
                          key={product.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.04 }}
                          onClick={() => navigate(`/products/${product.id}`)}
                          className={getItemClassName(
                            index,
                            "flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition last:border-0",
                          )}
                        >
                          {product.image ? (
                            <Image
                              src={product.image}
                              alt={product.title}
                              width={48}
                              height={48}
                              unoptimized
                              className="h-12 w-12 flex-shrink-0 rounded border border-gray-200 object-cover"
                            />
                          ) : (
                            <div className="h-12 w-12 flex-shrink-0 rounded border border-gray-200 bg-white/70" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-gray-900">
                              {product.title}
                            </div>
                            <div className="mt-0.5 text-xs text-gray-500">
                              {product.category?.name}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 text-right">
                            {originalPrice ? (
                              <span className="text-xs text-gray-500 line-through">
                                Rs {formatPrice(originalPrice)}
                              </span>
                            ) : null}
                            <span className="flex-shrink-0 text-sm font-semibold text-gray-900">
                              Rs {formatPrice(currentPrice)}
                            </span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {results.categories?.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 bg-black/5 border-b border-gray-200">
                      Categories
                    </div>
                    {results.categories.map((category, index) => {
                      const itemIndex = (results.products?.length || 0) + index;

                      return (
                        <motion.button
                          key={category.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.04 }}
                          onClick={() => navigate(`/catalog/${category.slug}`)}
                          className={getItemClassName(
                            itemIndex,
                            "w-full border-b border-gray-100 px-4 py-2.5 text-left transition last:border-0",
                          )}
                        >
                          <div className="text-sm font-medium text-gray-900">
                            {category.name}
                          </div>
                          <div className="mt-0.5 text-xs text-gray-500">
                            {category.productCount} products
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {results.subcategories?.length > 0 && (
                  <div>
                    <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 bg-black/5 border-b border-gray-200">
                      Subcategories
                    </div>
                    {results.subcategories.map((subcategory, index) => {
                      const itemIndex =
                        (results.products?.length || 0) +
                        (results.categories?.length || 0) +
                        index;

                      return (
                        <motion.button
                          key={subcategory.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.04 }}
                          onClick={() => handleSubcategoryClick(subcategory)}
                          className={getItemClassName(
                            itemIndex,
                            "w-full border-b border-gray-100 px-4 py-2.5 text-left transition last:border-0",
                          )}
                        >
                          <div className="text-sm font-medium text-gray-900">
                            {subcategory.name}
                          </div>
                          <div className="mt-0.5 text-xs text-gray-500">
                            {subcategory.category?.name
                              ? `in ${subcategory.category.name}`
                              : "View products"}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {totalMatches > 0 && (
                  <button
                    type="button"
                    onClick={navigateToFullResults}
                    className={getItemClassName(
                      flattenedResults.length - 1,
                      "w-full border-t border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-900 transition",
                    )}
                  >
                    View all {totalMatches} results
                  </button>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
