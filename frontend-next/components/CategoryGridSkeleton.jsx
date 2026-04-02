export default function CategoryGridSkeleton({ count = 4 }) {
  return (
    <section className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 sm:py-16 md:py-20">
      {/* Heading Skeleton */}
      <div className="flex flex-col gap-4 mb-6 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="h-10 w-72 bg-gray-200 rounded animate-pulse mb-3"></div>
          <div className="h-4 w-64 bg-gray-200 rounded animate-pulse"></div>
        </div>

        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="group">
            <div
              className="
                relative flex flex-col overflow-hidden rounded-2xl border border-gray-300
                bg-[#F0FFF0] p-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.4)] sm:h-64
              "
            >
              {/* Image Skeleton */}
              <div className="h-25 w-full rounded-xl bg-gray-100 animate-pulse sm:h-45"></div>

              {/* Content Skeleton */}
              <div className="mb-2 mt-2 text-center sm:mt-3">
                <div className="mx-auto h-5 w-3/4 rounded bg-gray-200 animate-pulse sm:h-6"></div>
                <div className="mx-auto mt-2 h-3 w-1/2 rounded bg-gray-200 animate-pulse sm:h-4"></div>
              </div>

              {/* Arrow Placeholder */}
              <div className="absolute bottom-4 right-4">
                <div className="h-5 w-5 rounded-full bg-gray-200 animate-pulse"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
