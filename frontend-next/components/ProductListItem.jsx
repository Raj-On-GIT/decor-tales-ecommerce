"use client";

import Link from "next/link";
import CategoryTrail from "@/components/CategoryTrail";

function getVariantText(variant) {
  return [variant?.size_name, variant?.color_name].filter(Boolean).join(" | ");
}

export default function ProductListItem({
  href,
  image,
  title,
  category,
  subCategory,
  categoryTrailProps = null,
  variant,
  quantity,
  primaryContent = null,
  secondaryContent = null,
  noteContent = null,
  customizationContent = null,
  actions = null,
  onNavigate,
  className = "",
  imageClassName = "",
  contentClassName = "",
  asideClassName = "",
  truncateText = false,
}) {
  const variantText = getVariantText(variant);

  return (
    <div
      className={`flex flex-col gap-4 rounded-[1.5rem] border border-gray-100 bg-white/90 p-1 sm:flex-row sm:items-start sm:justify-between ${className}`.trim()}
    >
      <div className={`flex min-w-0 items-start gap-4 ${contentClassName}`.trim()}>
        {image ? (
          <Link
            href={href}
            onClick={onNavigate}
            className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:h-20 sm:w-20 ${imageClassName}`.trim()}
          >
            <img src={image} alt={title} className="h-full w-full object-cover" />
          </Link>
        ) : null}

        <div className="min-w-0 flex-1">
          <Link
            href={href}
            onClick={onNavigate}
            className={`block text-sm font-semibold leading-5 text-gray-900 transition hover:text-[#002424] sm:text-base ${
              truncateText ? "truncate" : ""
            }`.trim()}
          >
            {title}
          </Link>          

          <CategoryTrail
            category={category}
            subCategory={subCategory}
            className="text-xs sm:text-sm"
            {...categoryTrailProps}
          />

          {variantText ? (
            <p className={`text-[11px] text-gray-600 sm:text-sm ${truncateText ? "truncate" : ""}`.trim()}>
              {variantText}
            </p>
          ) : null}

          {primaryContent ? <div>{primaryContent}</div> : null}

          {typeof quantity === "number" ? (
            <p className="mt-1 text-xs text-gray-500 sm:text-sm">Qty: {quantity}</p>
          ) : null}

          {secondaryContent ? <div>{secondaryContent}</div> : null}
          {noteContent ? <div>{noteContent}</div> : null}
          {customizationContent ? <div>{customizationContent}</div> : null}
        </div>
      </div>

      {actions ? (
        <div className={`shrink-0 ${asideClassName}`.trim()}>{actions}</div>
      ) : null}
    </div>
  );
}
