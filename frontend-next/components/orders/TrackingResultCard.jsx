import TrackingTimeline from "./TrackingTimeline";

function getBadgeClasses(status) {
  const normalized = status.toLowerCase();

  if (normalized.includes("deliver")) {
    return "bg-emerald-100 text-emerald-700";
  }

  if (normalized.includes("transit")) {
    return "bg-sky-100 text-sky-700";
  }

  return "bg-amber-100 text-amber-700";
}

export default function TrackingResultCard({ result }) {
  return (
    <section className="rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-[0_25px_70px_rgba(15,23,42,0.08)] sm:p-8">
      <div className="flex flex-col gap-5 border-b border-gray-100 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-teal-800/70">
            Tracking summary
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold text-gray-900 sm:text-3xl">
              {result.orderLabel}
            </h2>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getBadgeClasses(result.status)}`}
            >
              {result.status}
            </span>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500 sm:text-base">
            {result.summary}
          </p>
        </div>

        <div className="grid gap-3 rounded-[1.5rem] border border-gray-200 bg-[#fbfcfa] p-4 text-sm text-gray-600 sm:grid-cols-2 lg:min-w-[320px]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
              Estimated delivery
            </p>
            <p className="mt-2 font-semibold text-gray-900">{result.estimatedDelivery}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
              Current location
            </p>
            <p className="mt-2 font-semibold text-gray-900">{result.currentLocation}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
              Last updated
            </p>
            <p className="mt-2 font-semibold text-gray-900">{result.lastUpdated}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
              Tracking ID
            </p>
            <p className="mt-2 font-semibold text-gray-900">{result.trackingNumber}</p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">
              Shipment progress
            </p>
            <h3 className="mt-1 text-xl font-semibold text-gray-900">Tracking timeline</h3>
          </div>
        </div>

        <TrackingTimeline steps={result.steps} />
      </div>
    </section>
  );
}
