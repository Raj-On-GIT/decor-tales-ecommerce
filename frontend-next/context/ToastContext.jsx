"use client";

import { createContext, useContext } from "react";
import { ToastContainer, useToast } from "@/components/Toast"; // adjust path if needed

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const toast = useToast();

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer
        toasts={toast.toasts}
        removeToast={toast.removeToast}
      />
    </ToastContext.Provider>
  );
}

export function useGlobalToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useGlobalToast must be used inside ToastProvider");
  }
  return context;
}