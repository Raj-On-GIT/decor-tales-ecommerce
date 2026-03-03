export default function ProductGridSkeleton({ count = 4 }) {
  return (
    <section
      className="
        max-w-screen-xl mx-auto
        px-4 sm:px-6
        py-14 sm:py-16 md:py-20
      "
    >
      {/* Heading Skeleton */}
      <div
        className="
          flex flex-col sm:flex-row
          sm:justify-between sm:items-end
          gap-4 mb-8 md:mb-10
        "
      >
        <div>
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-3"></div>
          <div className="h-4 w-40 bg-gray-200 rounded animate-pulse"></div>
        </div>

        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
      </div>

      {/* Grid */}
      <div
        className="
          grid
          grid-cols-2
          sm:grid-cols-2
          lg:grid-cols-4
          gap-5 sm:gap-8 md:gap-10
        "
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="
              bg-[#F0FFDF]
              rounded-2xl
              p-2
              border border-gray-200
              shadow-[0_2px_8px_rgba(0,0,0,0.06)]
            "
          >
            {/* Image */}
            <div className="aspect-[3/4] rounded-xl bg-gray-200 animate-pulse" />

            {/* Text */}
            <div className="mt-3 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
              <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}