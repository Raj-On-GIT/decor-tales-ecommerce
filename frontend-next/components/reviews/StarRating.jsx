"use client";

import { Star } from "lucide-react";
import { useState } from "react";

const RATINGS = [
  { value: 5, label: "Excellent" },
  { value: 4, label: "Good" },
  { value: 3, label: "Average" },
  { value: 2, label: "Poor" },
  { value: 1, label: "Terrible" },
];

export default function StarRating({
  value = 0,
  onChange,
  size = "h-6 w-6",
  className = "",
  label = "Rating",
}) {
  const [hover, setHover] = useState(null);
  const active = onChange ? (hover ?? value) : value;
  const interactive = Boolean(onChange);

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {RATINGS.map(({ value: starValue, label: starLabel }) => {
        const filled = starValue <= active;
        return interactive ? (
          <button
            key={starValue}
            type="button"
            role="radio"
            aria-checked={value === starValue}
            aria-label={`${starLabel} (${starValue} star${starValue > 1 ? "s" : ""})`}
            onMouseEnter={() => setHover(starValue)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onChange(starValue)}
            className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A373]/50"
          >
            <Star
              size={24}
              className={`${size} ${
                filled ? "fill-[#D4A373] text-[#D4A373]" : "fill-transparent text-gray-300"
              } transition-colors`}
            />
          </button>
        ) : (
          <span
            key={starValue}
            aria-label={starValue <= value ? "Filled star" : "Empty star"}
          >
            <Star
              size={24}
              className={`${size} ${
                filled ? "fill-[#D4A373] text-[#D4A373]" : "fill-transparent text-gray-300"
              }`}
            />
          </span>
        );
      })}
      {interactive && (
        <span className="ml-2 text-sm font-medium text-gray-600" aria-live="polite">
          {RATINGS.find((r) => r.value === (hover ?? value))?.label || label}
        </span>
      )}
    </div>
  );
}
