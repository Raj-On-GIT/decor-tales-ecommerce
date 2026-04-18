import { CheckCircle2, Circle, Truck } from "lucide-react";

function getStepIcon(state) {
  if (state === "complete") {
    return CheckCircle2;
  }

  if (state === "current") {
    return Truck;
  }

  return Circle;
}

export default function TrackingTimeline({ steps }) {
  return (
    <div className="space-y-5">
      {steps.map((step, index) => {
        const Icon = getStepIcon(step.state);
        const isLast = index === steps.length - 1;
        const isComplete = step.state === "complete";
        const isCurrent = step.state === "current";

        return (
          <div key={`${step.label}-${index}`} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border ${
                  isCurrent
                    ? "border-[#002424] bg-[#002424] text-white"
                    : isComplete
                      ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                      : "border-gray-200 bg-white text-gray-300"
                }`}
              >
                <Icon size={18} />
              </div>
              {!isLast ? (
                <div
                  className={`mt-2 h-full min-h-10 w-px ${
                    isComplete ? "bg-emerald-300" : "bg-gray-200"
                  }`}
                />
              ) : null}
            </div>

            <div
              className={`flex-1 rounded-2xl border p-4 ${
                isCurrent
                  ? "border-[#002424]/15 bg-[#f4f8f7] shadow-[0_12px_35px_rgba(0,36,36,0.08)]"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p
                    className={`text-sm font-semibold uppercase tracking-[0.18em] ${
                      isCurrent ? "text-[#0b5b54]" : "text-gray-400"
                    }`}
                  >
                    {isCurrent ? "Current status" : isComplete ? "Completed" : "Pending"}
                  </p>
                  <h4 className="mt-1 text-lg font-semibold text-gray-900">{step.label}</h4>
                  <p className="mt-2 text-sm text-gray-500">{step.location}</p>
                </div>

                <p className="text-sm font-medium text-gray-500">{step.timestamp}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
