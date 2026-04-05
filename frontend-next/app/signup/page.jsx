"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  ArrowLeft,
  Phone,
  Shield,
} from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/context/AuthContext";
import { getGoogleAuthNonce, loginWithGoogle } from "@/lib/auth";
import { API_BASE } from "@/lib/config";

export default function SignupPage() {
  const router = useRouter();
  const { login: authLogin } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleNonce, setGoogleNonce] = useState(null);
  const [googleNonceToken, setGoogleNonceToken] = useState(null);
  const [googleLoading, setGoogleLoading] = useState(true);

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
        setError(err.message || "Google signup is unavailable right now.");
      } finally {
        if (active) {
          setGoogleLoading(false);
        }
      }
    }

    void loadGoogleNonce();

    return () => {
      active = false;
    };
  }, []);

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse.credential || !googleNonceToken) {
      setError("Google signup could not be initialized. Please refresh and try again.");
      return;
    }

    try {
      setError("");
      setGoogleLoading(true);

      const data = await loginWithGoogle(
        credentialResponse.credential,
        googleNonceToken,
      );

      await authLogin({
        access: data.access,
        refresh: data.refresh,
      });

      const nextNonce = await getGoogleAuthNonce();
      setGoogleNonce(nextNonce.nonce);
      setGoogleNonceToken(nextNonce.nonce_token);

      router.refresh();
      router.replace("/");
    } catch (err) {
      setError(err.message || "Google signup failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/signup/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          password2: formData.confirmPassword,
          phone: formData.phone, // 🔥 REQUIRED
          first_name: formData.name.split(" ")[0] || "",
          last_name: formData.name.split(" ").slice(1).join(" ") || "",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Handle field-specific errors
        const errors = Object.entries(errorData)
          .map(([field, messages]) => `${field}: ${messages.join(", ")}`)
          .join("\\n");
        throw new Error(errors);
      }

      const data = await response.json();

      // Show success message
      alert(data.message);

      // Redirect to login
      router.push("/login");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#e8f3f1] via-white to-[#f6efe2] px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-5xl backdrop-blur-xl bg-white/70 border border-white/40
                 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)]
                 overflow-hidden grid grid-cols-1 md:grid-cols-2"
      >
        {/* LEFT PANEL — SIGNUP FORM */}
        <div className="p-8 md:p-10 flex flex-col justify-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-5">
            Create Account
          </h1>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Name */}
            <div className="relative">
              <User
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Full Name"
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-full
                         focus:outline-none focus:border-gray-900 transition"
                required
              />
            </div>

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
                placeholder="Email Address"
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-full
                         focus:outline-none focus:border-gray-900 transition"
                required
              />
            </div>

            {/* Phone */}
            <div className="relative">
              <Phone
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="Phone Number"
                className="w-full pl-12 pr-4 py-2.5 border border-gray-200 rounded-full
                          focus:outline-none focus:border-gray-900 transition"
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
                placeholder="Password"
                className="w-full pl-12 pr-12 py-3 border border-gray-200 rounded-full
                         focus:outline-none focus:border-gray-900 transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Confirm Password */}
            <div className="relative">
              <Lock
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
                placeholder="Confirm Password"
                className="w-full pl-12 pr-12 py-3 border border-gray-200 rounded-full
                         focus:outline-none focus:border-gray-900 transition"
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

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-600 text-sm"
              >
                {error}
              </motion.div>
            )}

            {/* Terms */}
            <div className="flex items-start gap-2 text-sm text-gray-600 px-2 py-2">
              <input type="checkbox" required className="mt-1" />
              <span>
                I agree to the{" "}
                <Link
                  href="/terms"
                  className="font-semibold text-gray-900 hover:underline"
                >
                  Terms
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className="font-semibold text-gray-900 hover:underline"
                >
                  Privacy Policy
                </Link>
              </span>
            </div>

            {/* Create Button */}
            <button
              type="submit"
              disabled={loading}
              className="
                w-full
                bg-[#2f5d56] hover:bg-[#244944]
                text-white font-semibold
                py-3 rounded-full
                transition
                disabled:opacity-80 disabled:cursor-not-allowed
                flex items-center justify-center gap-2
              "
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}
              {loading ? "Creating Account..." : "Create Account"}
            </button>

            {/* Google */}
            <div className="flex justify-center">
              {googleNonce && googleNonceToken ? (
                <GoogleLogin
                  nonce={googleNonce}
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError("Google signup failed")}
                  text="continue_with"
                  shape="pill"
                  theme="outline"
                  width="320"
                />
              ) : (
                <button
                  type="button"
                  disabled
                  className="
                    w-full
                    border border-gray-300
                    py-3
                    rounded-full
                    text-gray-500
                    bg-gray-50
                    cursor-not-allowed
                  "
                >
                  {googleLoading ? "Loading Google sign-up..." : "Google signup unavailable"}
                </button>
              )}
            </div>
          </form>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
            <Shield size={14} className="text-[#2f5d56]" />
            <span>Your information is securely encrypted</span>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="hidden md:flex relative items-center justify-center p-10 overflow-hidden">
          {/* Animated Gradient Background */}
          <div
            className="absolute inset-0 
             bg-[length:200%_200%]
             bg-gradient-to-br 
             from-[#2f5d56] 
             via-[#3c7a70] 
             to-[#1f3f3b] 
             animate-gradient-slow"
          />

          {/* Optional Soft Image Texture (same as login) */}
          <div
            className="absolute inset-0 bg-cover bg-center opacity-80 blur-lg scale-110"
            style={{ backgroundImage: "url('/signup.jpg')" }}
          />

          {/* Soft Overlay for Depth */}
          <div className="absolute inset-0 bg-black/10" />

          {/* Content */}
          <div className="relative text-white text-center max-w-xs flex flex-col items-center">
            <h2 className="text-3xl font-bold mb-4">Welcome Back!</h2>

            <p className="text-sm opacity-90 mb-6">
              Already have an account? Sign in to continue shopping.
            </p>

            <Link
              href="/login"
              className="inline-block border border-white px-6 py-2 rounded-full hover:bg-white hover:text-[#2f5d56] transition"
            >
              Sign In
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
      <p className="absolute bottom-4 text-xs text-gray-400">
        © {new Date().getFullYear()} Decor Tales. All rights reserved.
      </p>
    </div>
  );
}
