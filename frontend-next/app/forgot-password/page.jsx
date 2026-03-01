"use client";

import { useState } from "react";

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
      const res = await fetch("http://127.0.0.1:8000/api/auth/forgot-password/", {
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
    }

    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 border rounded">
      <h2 className="text-xl font-semibold mb-4">Forgot Password</h2>

      {message && <p className="text-green-600 mb-3">{message}</p>}
      {error && <p className="text-red-600 mb-3">{error}</p>}

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Enter your email"
          className="w-full p-2 border mb-4"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white py-2"
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </button>
      </form>
    </div>
  );
}