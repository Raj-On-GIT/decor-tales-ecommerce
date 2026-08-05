"use client";

import CategoryCard from "./CategoryCard";
import ViewportReveal from "./ViewportReveal";

export default function BrowseByCategoryClient({ categories, reveal = false }) {
  if (!categories || categories.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-600">No categories available.</p>
      </div>
    );
  }

  const gridClassName =
    "grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4";
  const content = categories.map((category) => (
    <CategoryCard key={category.id} category={category} />
  ));

  if (reveal) {
    return (
      <ViewportReveal className={gridClassName} stagger>
        {content}
      </ViewportReveal>
    );
  }

  return <div className={gridClassName}>{content}</div>;
}
