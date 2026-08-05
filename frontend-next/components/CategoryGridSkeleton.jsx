import CategoryCardSkeleton from "./CategoryCardSkeleton";

export default function CategoryGridSkeleton({ count = 4 }) {
  return (
    <section className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 sm:py-16 md:py-20">
      <div className="flex flex-col gap-4 mb-6 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="h-10 w-72 bg-gray-200 rounded animate-pulse mb-3" />
          <div className="h-4 w-64 bg-gray-200 rounded animate-pulse" />
        </div>

        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: count }).map((_, index) => (
          <CategoryCardSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}
