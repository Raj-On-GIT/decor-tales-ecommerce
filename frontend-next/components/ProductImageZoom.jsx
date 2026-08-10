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
  const [natural, setNatural] = useState(null);
  const [zoom, setZoom] = useState(null);
  const containerRef = useRef(null);

  const handleImageLoad = (e) => {
    const img = e.currentTarget;
    setNatural({ w: img.naturalWidth, h: img.naturalHeight });
  };

  const handleMove = (e) => {
    const container = containerRef.current;
    if (!container || !natural?.w || !natural?.h) return;

    const rect = container.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const imageAspect = natural.w / natural.h;
    const containerAspect = rect.width / rect.height;

    let imageWidth;
    let imageHeight;
    let imageX;
    let imageY;

    if (imageAspect >= containerAspect) {
      imageWidth = rect.width;
      imageHeight = rect.width / imageAspect;
      imageX = 0;
      imageY = (rect.height - imageHeight) / 2;
    } else {
      imageHeight = rect.height;
      imageWidth = rect.height * imageAspect;
      imageY = 0;
      imageX = (rect.width - imageWidth) / 2;
    }

    const isOverImage =
      px >= imageX &&
      px <= imageX + imageWidth &&
      py >= imageY &&
      py <= imageY + imageHeight;

    if (!isOverImage) {
      if (zoom) setZoom(null);
      return;
    }

    setZoom({
      x: (px / rect.width) * 100,
      y: (py / rect.height) * 100,
    });
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
          onLoad={handleImageLoad}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full shrink-0 bg-white"
      onMouseMove={handleMove}
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
          onLoad={handleImageLoad}
        />
      </div>
    </div>
  );
}
