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
import GoogleAuthButton from "@/components/GoogleAuthButton";
import { useAuth } from "@/context/AuthContext";
import {
  getGoogleAuthNonce,
  loginWithGoogle,
  startSignupVerification,
  verifySignupOtp,
} from "@/lib/auth";

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
  const [otp, setOtp] = useState("");
  const [signupToken, setSignupToken] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
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

  useEffect(() => {
    if (resendCooldown <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setResendCooldown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse.credential || !googleNonceToken) {
      setError(
        "Google signup could not be initialized. Please refresh and try again.",
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

      await authLogin({ user: data.user });

      router.refresh();
      router.replace("/");
    } catch (err) {
      setIsGoogleRedirecting(false);
      setError(err.message || "Google signup failed");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const data = await startSignupVerification({
        email: formData.email,
        password: formData.password,
        password2: formData.confirmPassword,
        phone: formData.phone,
        first_name: formData.name.split(" ")[0] || "",
        last_name: formData.name.split(" ").slice(1).join(" ") || "",
      });

      setSignupToken(data.signup_token);
      setSignupEmail(data.email);
      setResendCooldown(data.resend_cooldown || 0);
      setOtpStep(true);
    } catch (err) {
      if (err && typeof err === "object" && !Array.isArray(err)) {
        const errors = Object.entries(err)
          .map(
            ([field, messages]) =>
              `${field}: ${Array.isArray(messages) ? messages.join(", ") : messages}`,
          )
          .join("\n");
        setError(errors || "Signup failed");
      } else {
        setError(err.message || "Signup failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setOtpLoading(true);

    try {
      const data = await verifySignupOtp({
        signup_token: signupToken,
        otp,
      });

      alert(data.message);
      router.push("/login");
    } catch (err) {
      if (err && typeof err === "object" && !Array.isArray(err)) {
        const errors = Object.entries(err)
          .map(
            ([field, messages]) =>
              `${field}: ${Array.isArray(messages) ? messages.join(", ") : messages}`,
          )
          .join("\n");
        setError(errors || "Verification failed");
      } else {
        setError(err.message || "Verification failed");
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    setLoading(true);

    try {
      const data = await startSignupVerification({
        email: formData.email,
        password: formData.password,
        password2: formData.confirmPassword,
        phone: formData.phone,
        first_name: formData.name.split(" ")[0] || "",
        last_name: formData.name.split(" ").slice(1).join(" ") || "",
      });

      setSignupToken(data.signup_token);
      setSignupEmail(data.email);
      setResendCooldown(data.resend_cooldown || 0);
      setOtp("");
    } catch (err) {
      if (err && typeof err === "object" && !Array.isArray(err)) {
        const errors = Object.entries(err)
          .map(
            ([field, messages]) =>
              `${field}: ${Array.isArray(messages) ? messages.join(", ") : messages}`,
          )
          .join("\n");
        setError(errors || "Could not resend code");
      } else {
        setError(err.message || "Could not resend code");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#fff8ef] via-white to-[#fff3df] px-5 sm:px-10">
      <div className="absolute -top-24 -left-24 h-[320px] w-[320px] rounded-full bg-[#FDC3A1]/24 blur-[72px]" />
      <div className="absolute -bottom-24 -right-24 h-[320px] w-[320px] rounded-full bg-[#FDC3A1]/20 blur-[72px]" />

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.995 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-5xl border border-[#F0D1C2]/70 bg-white/92 md:bg-white/84 md:backdrop-blur-sm
                 rounded-xl shadow-[0_24px_70px_rgba(199,141,101,0.14)]
                 overflow-hidden grid grid-cols-1 md:grid-cols-2 will-change-transform"
      >
        <div className="p-5 md:p-12 flex flex-col justify-center">
          <h1 className="mb-5 text-3xl font-bold text-[#1C1917]">
            {otpStep ? "Verify Your Email" : "Create Account"}
          </h1>

          <form
            onSubmit={otpStep ? handleVerifyOtp : handleSubmit}
            className="space-y-3"
          >
            {otpStep ? (
              <>
                <p className="text-sm text-[#78716C]">
                  Enter the 6-digit code sent to{" "}
                  <span className="font-semibold text-[#1C1917]">
                    {signupEmail}
                  </span>
                  .
                </p>

                <div className="relative">
                  <Shield
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B89B88]"
                    size={18}
                  />
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    disabled={otpLoading}
                    placeholder="6-digit verification code"
                    className="w-full rounded-lg border border-[#E8D7CB] bg-white px-4 py-3 pl-12 pr-4
                         text-[#1C1917] placeholder:text-[#78716C]
                         focus:border-[#D89A6B] focus:outline-none focus:ring-2 focus:ring-[#D89A6B]/15 transition
                         disabled:bg-[#fffaf7] disabled:text-gray-400 disabled:cursor-not-allowed"
                    required
                  />
                </div>
              </>
            ) : (
              <>
            <div className="relative">
              <User
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B89B88]"
                size={18}
              />
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                disabled={isFormLocked}
                placeholder="Full Name"
                className="w-full rounded-lg border border-[#E8D7CB] bg-white px-4 py-3 pl-12 pr-4
                         text-[#1C1917] placeholder:text-[#78716C]
                         focus:border-[#D89A6B] focus:outline-none focus:ring-2 focus:ring-[#D89A6B]/15 transition
                         disabled:bg-[#fffaf7] disabled:text-gray-400 disabled:cursor-not-allowed"
                required
              />
            </div>

            <div className="relative">
              <Mail
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B89B88]"
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
                className="w-full rounded-lg border border-[#E8D7CB] bg-white px-4 py-3 pl-12 pr-4
                         text-[#1C1917] placeholder:text-[#78716C]
                         focus:border-[#D89A6B] focus:outline-none focus:ring-2 focus:ring-[#D89A6B]/15 transition
                         disabled:bg-[#fffaf7] disabled:text-gray-400 disabled:cursor-not-allowed"
                required
              />
            </div>

            <div className="relative">
              <Phone
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B89B88]"
                size={18}
              />
              <input
                type="text"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                disabled={isFormLocked}
                placeholder="Phone Number"
                className="w-full rounded-lg border border-[#E8D7CB] bg-white px-4 py-2.5 pl-12 pr-4
                          text-[#1C1917] placeholder:text-[#78716C]
                          focus:border-[#D89A6B] focus:outline-none focus:ring-2 focus:ring-[#D89A6B]/15 transition
                          disabled:bg-[#fffaf7] disabled:text-gray-400 disabled:cursor-not-allowed"
                required
              />
            </div>

            <div className="relative">
              <Lock
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B89B88]"
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
                className="w-full rounded-lg border border-[#E8D7CB] bg-white px-4 py-3 pl-12 pr-12
                         text-[#1C1917] placeholder:text-[#78716C]
                         focus:border-[#D89A6B] focus:outline-none focus:ring-2 focus:ring-[#D89A6B]/15 transition
                         disabled:bg-[#fffaf7] disabled:text-gray-400 disabled:cursor-not-allowed"
                required
              />
              <button
                type="button"
                disabled={isFormLocked}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#B89B88] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="relative">
              <Lock
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B89B88]"
                size={18}
              />
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
                disabled={isFormLocked}
                placeholder="Confirm Password"
                className="w-full rounded-lg border border-[#E8D7CB] bg-white px-4 py-3 pl-12 pr-12
                         text-[#1C1917] placeholder:text-[#78716C]
                         focus:border-[#D89A6B] focus:outline-none focus:ring-2 focus:ring-[#D89A6B]/15 transition
                         disabled:bg-[#fffaf7] disabled:text-gray-400 disabled:cursor-not-allowed"
                required
              />
              <button
                type="button"
                disabled={isFormLocked}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#B89B88] disabled:cursor-not-allowed disabled:opacity-40"
              >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
              </>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-600 text-sm whitespace-pre-line"
              >
                {error}
              </motion.div>
            )}

            {!otpStep && (
            <div className="flex items-start gap-2 px-2 py-2 text-sm text-[#78716C]">
              <input
                type="checkbox"
                required
                disabled={isFormLocked}
                className="mt-1 accent-[#1C1917] disabled:cursor-not-allowed"
              />
              <span>
                I agree to the{" "}
                <Link
                  href="/terms"
                  className={`font-semibold ${
                    isFormLocked
                      ? "pointer-events-none text-gray-400"
                      : "text-[#1C1917] hover:text-black"
                  }`}
                >
                  Terms
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className={`font-semibold ${
                    isFormLocked
                      ? "pointer-events-none text-gray-400"
                      : "text-[#1C1917] hover:text-black"
                  }`}
                >
                  Privacy Policy
                </Link>
              </span>
            </div>
            )}

            <button
              type="submit"
              disabled={otpStep ? otpLoading : isFormLocked}
              className="
                w-full
                bg-[#c87446] hover:bg-[#ab7446]
                text-white font-semibold
                py-3 rounded-lg
                transition
                disabled:opacity-80 disabled:cursor-not-allowed
                flex items-center justify-center gap-2
              "
            >
              {((otpStep && otpLoading) || (loading && !isGoogleRedirecting)) && (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}
              {otpStep
                ? otpLoading
                  ? "Verifying..."
                  : "Verify Email"
                : loading
                  ? "Sending Code..."
                  : "Sign Up"}
            </button>

            {otpStep && (
              <div className="flex items-center justify-between gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setOtpStep(false);
                    setOtp("");
                    setError("");
                  }}
                  className="text-[#78716C] hover:text-black"
                >
                  Edit details
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading || resendCooldown > 0}
                  className="font-semibold text-[#1C1917] disabled:text-gray-400"
                >
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : "Resend code"}
                </button>
              </div>
            )}

            {!otpStep && (
            <div className="flex items-center gap-3 my-3">
              <div className="flex-1 h-px bg-[#EADACF]" />
              <span className="text-[#8E7A80] text-sm">Or</span>
              <div className="flex-1 h-px bg-[#EADACF]" />
            </div>
            )}

            {!otpStep && (
            <div className="w-full mt-3 flex justify-center">
              {isGoogleRedirecting ? (
                <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full rounded-lg border border-[#E8D7CB] bg-[#fffaf7] px-4 py-3"
              >
                  <div className="flex items-center justify-center gap-3 text-sm font-medium text-[#6F4555]">
                    <span className="h-4 w-4 rounded-full border-2 border-[#D89A6B]/20 border-t-[#D89A6B] animate-spin" />
                    Completing Google sign up...
                  </div>
                  <p className="mt-2 text-center text-xs text-gray-500">
                    Redirecting to the homepage
                  </p>
                </motion.div>
              ) : googleNonce && googleNonceToken ? (
                <div className="flex justify-center w-full">
                  <GoogleAuthButton
                    text="Sign up with Google"
                    nonce={googleNonce}
                    onSuccess={handleGoogleSuccess}
                    onError={(msg) => setError(msg || "Google sign-up failed")}
                    disabled={isFormLocked}
                    loading={googleLoading}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  disabled
                  className="
                    w-full
                    border border-[#E8D7CB]
                    py-3
                    rounded-lg
                    text-[#8E7A80]
                    bg-[#fffaf7]
                    cursor-not-allowed
                  "
                >
                  {googleLoading
                    ? "Loading Google sign-up..."
                    : "Google signup unavailable"}
                </button>
              )}
            </div>
            )}
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
            <Shield size={14} className="text-[#1C1917]" />
            <span>Your information is securely encrypted</span>
          </div>
        </div>

        <div className="hidden md:flex relative items-center justify-center p-10 overflow-hidden">
          <div
            className="absolute inset-0 
             bg-gradient-to-br 
             from-[#8B6246]/22 
             via-[#D89A6B]/14 
             to-[#FFF7CD]"
          />

          <div
            className="absolute inset-0 scale-[1.02] bg-cover bg-center opacity-78"
            style={{ backgroundImage: "url('/signup.jpg')" }}
          />

          <div className="absolute inset-0 bg-black/12" />

          <div className="relative text-white text-center max-w-xs flex flex-col items-center">
            <h2 className="text-3xl font-bold mb-4">Welcome Back!</h2>

            <p className="text-sm opacity-90 mb-6">
              Already have an account? Sign in to continue shopping.
            </p>

            <Link
              href="/login"
              className="inline-block rounded-full border border-white px-6 py-2 transition hover:bg-white hover:text-black"
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
             hover:bg-white hover:text-black
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
