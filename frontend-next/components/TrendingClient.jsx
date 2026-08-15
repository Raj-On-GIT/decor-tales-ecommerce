"use client";

import { useEffect, useState } from "react";
import ProductCard from "./ProductCard";

const TRANSITION_MS = 700;

export default function TrendingClient({ products, interval = 3000 }) {
  const count = products?.length || 0;
  const [index, setIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (count <= 1 || isPaused) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current < count ? current + 1 : current));
    }, interval);

    return () => window.clearInterval(timer);
  }, [count, interval, isPaused]);

  useEffect(() => {
    if (index !== count) {
      return undefined;
    }

    // Reached the start of the duplicated set (visually identical to the first
    // slide). Snap back to the first slide without animating for a seamless,
    // infinite "slides to the right" loop.
    const timeout = window.setTimeout(() => {
      setTransitioning(false);
      setIndex(0);
      window.setTimeout(() => setTransitioning(true), 50);
    }, TRANSITION_MS);

    return () => window.clearTimeout(timeout);
  }, [index, count]);

  if (count === 0) return null;

  const slides = count > 1 ? [...products, ...products] : products;

  return (
    <div
      className="overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label="Trending products"
      role="region"
    >
      <div
        className="flex"
        style={{
          transform: `translateX(-${index * 100}%)`,
          transition: transitioning
            ? `transform ${TRANSITION_MS}ms ease-out`
            : "none",
        }}
      >
        {slides.map((product, slideIndex) => (
          <div
            key={`${product.id}-${slideIndex}`}
            className="w-full shrink-0"
            aria-hidden={slideIndex >= count}
          >
            <div className="mx-auto w-full max-w-[320px]">
              <ProductCard product={product} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
