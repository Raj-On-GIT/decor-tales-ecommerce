"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, Lock, Shield } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function ChangePasswordPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
  const router = useRouter();
  const { logout } = useAuth();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      setLoading(false);
      return;
    }

    const accessToken =
      typeof window !== "undefined"
        ? localStorage.getItem("access_token")
        : null;

    try {
      const res = await fetch(`${API_BASE}/api/accounts/change-password/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const firstError = Object.values(data)?.[0];
        const errorMessage = Array.isArray(firstError)
          ? firstError[0]
          : firstError || data.detail || "Password change failed";

        throw new Error(errorMessage);
      }

      setMessage("Password changed successfully. Please login again.");

      setTimeout(() => {
        logout();
        router.push("/login");
      }, 1500);

      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#e8f3f1] via-white to-[#f6efe2] px-4 py-6">
      <div className="absolute -left-32 -top-32 h-[360px] w-[360px] rounded-full bg-[#2f5d56]/20 blur-[110px]" />
      <div className="absolute -bottom-32 -right-24 h-[300px] w-[300px] rounded-full bg-[#ffb347]/20 blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/40 bg-white/70 shadow-[0_20px_60px_rgba(0,0,0,0.15)] backdrop-blur-xl md:grid-cols-2"
      >
        <div className="flex flex-col justify-center p-8 md:p-12">
          <h1 className="mb-3 text-3xl font-bold text-gray-900">
            Change Password
          </h1>
          <p className="mb-6 text-sm text-gray-600">
            Update your password to keep your account secure.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type={showOldPassword ? "text" : "password"}
                placeholder="Current Password"
                className="w-full rounded-full border border-gray-200 py-3 pl-12 pr-12 transition focus:border-gray-900 focus:outline-none"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowOldPassword(!showOldPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showOldPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="relative">
              <Lock
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type={showNewPassword ? "text" : "password"}
                placeholder="New Password"
                className="w-full rounded-full border border-gray-200 py-3 pl-12 pr-12 transition focus:border-gray-900 focus:outline-none"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="relative">
              <Lock
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm New Password"
                className="w-full rounded-full border border-gray-200 py-3 pl-12 pr-12 transition focus:border-gray-900 focus:outline-none"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
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
              {loading ? "Updating..." : "Change Password"}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between gap-4 text-sm">
            <Link
              href="/account"
              className="font-medium text-gray-600 transition hover:text-gray-900"
            >
              Back to account
            </Link>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Shield size={14} className="text-[#2f5d56]" />
              <span>Secure password update</span>
            </div>
          </div>
        </div>

        <div className="relative hidden items-center justify-center overflow-hidden p-10 md:flex">
          <div className="absolute inset-0 bg-[length:200%_200%] bg-gradient-to-br from-[#2f5d56] via-[#3c7a70] to-[#1f3f3b] animate-gradient-slow" />
          <div
            className="absolute inset-0 scale-110 bg-cover bg-center opacity-75 blur-lg"
            style={{ backgroundImage: "url('/signup.jpg')" }}
          />
          <div className="absolute inset-0 bg-black/10" />

          <div className="relative flex max-w-xs flex-col items-center text-center text-white">
            <h2 className="mb-4 text-3xl font-bold">Keep It Locked Down</h2>
            <p className="mb-6 text-sm opacity-90">
              A strong password keeps your orders, addresses, and profile safe.
            </p>

            <Link
              href="/account"
              className="inline-block rounded-full border border-white px-6 py-2 transition hover:bg-white hover:text-[#2f5d56]"
            >
              My Account
            </Link>

            <Link
              href="/"
              className="group mt-6 flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-2 text-sm font-medium text-white backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:scale-105 hover:bg-white hover:text-[#2f5d56]"
            >
              <ArrowLeft
                size={16}
                className="transition-transform duration-300 group-hover:-translate-x-1"
              />
              Home
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
