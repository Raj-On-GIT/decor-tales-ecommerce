"use client";

import { useEffect, useRef } from "react";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

/**
 * Injects the Google Identity Services script once per page.
 * Resolves immediately if already loaded.
 */
function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("SSR"));

    // Already loaded
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    // Script tag already injected — wait for it
    const existing = document.getElementById("google-gsi-script");
    if (existing) {
      existing.addEventListener("load", resolve);
      existing.addEventListener("error", () =>
        reject(new Error("Google script failed to load")),
      );
      return;
    }

    // Inject fresh script tag
    const script = document.createElement("script");
    script.id = "google-gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () =>
      reject(new Error("Google script failed to load"));
    document.head.appendChild(script);
  });
}

/**
 * GoogleAuthButton
 *
 * A full-width, custom-styled Google sign-in button that uses the
 * Google Identity Services (`google.accounts.id`) prompt API.
 *
 * Props:
 *  - text        {string}   Button label. Default: "Continue with Google"
 *  - nonce       {string}   Nonce value from your backend for ID-token validation
 *  - onSuccess   {function} Called with the raw CredentialResponse from Google
 *  - onError     {function} Called with an error message string
 *  - disabled    {boolean}  Disables the button (e.g. while form is submitting)
 *  - loading     {boolean}  Shows a skeleton/loading state before nonce arrives
 */
export default function GoogleAuthButton({
  text = "Continue with Google",
  nonce,
  onSuccess,
  onError,
  disabled = false,
  loading = false,
}) {
  // Keep a stable ref to the latest onSuccess so the GIS callback is never stale
  const callbackRef = useRef(onSuccess);
  useEffect(() => {
    callbackRef.current = onSuccess;
  }, [onSuccess]);

  const readyRef = useRef(false);

  // (Re-)initialize GIS whenever a valid nonce becomes available
  useEffect(() => {
    if (!nonce) return;

    readyRef.current = false;

    loadGoogleScript()
      .then(() => {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          // Proxy to the latest callback without re-initializing
          callback: (credentialResponse) =>
            callbackRef.current?.(credentialResponse),
          nonce,
          // Cancel the automatic One-Tap prompt; we trigger manually on click
          auto_select: false,
        });
        readyRef.current = true;
      })
      .catch(() => {
        onError?.(
          "Failed to load Google Sign-In. Please refresh and try again.",
        );
      });
  }, [nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = () => {
    if (!readyRef.current) {
      onError?.(
        "Google Sign-In is still initialising. Please try again in a moment.",
      );
      return;
    }
    window.google.accounts.id.prompt((notification) => {
      // If the One-Tap / FedCM dialog was suppressed (user dismissed it
      // before, browser blocks it, etc.) surface a gentle error so the
      // parent can decide what to do.
      if (
        notification.isNotDisplayed() ||
        notification.isSkippedMoment()
      ) {
        const reason =
          notification.getNotDisplayedReason?.() ||
          notification.getSkippedReason?.() ||
          "unknown";
        onError?.(
          `Google Sign-In could not be shown (${reason}). Please try again or use email/password.`,
        );
      }
    });
  };

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="
          w-full py-3 px-4 rounded-lg
          border border-gray-200 bg-gray-50
          flex items-center justify-center gap-3
          animate-pulse
        "
      >
        <div className="w-[18px] h-[18px] rounded-full bg-gray-200" />
        <div className="h-4 w-36 rounded bg-gray-200" />
      </div>
    );
  }

  // ── Button ──────────────────────────────────────────────────────────────
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || !nonce}
      className="
        w-full
        flex items-center justify-center gap-3
        py-3 px-4
        border border-gray-200 rounded-lg
        bg-white hover:bg-gray-50
        text-gray-700 font-medium text-sm
        transition
        disabled:opacity-60 disabled:cursor-not-allowed
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300
      "
    >
      <GoogleIcon />
      <span>{text}</span>
    </button>
  );
}

// ── Inline Google "G" logo ─────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}