import { AlertCircle, PackageSearch } from "lucide-react";

const variants = {
  empty: {
    icon: PackageSearch,
    title: "No tracking data found",
    description:
      "We could not find tracking updates for the details entered. Double-check your Order ID or Tracking Number and try again.",
    iconClasses: "bg-gray-100 text-gray-600",
  },
  error: {
    icon: AlertCircle,
    title: "Invalid Order ID or Tracking Number",
    description:
      "Please review the information entered. Make sure the ID matches your confirmation email or courier message.",
    iconClasses: "bg-rose-100 text-rose-600",
  },
};

export default function EmptyState({ variant = "empty" }) {
  const config = variants[variant] || variants.empty;
  const Icon = config.icon;

  return (
    <div className="rounded-[1.75rem] border border-dashed border-gray-200 bg-white/90 p-8 text-center shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
      <div
        className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${config.iconClasses}`}
      >
        <Icon size={26} />
      </div>
      <h3 className="mt-5 text-xl font-semibold text-gray-900">{config.title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-500 sm:text-base">
        {config.description}
      </p>
    </div>
  );
}
