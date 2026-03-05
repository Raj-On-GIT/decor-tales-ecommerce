"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowLeft, Shield } from "lucide-react";
import { useAuth } from "@/context/AuthContext"; // ← IMPORT useAuth
import { getCart, addToCart as addToCartAPI } from "@/lib/api";
import { useStore } from "@/context/StoreContext";
import { useGoogleLogin } from "@react-oauth/google";

export default function LoginPage() {
  const { replaceCart } = useStore();
  const router = useRouter();
  const { login } = useAuth(); // ← GET login function from context

  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const googleLogin = useGoogleLogin({
  flow: "implicit",

  onSuccess: async (tokenResponse) => {

    const res = await fetch("http://127.0.0.1:8000/api/auth/google/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_token: tokenResponse.access_token,
      }),
    });

    const data = await res.json();

    login({ access: data.access, refresh: data.refresh });

    router.refresh();
    router.replace("/");
  },

  onError: () => setError("Google login failed"),
});
  

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Step 1: Call login API
      const response = await fetch("http://127.0.0.1:8000/api/auth/login/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: formData.email,
          password: formData.password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.non_field_errors?.[0] || "Login failed. Please try again.",
        );
      }

      // Step 2: Get tokens from response
      const data = await response.json();
      // data = { access: "...", refresh: "...", user: {...} }

      // ──────────────────────────────────────────────────────────────────
      // Step 3: Store tokens and update auth state
      // ──────────────────────────────────────────────────────────────────

      // After login success:
      login({ access: data.access, refresh: data.refresh });

      // ─────────────────────────────────────────────
      // STEP 3A: Capture guest cart BEFORE overwrite
      // ─────────────────────────────────────────────
      let guestCart = [];

      if (typeof window !== "undefined") {
        const storedCart = localStorage.getItem("cart");
        guestCart = storedCart ? JSON.parse(storedCart) : [];
      }

      // ─────────────────────────────────────────────
      // STEP 3B: Replay guest cart into backend
      // ─────────────────────────────────────────────
      if (guestCart.length > 0) {
        for (const item of guestCart) {
          try {
            await addToCartAPI(
              item.product_id || item.id,
              item.qty || 1,
              item.variant?.id || null,
            );
          } catch (err) {
            console.error("Merge item failed:", err.message);
          }
        }

        // ✅ CLEAR guest cart AFTER replay finishes
        if (typeof window !== "undefined") {
          localStorage.removeItem("cart");
        }
      }

      // STEP 3C: Fetch final merged server cart
      try {
        const serverCart = await getCart();
        replaceCart(serverCart.items);
      } catch (err) {
        console.error("Failed to sync merged cart:", err);
      }

      router.refresh();
      router.replace("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Rest of your component stays the same
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#e8f3f1] via-white to-[#f6efe2] px-10">
      {/* Decorative Blurred Background Shapes */}
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
        rounded-3xl
        shadow-[0_20px_60px_rgba(0,0,0,0.15)]
        overflow-hidden
        grid grid-cols-1 md:grid-cols-2
      "
      >
        {/* LEFT PANEL — LOGIN FORM */}
        <div className="p-10 md:p-14 flex flex-col justify-center">
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
                placeholder="Email Address"
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-full
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

            {/* Forgot password */}
            <div className="text-left px-2">
              <Link
                href="/forgot-password"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Forgot password?
              </Link>
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

            {/* Login Button */}
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
              {loading ? "Logging In..." : "Sign In"}
            </button>

            
            {/* Hidden Google Button */}
<button
  type="button"
  onClick={() => googleLogin()}
  className="
    w-full
    border border-gray-200
    text-gray-800 font-medium
    py-3 rounded-full
    flex items-center justify-center gap-3
    hover:bg-gray-50 transition
  "
>
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>

  Continue with Google
</button>
          </form>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
            <Shield size={14} className="text-gray-400" />
            <span>Your information is securely encrypted</span>
          </div>
        </div>

        {/* RIGHT PANEL — DECORATIVE SIDE */}
        <div className="hidden md:flex relative items-center justify-center p-12 overflow-hidden">
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

          {/* Blurred Image Layer */}
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20 blur-xl scale-110"
            style={{ backgroundImage: "url('/login-bg.jpg')" }}
          />

          {/* Dark Overlay */}
          <div className="absolute inset-0 bg-black/10" />

          {/* Content */}
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
      <p className="absolute bottom-4 text-xs text-gray-400">
        © {new Date().getFullYear()} Decor Tales. All rights reserved.
      </p>
    </div>
  );
}
