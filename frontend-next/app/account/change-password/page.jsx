"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { logout } = useAuth();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const accessToken = localStorage.getItem("access_token");

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
      const res = await fetch(
        "http://127.0.0.1:8000/api/accounts/change-password/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            old_password: oldPassword,
            new_password: newPassword,
          }),
        }
      );

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
        logout();          // clears tokens + resets state
        router.push("/login");
      }, 1500);

      setOldPassword("");
      setNewPassword("");
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 border rounded">
      <h2 className="text-xl font-semibold mb-4">Change Password</h2>

      {message && <p className="text-green-600 mb-3">{message}</p>}
      {error && <p className="text-red-600 mb-3">{error}</p>}

      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="Old password"
          className="w-full p-2 border mb-3"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="New password"
          className="w-full p-2 border mb-4"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
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
          {loading ? "Updating..." : "Change Password"}
        </button>
      </form>
    </div>
  );
}