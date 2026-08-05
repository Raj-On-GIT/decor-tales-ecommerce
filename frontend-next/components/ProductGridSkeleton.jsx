import ProductCardSkeleton from "./ProductCardSkeleton";

export default function ProductGridSkeleton({ count = 4 }) {
  return (
    <section className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 sm:py-16 md:py-20">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-5 md:mb-10">
        <div>
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-3" />
          <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
        </div>

        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-8 md:gap-10">
        {Array.from({ length: count }).map((_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}
