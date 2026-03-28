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
}) {
  if (!category?.name) {
    return null;
  }

  const categoryHref = getCategoryHref(category, null);
  const subCategoryHref = getCategoryHref(category, subCategory);

  return (
    <div className={`flex flex-wrap items-center gap-1.5 text-sm text-gray-600 ${className}`.trim()}>
      {prefix ? <span className="text-gray-500">{prefix}</span> : null}
      {categoryHref ? (
        <Link href={categoryHref} className={linkClassName}>
          {category.name}
        </Link>
      ) : (
        <span>{category.name}</span>
      )}
      {subCategory?.name ? (
        <>
          <span className={separatorClassName}>{">"}</span>
          {subCategoryHref ? (
            <Link href={subCategoryHref} className={linkClassName}>
              {subCategory.name}
            </Link>
          ) : (
            <span>{subCategory.name}</span>
          )}
        </>
      ) : null}
    </div>
  );
}
