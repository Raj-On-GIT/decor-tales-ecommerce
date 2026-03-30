"use client";

import { useEffect, useRef } from "react";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function ViewportReveal({
  as: Component = "div",
  children,
  className = "",
  stagger = false,
  threshold = 0.14,
  rootMargin = "0px 0px -10% 0px",
}) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;

    if (!element || typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (mediaQuery.matches) {
      element.dataset.revealEnabled = "false";
      element.dataset.revealState = "visible";
      return undefined;
    }

    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;
    const rect = element.getBoundingClientRect();
    const isInitiallyVisible = rect.top < viewportHeight && rect.bottom > 0;

    if (isInitiallyVisible || rect.top < 0) {
      element.dataset.revealEnabled = "false";
      element.dataset.revealState = "visible";
      return undefined;
    }

    element.dataset.revealEnabled = "true";
    element.dataset.revealState = "hidden";

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }

        element.dataset.revealState = "visible";
        observer.disconnect();
      },
      {
        threshold,
        rootMargin,
      },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  return (
    <Component
      ref={ref}
      className={cx(className)}
      data-reveal="true"
      data-reveal-enabled="false"
      data-reveal-stagger={stagger ? "true" : "false"}
      data-reveal-state="visible"
    >
      {children}
    </Component>
  );
}
