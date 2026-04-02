export default function ProductGridSkeleton({ count = 4 }) {
  return (
    <section
      className="
        max-w-screen-xl mx-auto
        px-4 sm:px-6
        py-8 sm:py-16 md:py-20
      "
    >
      {/* Heading Skeleton */}
      <div
        className="
          flex flex-col sm:flex-row
          sm:justify-between sm:items-end
          gap-4 mb-5 md:mb-10
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
              relative rounded-2xl border border-gray-300 bg-[#F0FFF0] p-1.5
              shadow-[0_2px_8px_rgba(0,0,0,0.3)]
            "
          >
            <div
              className="
              aspect-[3/4] rounded-xl bg-gray-100 animate-pulse
            "
            />

            <div className="mb-1 mt-3 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-4/5 rounded bg-gray-200 animate-pulse sm:h-5" />
                <div className="h-3 w-1/2 rounded bg-gray-200 animate-pulse sm:h-4" />
                <div className="flex flex-col gap-1 pt-1 sm:flex-row sm:items-center sm:gap-2">
                  <div className="h-3 w-16 rounded bg-gray-200 animate-pulse sm:h-4 sm:w-20" />
                  <div className="h-5 w-14 rounded-md bg-gray-200 animate-pulse sm:w-16 sm:rounded-full" />
                </div>
              </div>

              <div
                className="
                  h-9 w-9 flex-shrink-0 rounded-full bg-gray-200 animate-pulse
                "
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
