import { API_BASE, getBrowserApiBase } from "./config";

const CSRF_COOKIE_NAME = "csrftoken";
const isBrowser = typeof window !== "undefined";
const LEGACY_TOKEN_KEYS = ["access_token", "refresh_token", "access", "refresh"];
let refreshRequestPromise = null;

function getApiBase() {
  return isBrowser ? getBrowserApiBase() : API_BASE;
}

function normalizeApiUrl(url) {
  const base = getApiBase();

  if (!isBrowser || !base || !API_BASE || typeof url !== "string") {
    return url;
  }

  return url.startsWith(API_BASE) ? `${base}${url.slice(API_BASE.length)}` : url;
}

function getCookie(name) {
  if (!isBrowser) return null;

  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function clearLegacyTokenStorage() {
  if (!isBrowser) return;

  try {
    for (const key of LEGACY_TOKEN_KEYS) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  } catch (error) {
    console.error("Error clearing legacy auth tokens:", error);
  }
}

function isUnsafeMethod(method = "GET") {
  return !["GET", "HEAD", "OPTIONS", "TRACE"].includes(method.toUpperCase());
}

export async function ensureCsrfCookie() {
  if (!isBrowser) return null;

  let csrfToken = getCookie(CSRF_COOKIE_NAME);
  if (csrfToken) {
    return csrfToken;
  }

  const response = await fetch(`${getApiBase()}/api/auth/csrf/`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Unable to initialize security token.");
  }

  const data = await response.json();
  csrfToken = data.csrfToken || getCookie(CSRF_COOKIE_NAME);
  return csrfToken || null;
}

export async function apiFetch(url, options = {}) {
  const resolvedUrl = normalizeApiUrl(url);
  const method = (options.method || "GET").toUpperCase();
  const headers = {
    ...(options.headers || {}),
  };

  if (isUnsafeMethod(method)) {
    const csrfToken = await ensureCsrfCookie();
    if (csrfToken) {
      headers["X-CSRFToken"] = csrfToken;
    }
  }

  return fetch(resolvedUrl, {
    ...options,
    method,
    headers,
    credentials: "include",
  });
}

export async function signup(userData) {
  const response = await apiFetch(`${getApiBase()}/api/auth/signup/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw data;
  }

  return data;
}

export async function login(credentials) {
  clearLegacyTokenStorage();

  const response = await apiFetch(`${getApiBase()}/api/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });

  const data = await response.json();

  if (!response.ok) {
    throw data;
  }

  return data;
}

export async function getGoogleAuthNonce() {
  const response = await apiFetch(`${getApiBase()}/api/auth/google/nonce/`, {
    method: "GET",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to start Google login.");
  }

  return data;
}

export async function loginWithGoogle(credential, nonceToken) {
  clearLegacyTokenStorage();

  const response = await apiFetch(`${getApiBase()}/api/auth/google/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      credential,
      nonce_token: nonceToken,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Google login failed.");
  }

  return data;
}

export async function getSessionUser() {
  const response = await apiFetch(`${getApiBase()}/api/accounts/profile/`, {
    method: "GET",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to load session.");
  }

  const data = await response.json();
  return {
    id: data.id,
    email: data.email,
    first_name: data.first_name,
    last_name: data.last_name,
  };
}

export async function refreshAccessToken() {
  if (refreshRequestPromise) {
    return refreshRequestPromise;
  }

  refreshRequestPromise = (async () => {
    try {
      const response = await apiFetch(`${getApiBase()}/api/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        return {
          ok: false,
          shouldLogout: response.status === 400 || response.status === 401,
          reason: `http_${response.status}`,
        };
      }

      return {
        ok: true,
        shouldLogout: false,
        reason: null,
      };
    } catch (error) {
      return {
        ok: false,
        shouldLogout: false,
        reason: "network_error",
      };
    } finally {
      refreshRequestPromise = null;
    }
  })();

  return refreshRequestPromise;
}

export async function fetchWithAuth(url, options = {}) {
  let response = await apiFetch(url, options);

  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshAccessToken();

  if (!refreshed.ok) {
    if (refreshed.shouldLogout) {
      clearAuthSession();
      throw new Error("Session expired. Please login again.");
    }

    throw new Error("Unable to refresh session right now. Please try again.");
  }

  response = await apiFetch(url, options);
  return response;
}

export async function logoutRequest() {
  try {
    await apiFetch(`${getApiBase()}/api/auth/logout/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
  } catch {
    // Best effort logout; client state is still cleared below.
  }
}

export function clearStoredCart() {
  if (!isBrowser) return;

  try {
    localStorage.removeItem("cart");
  } catch (error) {
    console.error("Error clearing cart:", error);
  }
}

export function dispatchUserLogout() {
  if (!isBrowser) return;
  window.dispatchEvent(new Event("user-logout"));
}

export function clearAuthSession({ redirectTo = null } = {}) {
  clearLegacyTokenStorage();
  clearStoredCart();
  dispatchUserLogout();

  void logoutRequest();

  if (redirectTo && isBrowser) {
    window.location.href = redirectTo;
  }
}

export function getAccessToken() {
  return null;
}

export function getRefreshToken() {
  return null;
}

export function hasTokens() {
  return false;
}

export function isTokenExpired() {
  return false;
}

export function shouldRefreshToken() {
  return false;
}

if (isBrowser) {
  clearLegacyTokenStorage();
}
