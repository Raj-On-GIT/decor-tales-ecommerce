"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { getProfile, updateProfile } from "@/lib/api";
import { useGlobalToast } from "@/context/ToastContext";

export default function AccountPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const { success, error } = useGlobalToast();

  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
  });
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [saving, setSaving] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Load profile
  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await getProfile();
        setProfile(data);
        setForm({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          phone: data.profile?.phone || "",
        });
        setAvatarPreview(data.profile?.avatar || null);
      } catch (err) {
        error("Failed to load profile");
      }
    }

    if (isAuthenticated) {
      loadProfile();
    }
  }, [isAuthenticated]);

  if (!profile) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const formData = new FormData();

      formData.append("first_name", form.first_name);
      formData.append("last_name", form.last_name);
      formData.append("profile.phone", form.phone);

      if (avatarFile) {
        formData.append("profile.avatar", avatarFile);
      }

      const updated = await updateProfile(formData);
      setProfile(updated);
      success("Profile updated successfully");
    } catch (err) {
      error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-8"
      >
        <h1 className="text-2xl font-bold mb-6">My Account</h1>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Avatar */}
<div className="flex flex-col items-center gap-4">

  {/* Avatar Circle */}
  <div className="w-28 h-28 rounded-full overflow-hidden bg-gray-200 border border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.06)] relative">
    <img
      src={avatarPreview || "/avatar-placeholder.png"}
      alt="Avatar"
      className="w-full h-full object-cover"
    />
  </div>

  {/* Hidden Native Input */}
  <input
    id="avatarUpload"
    type="file"
    accept="image/*"
    className="hidden"
    onChange={(e) => {
      const file = e.target.files[0];
      if (!file) return;
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }}
  />

  {/* Buttons Row */}
  <div className="flex items-center gap-3">

    {/* Upload Button */}
    <label
      htmlFor="avatarUpload"
      className="group cursor-pointer px-5 py-2.5 bg-[#F0FFDF] border border-gray-200 rounded-full text-sm font-medium text-gray-800 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] transition-all duration-500 ease-out hover:-translate-y-0.5 hover:border-gray-300"
    >
      Upload
    </label>

    {/* Delete Button */}
    {avatarPreview && (
      <button
  type="button"
  onClick={async () => {
    try {
      setSaving(true);

      const formData = new FormData();
      formData.append("first_name", form.first_name);
      formData.append("last_name", form.last_name);
      formData.append("profile.phone", form.phone);

      // 🔥 THIS IS IMPORTANT
      formData.append("profile.avatar", "");

      const updated = await updateProfile(formData);

      setProfile(updated);
      setAvatarFile(null);
      setAvatarPreview(null);

      success("Profile photo removed");
    } catch (err) {
      error("Failed to remove photo");
    } finally {
      setSaving(false);
    }
  }}
  className="p-2 rounded-full bg-red-50 border border-red-200 text-red-600 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:bg-red-100 hover:shadow-[0_10px_30px_rgba(0,0,0,0.12)] transition-all duration-500 ease-out hover:-translate-y-0.5"
>
        {/* Bin SVG */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7v10m6-10v10M10 4h4m-9 3h14l-1 13a2 2 0 01-2 2H8a2 2 0 01-2-2L5 7z" />
        </svg>
      </button>
    )}

  </div>

</div>
          {/* First Name */}
          <div>
            <label className="block text-sm font-semibold mb-1">
              First Name
            </label>
            <input
              type="text"
              value={form.first_name}
              onChange={(e) =>
                setForm({ ...form, first_name: e.target.value })
              }
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:border-gray-900"
            />
          </div>

          {/* Last Name */}
          <div>
            <label className="block text-sm font-semibold mb-1">
              Last Name
            </label>
            <input
              type="text"
              value={form.last_name}
              onChange={(e) =>
                setForm({ ...form, last_name: e.target.value })
              }
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:border-gray-900"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-semibold mb-1">
              Phone Number
            </label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) =>
                setForm({ ...form, phone: e.target.value })
              }
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:border-gray-900"
            />
          </div>

          {/* Email (Read Only) */}
          <div>
            <label className="block text-sm font-semibold mb-1">
              Email
            </label>
            <input
              type="email"
              value={profile.email}
              disabled
              className="w-full bg-gray-100 border-2 border-gray-200 rounded-lg px-4 py-3"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>

        </form>
      </motion.div>
  );
}