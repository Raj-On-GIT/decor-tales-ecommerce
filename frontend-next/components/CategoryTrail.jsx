"use client";

import Link from "next/link";

function getCategoryHref(category, subCategory) {
  if (!category?.slug) {
    return null;
  }

  if (subCategory?.slug) {
    return `/catalog/${category.slug}/${subCategory.slug}`;
  }

  return `/catalog/${category.slug}`;
}

export default function CategoryTrail({
  category,
  subCategory,
  prefix = null,
  className = "",
  linkClassName = "",
  separatorClassName = "",
  variant = "plain",
  chipClassName = "",
}) {
  if (!category?.name) {
    return null;
  }

  const categoryHref = getCategoryHref(category, null);
  const subCategoryHref = getCategoryHref(category, subCategory);
  const resolvedLinkClassName =
    linkClassName || "transition hover:underline underline-offset-2";
  const isChip = variant === "chip";

  return (
    <div className={`flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-gray-500 ${className}`.trim()}>
      {prefix ? <span className="text-gray-500">{prefix}</span> : null}
      <span
        className={`inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 rounded-full px-3 py-1 text-xs sm:text-sm ${
          isChip ? "bg-gray-100 text-gray-600" : ""
        } ${chipClassName}`.trim()}
      >
        {categoryHref ? (
          <Link href={categoryHref} className={resolvedLinkClassName}>
            {category.name}
          </Link>
        ) : (
          <span>{category.name}</span>
        )}
        {subCategory?.name ? (
          <>
            <span className={separatorClassName || "text-gray-400"}>{">"}</span>
            {subCategoryHref ? (
              <Link href={subCategoryHref} className={resolvedLinkClassName}>
                {subCategory.name}
              </Link>
            ) : (
              <span>{subCategory.name}</span>
            )}
          </>
        ) : null}
      </span>
    </div>
  );
}
