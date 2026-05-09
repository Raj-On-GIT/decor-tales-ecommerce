"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, Lock, Shield } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/auth";
import { API_BASE } from "@/lib/config";

export default function ResetPasswordPage() {
  const { uid, token } = useParams();
  const router = useRouter();
  const { logout } = useAuth();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const res = await apiFetch(`${API_BASE}/api/auth/reset-password/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid,
          token,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const firstError = Object.values(data)?.[0];
        const errorMessage = Array.isArray(firstError)
          ? firstError[0]
          : firstError || "Reset failed";

        throw new Error(errorMessage);
      }

      setMessage("Password reset successful. Redirecting to login...");

      setTimeout(() => {
        logout();
        router.push("/login");
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-160px)] items-center justify-center overflow-hidden bg-gradient-to-br from-[#edf6f2] via-[#fcfcf9] to-[#f6efe2] px-4 py-10 sm:px-6">
      <div className="absolute -left-28 -top-24 h-[280px] w-[280px] rounded-full bg-[#2f5d56]/16 blur-[90px]" />
      <div className="absolute -bottom-24 -right-20 h-[240px] w-[240px] rounded-full bg-[#d9a86c]/18 blur-[86px]" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative w-full max-w-lg rounded-[28px] border border-white/50 bg-white/82 p-6 shadow-[0_20px_60px_rgba(32,55,49,0.12)] backdrop-blur-md sm:p-8"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Reset Password
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Choose a new password for your account.
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2f5d56]/10 text-[#2f5d56]">
            <Shield size={18} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter new password"
              className="w-full rounded-full border border-gray-200 bg-white/90 py-3 pl-12 pr-12 text-gray-900 transition focus:border-[#2f5d56] focus:outline-none focus:ring-4 focus:ring-[#2f5d56]/10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className="relative">
            <Lock
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm new password"
              className="w-full rounded-full border border-gray-200 bg-white/90 py-3 pl-12 pr-12 text-gray-900 transition focus:border-[#2f5d56] focus:outline-none focus:ring-4 focus:ring-[#2f5d56]/10"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((value) => !value)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
              aria-label={
                showConfirmPassword ? "Hide confirm password" : "Show confirm password"
              }
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {message && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700"
            >
              {message}
            </motion.div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600"
            >
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#2f5d56] py-3 font-semibold text-white transition hover:bg-[#244944] disabled:cursor-not-allowed disabled:opacity-80"
          >
            {loading && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 font-medium text-gray-600 transition hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            Back to login
          </Link>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Shield size={14} className="text-[#2f5d56]" />
            <span>Secure password reset</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
