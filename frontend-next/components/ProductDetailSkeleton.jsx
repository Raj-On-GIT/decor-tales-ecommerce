export default function ProductDetailSkeleton() {
  return (
    <div className="mx-auto max-w-screen-xl px-4 pt-8 sm:px-6 sm:pt-10 lg:px-10">
      <div className="mb-10 grid grid-cols-1 items-start gap-8 sm:gap-10 md:grid-cols-2 md:gap-12">
        <div className="flex flex-col items-center">
          <div className="aspect-square w-full overflow-hidden rounded-xl bg-gray-100 animate-pulse" />

          <div className="mt-4 flex w-full gap-2 sm:mt-5 sm:gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-14 w-14 flex-shrink-0 rounded-lg bg-gray-100 animate-pulse sm:h-15 sm:w-15"
              />
            ))}
          </div>
        </div>

        <div className="flex h-full w-full flex-col px-0 sm:px-2">
          <div className="flex h-full flex-col justify-center gap-5 sm:gap-6">
            <div>
              <div className="h-9 w-4/5 rounded bg-gray-200 animate-pulse sm:h-11" />
              <div className="mt-3 h-10 w-48 rounded-xl bg-gray-200 animate-pulse" />

              <div className="mt-4 space-y-3">
                <div className="h-4 w-full rounded bg-gray-200 animate-pulse" />
                <div className="h-4 w-11/12 rounded bg-gray-200 animate-pulse" />
                <div className="h-4 w-4/5 rounded bg-gray-200 animate-pulse" />
              </div>

              <div className="mt-6 space-y-3">
                <div className="h-5 w-28 rounded bg-gray-200 animate-pulse" />
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-10 w-20 rounded-lg bg-gray-200 animate-pulse"
                    />
                  ))}
                </div>
              </div>

              <div className="mt-6 h-9 w-40 rounded bg-gray-200 animate-pulse" />

              <div className="mt-4 flex items-stretch gap-3 sm:gap-4">
                <div className="h-12 basis-3/10 rounded-xl bg-gray-200 animate-pulse" />
                <div className="h-12 basis-7/10 rounded-xl bg-gray-200 animate-pulse sm:flex-1" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="mb-10 mt-16 sm:mt-24">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="h-8 w-56 rounded bg-gray-200 animate-pulse sm:h-10" />
            <div className="mt-2 h-4 w-48 rounded bg-gray-200 animate-pulse" />
          </div>

          <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-8 md:gap-10 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-gray-300 bg-[#F0FFF0] p-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
            >
              <div className="aspect-[3/4] rounded-xl bg-gray-100 animate-pulse" />

              <div className="mb-1 mt-3 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-4/5 rounded bg-gray-200 animate-pulse sm:h-5" />
                  <div className="h-3 w-1/2 rounded bg-gray-200 animate-pulse sm:h-4" />
                  <div className="flex flex-col gap-1 pt-1 sm:flex-row sm:items-center sm:gap-2">
                    <div className="h-3 w-16 rounded bg-gray-200 animate-pulse sm:h-4 sm:w-20" />
                    <div className="h-5 w-14 rounded-md bg-gray-200 animate-pulse sm:w-16 sm:rounded-full" />
                  </div>
                </div>

                <div className="h-9 w-9 flex-shrink-0 rounded-full bg-gray-200 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
