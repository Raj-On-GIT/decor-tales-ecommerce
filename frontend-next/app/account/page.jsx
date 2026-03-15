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
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    async function loadProfile() {
      try {
        setProfileLoading(true);
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
      } finally {
        setProfileLoading(false);
      }
    }

    if (isAuthenticated) {
      loadProfile();
    }
  }, [isAuthenticated]);

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
      setAvatarPreview(updated.profile?.avatar || avatarPreview);
      success("Profile updated successfully");
    } catch (err) {
      error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setSaving(true);
      const formData = new FormData();
      formData.append("first_name", form.first_name);
      formData.append("last_name", form.last_name);
      formData.append("profile.phone", form.phone);
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
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full rounded-2xl bg-white p-5 shadow-xl sm:p-6 lg:max-w-2xl lg:p-8"
    >
      <h1 className="mb-6 text-2xl font-bold">My Account</h1>

      {profileLoading ? (
        <div className="space-y-4">
          <div className="mx-auto h-24 w-24 animate-pulse rounded-full bg-gray-200 sm:h-28 sm:w-28" />
          <div className="h-12 animate-pulse rounded-lg bg-gray-100" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="h-12 animate-pulse rounded-lg bg-gray-100" />
            <div className="h-12 animate-pulse rounded-lg bg-gray-100" />
          </div>
          <div className="h-12 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-12 animate-pulse rounded-lg bg-gray-100" />
        </div>
      ) : !profile ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
          Unable to load your profile right now.
        </div>
      ) : (

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-24 w-24 overflow-hidden rounded-full border border-gray-200 bg-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.06)] sm:h-28 sm:w-28">
            <img
              src={avatarPreview || "/avatar-placeholder.png"}
              alt="Avatar"
              className="h-full w-full object-cover"
            />
          </div>

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

          <div className="flex flex-wrap items-center justify-center gap-3">
            <label
              htmlFor="avatarUpload"
              className="cursor-pointer rounded-full border border-gray-200 bg-[#F0FFDF] px-5 py-2.5 text-sm font-medium text-gray-800 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-500 ease-out hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
            >
              Upload
            </label>

            {avatarPreview && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="rounded-full border border-red-200 bg-red-50 p-2 text-red-600 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-500 ease-out hover:-translate-y-0.5 hover:bg-red-100 hover:shadow-[0_10px_30px_rgba(0,0,0,0.12)]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 7h12M9 7v10m6-10v10M10 4h4m-9 3h14l-1 13a2 2 0 01-2 2H8a2 2 0 01-2-2L5 7z"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold">First Name</label>
            <input
              type="text"
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              className="w-full rounded-lg border-2 border-gray-200 px-4 py-3 focus:border-gray-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">Last Name</label>
            <input
              type="text"
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              className="w-full rounded-lg border-2 border-gray-200 px-4 py-3 focus:border-gray-900 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold">Phone Number</label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full rounded-lg border-2 border-gray-200 px-4 py-3 focus:border-gray-900 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold">Email</label>
          <input
            type="email"
            value={profile.email}
            disabled
            className="w-full rounded-lg border-2 border-gray-200 bg-gray-100 px-4 py-3"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-gray-900 py-3 font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
      )}
    </motion.div>
  );
}
