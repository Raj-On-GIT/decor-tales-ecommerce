"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Shield } from "lucide-react";
import { API_BASE } from "@/lib/config";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Something went wrong");
      }

      setMessage("If the email exists, a reset link has been sent.");
      setEmail("");
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
            Forgot Password
          </h1>
          <p className="mb-6 text-sm text-gray-600">
            Enter your email and we&apos;ll send you a reset link.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="relative">
              <Mail
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="email"
                placeholder="Email Address"
                className="w-full rounded-full border border-gray-200 py-3 pl-12 pr-4 transition focus:border-gray-900 focus:outline-none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
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
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between gap-4 text-sm">
            <Link
              href="/login"
              className="font-medium text-gray-600 transition hover:text-gray-900"
            >
              Back to login
            </Link>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Shield size={14} className="text-[#2f5d56]" />
              <span>Secure reset flow</span>
            </div>
          </div>
        </div>

        <div className="relative hidden items-center justify-center overflow-hidden p-10 md:flex">
          <div className="absolute inset-0 bg-[length:200%_200%] bg-gradient-to-br from-[#2f5d56] via-[#3c7a70] to-[#1f3f3b] animate-gradient-slow" />
          <div
            className="absolute inset-0 scale-110 bg-cover bg-center opacity-75 blur-lg"
            style={{ backgroundImage: "url('/login-bg.jpg')" }}
          />
          <div className="absolute inset-0 bg-black/10" />

          <div className="relative flex max-w-xs flex-col items-center text-center text-white">
            <h2 className="mb-4 text-3xl font-bold">Reset With Ease</h2>
            <p className="mb-6 text-sm opacity-90">
              We&apos;ll help you get back into your account in a few steps.
            </p>

            <Link
              href="/login"
              className="inline-block rounded-full border border-white px-6 py-2 transition hover:bg-white hover:text-[#2f5d56]"
            >
              Sign In
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
