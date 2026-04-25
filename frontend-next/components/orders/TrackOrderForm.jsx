"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { trackOrder } from "@/lib/api";
import TrackingResultCard from "./TrackingResultCard";
import EmptyState from "./EmptyState";

const TRACKING_OPTIONS = [
  {
    id: "order",
    label: "Order ID",
    title: "Track with Order ID",
    cta: "Track Order",
    primaryLabel: "Order ID",
    primaryPlaceholder: "e.g. DT-2026-10482",
    helperText: "You can find your Order ID in your confirmation email.",
    errorText: "Enter a valid order ID to continue.",
  },
  {
    id: "tracking",
    label: "Tracking ID",
    title: "Track with Tracking ID",
    cta: "Track via Tracking ID",
    primaryLabel: "Tracking Number (Waybill)",
    primaryPlaceholder: "e.g. AWB 7845 2290 118",
    helperText: "Use the tracking number shared after your order is dispatched.",
    errorText: "Enter a valid tracking number to continue.",
  },
];

function isEmail(value) {
  return /\S+@\S+\.\S+/.test(String(value || "").trim());
}

function formatDateTime(value) {
  if (!value) {
    return "Pending";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getStepState(index, currentIndex) {
  if (currentIndex === -1) {
    return "upcoming";
  }

  if (index < currentIndex) {
    return "complete";
  }

  if (index === currentIndex) {
    return "current";
  }

  return "upcoming";
}

function buildTrackingSummary(status, destination) {
  if (!status) {
    return "Tracking updates are available for this shipment.";
  }

  if (destination) {
    return `${status} updates are currently available for the shipment moving toward ${destination}.`;
  }

  return `${status} updates are currently available for this shipment.`;
}

function mapTrackingResult(data) {
  const timeline = Array.isArray(data.timeline) ? data.timeline : [];
  const currentStatusCode = data.status?.code || "";
  const currentIndex = timeline.findIndex((step) => step.status_code === currentStatusCode);

  return {
    orderLabel: `Order #${data.order_number}`,
    status: data.status?.label || "Tracking Active",
    summary: buildTrackingSummary(data.status?.label, data.shipment?.destination),
    estimatedDelivery: formatDateTime(
      data.shipment?.expected_delivery_date || data.shipment?.promised_delivery_date,
    ),
    currentLocation: data.status?.location || data.shipment?.destination || "Not available",
    lastUpdated: formatDateTime(data.status?.timestamp),
    trackingNumber: data.waybill || "Not available",
    steps: timeline.map((step, index) => ({
      label: step.status || "Update",
      location: step.location || "Location unavailable",
      timestamp: formatDateTime(step.timestamp),
      state: getStepState(index, currentIndex),
    })),
  };
}

function Field({
  id,
  label,
  placeholder,
  helperText,
  value,
  onChange,
  showValidation,
  validationMessage,
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-gray-800">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-2xl border bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#0b5b54] focus:ring-4 focus:ring-[#0b5b54]/10 ${
          showValidation ? "border-rose-300" : "border-gray-200"
        }`}
      />
      <p className="mt-2 text-xs leading-5 text-gray-500">{helperText}</p>
      {showValidation ? (
        <p className="mt-2 text-xs font-medium text-rose-600">{validationMessage}</p>
      ) : null}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-[0_25px_70px_rgba(15,23,42,0.08)] sm:p-8">
      <div className="animate-pulse">
        <div className="h-4 w-32 rounded-full bg-gray-200" />
        <div className="mt-4 h-8 w-56 rounded-full bg-gray-200" />
        <div className="mt-3 h-4 w-full max-w-2xl rounded-full bg-gray-100" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 rounded-[1.5rem] bg-gray-100" />
          ))}
        </div>
        <div className="mt-8 space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex gap-4">
              <div className="h-10 w-10 rounded-full bg-gray-200" />
              <div className="flex-1 rounded-2xl bg-gray-100 p-4">
                <div className="h-4 w-32 rounded-full bg-gray-200" />
                <div className="mt-3 h-5 w-48 rounded-full bg-gray-200" />
                <div className="mt-3 h-4 w-full max-w-sm rounded-full bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TrackOrderForm() {
  const [activeTab, setActiveTab] = useState("order");
  const [orderId, setOrderId] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [contact, setContact] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const [requestState, setRequestState] = useState("idle");
  const [trackingResult, setTrackingResult] = useState(null);
  const [requestError, setRequestError] = useState("");

  const activeOption = useMemo(
    () => TRACKING_OPTIONS.find((option) => option.id === activeTab) || TRACKING_OPTIONS[0],
    [activeTab],
  );

  const primaryValue = activeTab === "order" ? orderId : trackingNumber;
  const isButtonDisabled = !primaryValue.trim() || !contact.trim();

  function resetFeedback() {
    setShowValidation(false);
    setRequestState("idle");
    setTrackingResult(null);
    setRequestError("");
  }

  function handleTabChange(nextTab) {
    setActiveTab(nextTab);
    resetFeedback();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isButtonDisabled) {
      setShowValidation(true);
      return;
    }

    setShowValidation(false);
    setRequestState("loading");
    setTrackingResult(null);
    setRequestError("");

    const normalizedContact = contact.trim();
    const payload = {
      orderId: activeTab === "order" ? primaryValue.trim() : "",
      waybill: activeTab === "tracking" ? primaryValue.trim() : "",
      email: isEmail(normalizedContact) ? normalizedContact : "",
      phone: isEmail(normalizedContact) ? "" : normalizedContact,
    };

    try {
      const data = await trackOrder(payload);
      const mappedResult = mapTrackingResult(data);
      setTrackingResult(mappedResult);
      setRequestState(mappedResult.steps.length > 0 ? "success" : "empty");
    } catch (error) {
      console.error("Track order failed:", error);
      setRequestError(error.message || "Unable to fetch tracking details.");
      setRequestState("error");
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-[0_25px_70px_rgba(15,23,42,0.08)] sm:p-8">
        <div className="flex flex-wrap gap-3 rounded-[1.5rem] bg-[#f5f7f4] p-2">
          {TRACKING_OPTIONS.map((option) => {
            const isActive = activeTab === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleTabChange(option.id)}
                className={`flex-1 rounded-[1.15rem] px-4 py-3 text-sm font-medium transition sm:text-base ${
                  isActive
                    ? "bg-white text-gray-900 shadow-[0_10px_30px_rgba(15,23,42,0.10)]"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="mt-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-teal-800/70">
                Quick lookup
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-gray-900">{activeOption.title}</h2>
            </div>
            <div className="hidden items-center gap-3 rounded-full border border-gray-200 bg-[#fbfcfa] px-4 py-2 text-xs font-medium text-gray-500 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Guest and account lookup ready
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field
              id={`${activeTab}-primary`}
              label={activeOption.primaryLabel}
              placeholder={activeOption.primaryPlaceholder}
              helperText={activeOption.helperText}
              value={primaryValue}
              onChange={(value) => {
                if (activeTab === "order") {
                  setOrderId(value);
                } else {
                  setTrackingNumber(value);
                }
              }}
              showValidation={showValidation && !primaryValue.trim()}
              validationMessage={activeOption.errorText}
            />

            <Field
              id={`${activeTab}-contact`}
              label="Email or Phone Number"
              placeholder="e.g. your@email.com or +91 98765 43210"
              helperText="Use the email address or phone number used when placing the order."
              value={contact}
              onChange={setContact}
              showValidation={showValidation && !contact.trim()}
              validationMessage="Enter the email or phone number associated with the order."
            />
          </div>

          <div className="my-8 flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
            <div className="h-px flex-1 bg-gray-200" />
            <span>Or</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="rounded-[1.5rem] border border-dashed border-gray-200 bg-[#fcfcfb] p-4 text-sm text-gray-500">
            Switch tabs above to use the alternate tracking method without leaving the page.
          </div>

          <div className="mt-6 flex flex-col gap-4 border-t border-gray-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-500">
              Logged in users can view all orders in My Orders.{" "}
              <Link href="/orders" className="font-medium text-[#0b5b54] hover:underline">
                Go to My Orders
              </Link>
            </div>

            <button
              type="submit"
              disabled={isButtonDisabled || requestState === "loading"}
              className="inline-flex items-center justify-center rounded-2xl bg-[#002424] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#0b5b54] disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {requestState === "loading" ? "Tracking..." : activeOption.cta}
            </button>
          </div>
        </form>
      </section>

      {requestState === "loading" ? <LoadingSkeleton /> : null}
      {requestState === "success" && trackingResult ? (
        <TrackingResultCard result={trackingResult} />
      ) : null}
      {requestState === "empty" ? <EmptyState variant="empty" /> : null}
      {requestState === "error" ? (
        <div className="space-y-4">
          <EmptyState variant="error" />
          {requestError ? (
            <p className="text-center text-sm text-gray-500">{requestError}</p>
          ) : null}
        </div>
      ) : null}

      {requestState === "idle" ? (
        <div className="rounded-[1.75rem] border border-dashed border-gray-200 bg-white/60 p-8 text-center text-sm text-gray-500">
          Tracking results will appear here once the tracking service is connected.
        </div>
      ) : null}
    </div>
  );
}
