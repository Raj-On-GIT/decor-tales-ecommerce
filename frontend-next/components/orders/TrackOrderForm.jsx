"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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

const mockResult = {
  orderLabel: "Order #DT-2026-10482",
  status: "In Transit",
  summary:
    "Your order has left the regional hub and is moving toward the final delivery center.",
  estimatedDelivery: "Tuesday, 22 April",
  currentLocation: "Bengaluru Line Haul Center",
  lastUpdated: "18 April 2026, 11:20 AM",
  trackingNumber: "AWB 7845 2290 118",
  steps: [
    {
      label: "Order Placed",
      location: "Decor Tales Storefront",
      timestamp: "16 April 2026, 09:18 AM",
      state: "complete",
    },
    {
      label: "Picked Up",
      location: "Mumbai Fulfillment Center",
      timestamp: "16 April 2026, 07:40 PM",
      state: "complete",
    },
    {
      label: "In Transit",
      location: "Bengaluru Line Haul Center",
      timestamp: "18 April 2026, 11:20 AM",
      state: "current",
    },
    {
      label: "Out for Delivery",
      location: "Assigned after arrival at destination hub",
      timestamp: "Pending",
      state: "upcoming",
    },
    {
      label: "Delivered",
      location: "Delivery address",
      timestamp: "Pending",
      state: "upcoming",
    },
  ],
};

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
  const [demoState, setDemoState] = useState("hidden");

  const activeOption = useMemo(
    () => TRACKING_OPTIONS.find((option) => option.id === activeTab) || TRACKING_OPTIONS[0],
    [activeTab],
  );

  const primaryValue = activeTab === "order" ? orderId : trackingNumber;
  const isButtonDisabled = !primaryValue.trim() || !contact.trim();

  function resetFeedback() {
    setShowValidation(false);
    setDemoState("hidden");
  }

  function handleTabChange(nextTab) {
    setActiveTab(nextTab);
    resetFeedback();
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (isButtonDisabled) {
      setShowValidation(true);
      return;
    }

    setShowValidation(false);
    setDemoState("result");
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
              disabled={isButtonDisabled}
              className="inline-flex items-center justify-center rounded-2xl bg-[#002424] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#0b5b54] disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {activeOption.cta}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/75 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">
              Demo controls
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Result cards stay hidden by default. Use these controls to preview future backend states.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setDemoState("result")}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
            >
              Show sample result
            </button>
            <button
              type="button"
              onClick={() => setDemoState("loading")}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
            >
              Preview loading
            </button>
            <button
              type="button"
              onClick={() => setDemoState("empty")}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
            >
              No data state
            </button>
            <button
              type="button"
              onClick={() => setDemoState("error")}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
            >
              Invalid state
            </button>
            <button
              type="button"
              onClick={() => setDemoState("hidden")}
              className="rounded-full border border-transparent px-4 py-2 text-sm font-medium text-gray-500 transition hover:text-gray-700"
            >
              Hide all
            </button>
          </div>
        </div>
      </section>

      {demoState === "loading" ? <LoadingSkeleton /> : null}
      {demoState === "result" ? <TrackingResultCard result={mockResult} /> : null}
      {demoState === "empty" ? <EmptyState variant="empty" /> : null}
      {demoState === "error" ? <EmptyState variant="error" /> : null}

      {demoState === "hidden" ? (
        <div className="rounded-[1.75rem] border border-dashed border-gray-200 bg-white/60 p-8 text-center text-sm text-gray-500">
          Tracking results will appear here once the tracking service is connected.
        </div>
      ) : null}
    </div>
  );
}
