"use client";

import { useEffect, useState } from "react";
import ProductCard from "./ProductCard";

const TRANSITION_MS = 700;

function getPerView() {
  if (typeof window === "undefined") return 4;
  if (window.matchMedia("(max-width: 639px)").matches) return 2;
  if (window.matchMedia("(max-width: 1023px)").matches) return 3;
  return 4;
}

export default function TrendingClient({ products, interval = 3000 }) {
  const count = products?.length || 0;
  const [index, setIndex] = useState(0);
  const [perView, setPerView] = useState(4);
  const [transitioning, setTransitioning] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const mediaQueries = [
      window.matchMedia("(max-width: 639px)"),
      window.matchMedia("(max-width: 1023px)"),
    ];

    const update = () => setPerView(getPerView());

    update();
    mediaQueries.forEach((mq) => mq.addEventListener("change", update));

    return () => {
      mediaQueries.forEach((mq) => mq.removeEventListener("change", update));
    };
  }, []);

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
          transform: `translateX(-${(index / perView) * 100}%)`,
          transition: transitioning
            ? `transform ${TRANSITION_MS}ms ease-out`
            : "none",
        }}
      >
        {slides.map((product, slideIndex) => (
          <div
            key={`${product.id}-${slideIndex}`}
            className="w-1/2 shrink-0 px-2 sm:w-1/3 sm:px-3 lg:w-1/4"
            aria-hidden={slideIndex >= count}
          >
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </div>
  );
}
