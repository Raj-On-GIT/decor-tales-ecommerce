"use client";

import { useRef, useState } from "react";
import Image from "next/image";

const ZOOM_FACTOR = 2;

export default function ProductImageZoom({ src, alt, priority = false }) {
  const [canHover] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches,
  );
  const [zoom, setZoom] = useState(null);
  const containerRef = useRef(null);

  const handleMove = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoom({ x, y });
  };

  if (!canHover) {
    return (
      <div ref={containerRef} className="relative h-full w-full shrink-0 bg-white">
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-contain"
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full shrink-0 bg-white"
      onMouseMove={handleMove}
      onMouseEnter={() => setZoom({ x: 50, y: 50 })}
      onMouseLeave={() => setZoom(null)}
    >
      <div
        className="h-full w-full transition-transform duration-300 ease-out"
        style={{
          transform: zoom ? `scale(${ZOOM_FACTOR})` : "scale(1)",
          transformOrigin: zoom ? `${zoom.x}% ${zoom.y}%` : "50% 50%",
        }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-contain"
        />
      </div>
    </div>
  );
}
