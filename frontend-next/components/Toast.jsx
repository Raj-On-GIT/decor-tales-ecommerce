'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

// Toast types
const TOAST_TYPES = {
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-800',
    iconColor: 'text-green-500',
  },
  error: {
    icon: AlertCircle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-800',
    iconColor: 'text-red-500',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800',
    iconColor: 'text-blue-500',
  },
};

/**
 * Individual Toast Component
 */
function Toast({ message, type = 'info', onClose, duration = 3000 }) {
  const config = TOAST_TYPES[type] || TOAST_TYPES.info;
  const Icon = config.icon;

  useEffect(() => {
    if (duration) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className={`
        ${config.bgColor} ${config.borderColor} ${config.textColor}
        border-2 rounded-lg shadow-lg p-4 mb-3
        flex items-start gap-3 min-w-[300px] max-w-md
      `}
    >
      <Icon className={`${config.iconColor} flex-shrink-0 mt-0.5`} size={20} />
      
      <p className="flex-1 text-sm font-medium">{message}</p>
      
      <button
        onClick={onClose}
        className={`${config.iconColor} hover:opacity-70 transition flex-shrink-0`}
      >
        <X size={18} />
      </button>
    </motion.div>
  );
}

/**
 * Toast Container Component
 * Manages multiple toasts
 */
export function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="fixed top-4 right-4 z-[100] pointer-events-none">
      <div className="pointer-events-auto">
        <AnimatePresence>
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              message={toast.message}
              type={toast.type}
              onClose={() => removeToast(toast.id)}
              duration={toast.duration}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Toast Hook
 * Use this in your components
 * 
 * @returns {object} Toast functions
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'info', duration = 3000) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return {
    toasts,
    showToast,
    removeToast,
    success: (message, duration) => showToast(message, 'success', duration),
    error: (message, duration) => showToast(message, 'error', duration),
    info: (message, duration) => showToast(message, 'info', duration),
  };
}
