"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowLeft, Shield } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  getGoogleAuthNonce,
  login as loginRequest,
  loginWithGoogle,
} from "@/lib/auth";
import GoogleAuthButton from "@/components/GoogleAuthButton";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleNonce, setGoogleNonce] = useState(null);
  const [googleNonceToken, setGoogleNonceToken] = useState(null);
  const [googleLoading, setGoogleLoading] = useState(true);
  const [isGoogleRedirecting, setIsGoogleRedirecting] = useState(false);
  const isFormLocked = loading || isGoogleRedirecting;

  useEffect(() => {
    router.prefetch("/");
  }, [router]);

  useEffect(() => {
    let active = true;

    async function loadGoogleNonce() {
      try {
        setGoogleLoading(true);
        const data = await getGoogleAuthNonce();

        if (!active) return;

        setGoogleNonce(data.nonce);
        setGoogleNonceToken(data.nonce_token);
      } catch (err) {
        if (!active) return;
        setError(err.message || "Google login is unavailable right now.");
      } finally {
        if (active) {
          setGoogleLoading(false);
        }
      }
    }

    loadGoogleNonce();

    return () => {
      active = false;
    };
  }, []);

  // Called by GoogleAuthButton with the raw CredentialResponse from GIS.
  // Preserves the exact same payload and auth flow as before.
  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse.credential || !googleNonceToken) {
      setError(
        "Google login could not be initialized. Please refresh and try again.",
      );
      return;
    }

    try {
      setError("");
      setIsGoogleRedirecting(true);

      const data = await loginWithGoogle(
        credentialResponse.credential,
        googleNonceToken,
      );

      await login({ user: data.user });

      router.refresh();
      router.replace("/");
    } catch (err) {
      setIsGoogleRedirecting(false);
      setError(err?.message || err?.error || "Google login failed");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await loginRequest({
        username: formData.email,
        password: formData.password,
      });
      await login({ user: data.user });

      router.refresh();
      router.replace("/");
    } catch (err) {
      const message =
        err?.non_field_errors?.[0] ||
        err?.detail ||
        err?.message ||
        "Login failed. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#e8f3f1] via-white to-[#f6efe2] px-5 sm:px-10">
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-[#2f5d56]/30 rounded-full blur-[120px]" />
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-[#ffb347]/20 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="
          relative
          w-full max-w-5xl
          backdrop-blur-xl
          bg-white/70
          border border-white/40
          rounded-xl
          shadow-[0_20px_60px_rgba(0,0,0,0.15)]
          overflow-hidden
          grid grid-cols-1 md:grid-cols-2
        "
      >
        <div className="p-5 md:p-12 flex flex-col justify-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Sign In</h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="relative">
              <Mail
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                disabled={isFormLocked}
                placeholder="Email Address"
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg
                           focus:outline-none focus:border-gray-900 transition
                           disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                required
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                disabled={isFormLocked}
                placeholder="Password"
                className="w-full pl-12 pr-12 py-3 border border-gray-200 rounded-lg
                           focus:outline-none focus:border-gray-900 transition
                           disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                required
              />
              <button
                type="button"
                disabled={isFormLocked}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Forgot password */}
            <div className="text-left px-2">
              <Link
                href="/forgot-password"
                className={`text-sm ${
                  isFormLocked
                    ? "pointer-events-none text-gray-400"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Forgot password?
              </Link>
            </div>

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-600 text-sm"
              >
                {error}
              </motion.div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isFormLocked}
              className="
                w-full
                bg-[#2f5d56] hover:bg-[#244944]
                text-white font-semibold
                py-3 rounded-lg
                transition
                disabled:opacity-80 disabled:cursor-not-allowed
                flex items-center justify-center gap-2
              "
            >
              {loading && !isGoogleRedirecting && (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}
              {loading ? "Logging In..." : "Sign In"}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-gray-500 text-sm">Or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Google button area */}
            {isGoogleRedirecting ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full rounded-lg border border-[#d9e5e2] bg-white px-4 py-3"
              >
                <div className="flex items-center justify-center gap-3 text-sm font-medium text-[#244944]">
                  <span className="h-4 w-4 rounded-full border-2 border-[#2f5d56]/20 border-t-[#2f5d56] animate-spin" />
                  Completing Google sign in...
                </div>
                <p className="mt-2 text-center text-xs text-gray-500">
                  Redirecting to the homepage
                </p>
              </motion.div>
            ) : (
              <div className="pt-3">
                <GoogleAuthButton
                  text="Continue with Google"
                  nonce={googleNonce}
                  onSuccess={handleGoogleSuccess}
                  onError={(msg) => setError(msg || "Google login failed")}
                  disabled={isFormLocked}
                  loading={googleLoading}
                />
              </div>
            )}
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
            <Shield size={14} className="text-gray-400" />
            <span>Your information is securely encrypted</span>
          </div>
        </div>

        {/* Right panel — unchanged */}
        <div className="hidden md:flex relative items-center justify-center p-12 overflow-hidden">
          <div
            className="absolute inset-0 
                bg-[length:200%_200%] 
                bg-gradient-to-br 
                from-[#2f5d56] 
                via-[#3c7a70] 
                to-[#1f3f3b] 
                animate-gradient-slow"
          />

          <div
            className="absolute inset-0 bg-cover bg-center opacity-70 blur-xl scale-110"
            style={{ backgroundImage: "url('/login-bg.jpg')" }}
          />

          <div className="absolute inset-0 bg-black/10" />

          <div className="relative text-white text-center max-w-xs flex flex-col items-center">
            <h2 className="text-3xl font-bold mb-4">Hey There!</h2>
            <p className="text-sm opacity-90 mb-6">
              Create your account and explore our premium collection.
            </p>
            <Link
              href="/signup"
              className="inline-block border border-white px-6 py-2 rounded-full hover:bg-white hover:text-[#2f5d56] transition"
            >
              Sign Up
            </Link>

            <Link
              href="/"
              className="mt-6 px-6 py-2 rounded-full
               bg-white/10 backdrop-blur-sm
               border border-white/20
               text-white text-sm font-medium
               flex items-center gap-2
               transition-all duration-300
               hover:bg-white hover:text-[#2f5d56]
               hover:scale-105 hover:-translate-y-0.5
               group"
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