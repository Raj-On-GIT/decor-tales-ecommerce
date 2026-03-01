"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function ResetPasswordPage() {
  const { uid, token } = useParams();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { logout } = useAuth();
  
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
      const res = await fetch("http://127.0.0.1:8000/api/auth/reset-password/", {
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
    }

    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 border rounded">
      <h2 className="text-xl font-semibold mb-4">Reset Password</h2>

      {message && <p className="text-green-600 mb-3">{message}</p>}
      {error && <p className="text-red-600 mb-3">{error}</p>}

      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="Enter new password"
          className="w-full p-2 border mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
            type="password"
            placeholder="Confirm new password"
            className="w-full p-2 border mb-4"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white py-2"
        >
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </div>
  );
}