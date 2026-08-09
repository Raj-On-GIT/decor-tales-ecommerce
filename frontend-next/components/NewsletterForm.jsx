"use client";

import { useState } from "react";
import { useGlobalToast } from "@/context/ToastContext";
import { subscribeToNewsletter } from "@/lib/api";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function NewsletterForm({ source = "footer", variant = "dark" }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const toast = useGlobalToast();

  const isDark = variant === "dark";

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmed = email.trim();

    if (!trimmed) {
      toast.error("Please enter your email address.");
      return;
    }

    if (!EMAIL_REGEX.test(trimmed)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setStatus("submitting");

    try {
      const result = await subscribeToNewsletter(trimmed, source);

      if (result?.status === "already_subscribed") {
        toast.info("You're already subscribed to our newsletter.");
      } else {
        toast.success("You're subscribed! Welcome to Decor Tales.");
      }

      setEmail("");
    } catch (error) {
      toast.error(error.message || "Could not subscribe. Please try again.");
    } finally {
      setStatus("idle");
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-0">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email address"
          aria-label="Email address"
          className={`w-full rounded-md px-4 py-2.5 focus:outline-none focus:ring-1 transition-colors sm:rounded-l-md sm:rounded-r-none ${
            isDark
              ? "border border-[#44403C] bg-[#292524] text-[#FAFAF9] placeholder-[#A8A29E] focus:border-[#D4A373] focus:ring-[#D4A373]"
              : "border border-[#E7E5E4] bg-white text-[#1C1917] placeholder-[#A8A29E] focus:border-[#D4A373] focus:ring-[#D4A373]"
          }`}
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className={`rounded-md bg-[#D4A373] px-5 py-2.5 font-semibold text-[#1C1917] transition-colors hover:bg-[#E6CCBE] disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-l-none sm:rounded-r-md`}
        >
          {status === "submitting" ? "Subscribing…" : "Subscribe"}
        </button>
      </div>
    </form>
  );
}
