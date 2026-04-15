"use client";

import { useEffect, useRef, useState } from "react";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("SSR"));
      return;
    }

    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existing = document.getElementById("google-gsi-script");
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Google script failed to load")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = "google-gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Google script failed to load"));
    document.head.appendChild(script);
  });
}

export default function GoogleAuthButton({
  text = "Continue with Google",
  nonce,
  onSuccess,
  onError,
  disabled = false,
  loading = false,
}) {
  const callbackRef = useRef(onSuccess);
  const buttonRef = useRef(null);
  const [buttonWidth, setButtonWidth] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    callbackRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    if (!buttonRef.current || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(([entry]) => {
      setButtonWidth(Math.max(240, Math.round(entry.contentRect.width)));
    });

    observer.observe(buttonRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initialiseButton() {
      if (!nonce || !buttonRef.current) {
        setIsReady(false);
        return;
      }

      if (!GOOGLE_CLIENT_ID) {
        setIsReady(false);
        onError?.("Google Sign-In is not configured for this deployment.");
        return;
      }

      try {
        await loadGoogleScript();

        if (cancelled || !buttonRef.current) {
          return;
        }

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (credentialResponse) =>
            callbackRef.current?.(credentialResponse),
          nonce,
          auto_select: false,
          use_fedcm_for_prompt: true,
        });

        buttonRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: text.toLowerCase().includes("sign up")
            ? "signup_with"
            : "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: buttonWidth || 320,
        });

        setIsReady(true);
      } catch {
        if (!cancelled) {
          setIsReady(false);
          onError?.("Failed to load Google Sign-In. Please refresh and try again.");
        }
      }
    }

    void initialiseButton();

    return () => {
      cancelled = true;
    };
  }, [buttonWidth, nonce, onError, text]);

  if (loading) {
    return (
      <div
        className="
          w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3
          flex items-center justify-center gap-3 animate-pulse
        "
      >
        <div className="h-[18px] w-[18px] rounded-full bg-gray-200" />
        <div className="h-4 w-36 rounded bg-gray-200" />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        className={`overflow-hidden rounded-lg border border-gray-200 bg-white transition ${
          disabled ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <div ref={buttonRef} className="min-h-[48px] w-full" />
      </div>

      {!isReady && nonce ? (
        <p className="mt-2 text-center text-xs text-gray-500">
          Initialising Google Sign-In...
        </p>
      ) : null}
    </div>
  );
}
