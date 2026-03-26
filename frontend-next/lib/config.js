const rawApiUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "";

export const API_BASE = rawApiUrl.replace(/\/$/, "");
export const BACKEND = API_BASE;

if (!API_BASE) {
  console.warn(
    "NEXT_PUBLIC_API_URL is not set. Falling back to legacy public API env vars failed.",
  );
}
