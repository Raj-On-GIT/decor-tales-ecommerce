"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribe(callback) {
  const mq = window.matchMedia(reducedMotionQuery);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(reducedMotionQuery).matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

export default function CyclingBadge({
  discountPercent,
  isCustomizable = false,
  interval = 3000,
}) {
  const [showDiscount, setShowDiscount] = useState(true);
  const reducedMotion = useSyncExternalStore(
    subscribe,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  const hasDiscount = typeof discountPercent === "number";

  useEffect(() => {
    if (!hasDiscount || !isCustomizable || reducedMotion) return;
    const id = setInterval(() => setShowDiscount((value) => !value), interval);
    return () => clearInterval(id);
  }, [hasDiscount, isCustomizable, interval, reducedMotion]);

  if (!hasDiscount && !isCustomizable) return null;

  const cycling = hasDiscount && isCustomizable && !reducedMotion;
  const label =
    showDiscount && hasDiscount ? `${discountPercent}% OFF` : "Customizable";

  return (
    <span className="inline-grid items-center justify-items-center overflow-hidden whitespace-nowrap rounded-md bg-[#E6CCBE] px-1.5 py-[2px] text-[10px] font-semibold text-[#1C1917] sm:rounded-full sm:px-2 sm:py-0.5 sm:text-xs tracking-wide">
      {cycling ? (
        <>
          <span className="invisible col-start-1 row-start-1" aria-hidden="true">
            Customizable
          </span>
          <span className="col-start-1 row-start-1">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={label}
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -12, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="block"
              >
                {label}
              </motion.span>
            </AnimatePresence>
          </span>
        </>
      ) : (
        label
      )}
    </span>
  );
}
