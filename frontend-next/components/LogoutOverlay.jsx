"use client";

import { motion, AnimatePresence } from "framer-motion";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function LogoutOverlay() {
  const { isLoggingOut } = useAuth();

  return (
    <AnimatePresence>
      {isLoggingOut && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-[#FAFAF9]/90 backdrop-blur-sm"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1C1917] text-[#D4A373] shadow-premium-hover">
              <LogOut size={24} />
            </div>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-black" />
            <div className="text-center">
              <p className="text-lg font-semibold text-[#1C1917]">
                Signing you out…
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Redirecting to home.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
