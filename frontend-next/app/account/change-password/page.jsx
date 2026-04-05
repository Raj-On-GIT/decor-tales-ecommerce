"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, Shield } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/auth";
import { API_BASE } from "@/lib/config";

export default function ChangePasswordPage() {
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

    try {
      const res = await apiFetch(`${API_BASE}/api/accounts/change-password/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full rounded-2xl bg-white p-5 shadow-xl sm:p-6 lg:max-w-2xl lg:p-8"
    >
      <h1 className="mb-3 text-2xl font-bold text-gray-900">Change Password</h1>
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

      <div className="mt-6 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
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
    </motion.div>
  );
}
