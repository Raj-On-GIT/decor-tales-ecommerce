const rawApiUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "";

export const API_BASE = rawApiUrl.replace(/\/$/, "");
export const BACKEND = API_BASE;
export const RAZORPAY_KEY = process.env.NEXT_PUBLIC_RAZORPAY_KEY || "";
let hasWarnedLoopbackMismatch = false;

function isLoopbackHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function getBrowserApiBase() {
  if (typeof window === "undefined" || !API_BASE) {
    return API_BASE;
  }

  try {
    const parsed = new URL(API_BASE);
    const browserHost = window.location.hostname;

    if (!isLoopbackHost(parsed.hostname) || !isLoopbackHost(browserHost)) {
      return API_BASE;
    }

    if (parsed.hostname === browserHost) {
      return API_BASE;
    }

    if (
      process.env.NODE_ENV !== "production" &&
      !hasWarnedLoopbackMismatch
    ) {
      hasWarnedLoopbackMismatch = true;
      console.warn(
        `Loopback host mismatch detected: frontend is on ${browserHost} but NEXT_PUBLIC_API_URL points to ${parsed.hostname}. Rewriting browser API requests to ${browserHost} so local cookie auth keeps working.`,
      );
    }

    parsed.hostname = browserHost;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return API_BASE;
  }
}

if (!API_BASE) {
  console.warn(
    "NEXT_PUBLIC_API_URL is not set. Falling back to legacy public API env vars failed.",
  );
}

if (!RAZORPAY_KEY) {
  console.warn("NEXT_PUBLIC_RAZORPAY_KEY is not set.");
}
