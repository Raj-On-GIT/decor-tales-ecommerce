"use client";

import { formatPrice } from "@/lib/formatPrice";

export default function PriceDisplay({
  price,
  originalPrice,
  discountPercent,
  className = "",
  currentPriceClassName = "",
  originalPriceClassName = "",
  badgeClassName = "",
  currencyPrefix = "₹",
}) {
  const numericPrice = Number(price || 0);
  const numericOriginalPrice = Number(originalPrice || 0);
  const hasDiscount = numericOriginalPrice > numericPrice;
  const resolvedDiscount =
    Number(discountPercent || 0) ||
    (hasDiscount && numericOriginalPrice > 0
      ? Math.round(((numericOriginalPrice - numericPrice) / numericOriginalPrice) * 100)
      : 0);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      <span className={`font-semibold text-gray-900 ${currentPriceClassName}`.trim()}>
        {currencyPrefix}
        {formatPrice(numericPrice)}
      </span>
      {hasDiscount ? (
        <>
          <span className={`text-sm text-gray-500 line-through ${originalPriceClassName}`.trim()}>
            {currencyPrefix}
            {formatPrice(numericOriginalPrice)}
          </span>
          {resolvedDiscount > 0 ? (
            <span
              className={`inline-flex w-fit items-center self-start rounded-md bg-[#E6CCBE] px-1.5 py-[2px] text-[10px] font-semibold text-[#1C1917] sm:rounded-full sm:px-2 sm:py-0.5 sm:text-xs tracking-wide ${badgeClassName}`.trim()}
            >
              {resolvedDiscount}% OFF
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
