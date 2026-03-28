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
  currencyPrefix = "Rs ",
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
              className={`inline-flex items-center rounded-full bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white ${badgeClassName}`.trim()}
            >
              {resolvedDiscount}% OFF
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
