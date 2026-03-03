export default function CategoryGridSkeleton({ count = 4 }) {
  return (
    <section className="max-w-screen-xl mx-auto px-6 py-10">
      {/* Heading Skeleton */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-12">
        <div>
          <div className="h-10 w-72 bg-gray-200 rounded animate-pulse mb-3"></div>
          <div className="h-4 w-64 bg-gray-200 rounded animate-pulse"></div>
        </div>

        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="group">
            <div
              className="
                bg-[#F0FFDF]
                rounded-2xl
                overflow-hidden
                h-64
                flex flex-col
                justify-between
                p-4
                border border-gray-200
                shadow-[0_2px_8px_rgba(0,0,0,0.06)]
              "
            >
              {/* Image Skeleton */}
              <div className="w-full h-40 bg-gray-200 rounded-lg animate-pulse mb-4"></div>

              {/* Content Skeleton */}
              <div className="text-center space-y-2">
                <div className="h-5 w-3/4 mx-auto bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-1/2 mx-auto bg-gray-200 rounded animate-pulse"></div>
              </div>

              {/* Arrow Placeholder */}
              <div className="absolute bottom-4 right-4">
                <div className="h-5 w-5 bg-gray-200 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}