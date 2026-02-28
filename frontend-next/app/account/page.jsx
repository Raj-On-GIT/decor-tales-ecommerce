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
            <div className="w-28 h-28 rounded-full overflow-hidden bg-gray-200">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : null}
            </div>

            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (!file) return;
                setAvatarFile(file);
                setAvatarPreview(URL.createObjectURL(file));
              }}
            />
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