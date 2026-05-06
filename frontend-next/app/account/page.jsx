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
  const [saving, setSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState({});

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
      } catch {
        error("Failed to load profile");
      } finally {
        setProfileLoading(false);
      }
    }

    if (isAuthenticated) {
      loadProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  function validateForm(values) {
    const errors = {};
    const firstName = values.first_name.trim();
    const lastName = values.last_name.trim();
    const phone = values.phone.replace(/\D/g, "");
    const namePattern = /^[A-Za-z .'-]+$/;

    if (firstName && !namePattern.test(firstName)) {
      errors.first_name =
        "First name can only contain letters, spaces, apostrophes, periods, and hyphens.";
    }

    if (lastName && !namePattern.test(lastName)) {
      errors.last_name =
        "Last name can only contain letters, spaces, apostrophes, periods, and hyphens.";
    }

    if (phone && phone.length !== 10) {
      errors.phone = "Phone number must be exactly 10 digits.";
    }

    return errors;
  }

  function buildPayload(values) {
    return {
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      phone: values.phone.replace(/\D/g, ""),
    };
  }

  function handleFieldChange(name, value) {
    const normalizedValue = name === "phone" ? value.replace(/\D/g, "") : value;
    const nextForm = { ...form, [name]: normalizedValue };
    setForm(nextForm);

    if (fieldErrors[name]) {
      const nextErrors = validateForm(nextForm);
      setFieldErrors((current) => ({ ...current, [name]: nextErrors[name] }));
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = buildPayload(form);
    const validationErrors = validateForm(payload);

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      error("Please correct the highlighted profile fields");
      return;
    }

    setSaving(true);
    setFieldErrors({});

    try {
      const formData = new FormData();

      formData.append("first_name", payload.first_name);
      formData.append("last_name", payload.last_name);
      formData.append("profile.phone", payload.phone);

      const updated = await updateProfile(formData);
      setProfile(updated);
      setForm({
        first_name: updated.first_name || "",
        last_name: updated.last_name || "",
        phone: updated.profile?.phone || "",
      });
      success("Profile updated successfully");
    } catch (err) {
      if (err && typeof err === "object" && !Array.isArray(err)) {
        const apiFieldErrors = {
          first_name: Array.isArray(err.first_name) ? err.first_name[0] : undefined,
          last_name: Array.isArray(err.last_name) ? err.last_name[0] : undefined,
          phone: Array.isArray(err?.profile?.phone) ? err.profile.phone[0] : undefined,
        };

        if (Object.values(apiFieldErrors).some(Boolean)) {
          setFieldErrors((current) => ({ ...current, ...apiFieldErrors }));
        }
      }

      const message =
        err?.profile?.phone?.[0] ||
        err?.first_name?.[0] ||
        err?.last_name?.[0] ||
        err?.detail ||
        "Failed to update profile";
      error(message);
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold">First Name</label>
            <input
              type="text"
              value={form.first_name}
              onChange={(e) => handleFieldChange("first_name", e.target.value)}
              className={`w-full rounded-lg border-2 px-4 py-3 focus:border-gray-900 focus:outline-none ${fieldErrors.first_name ? "border-red-500" : "border-gray-200"}`}
            />
            {fieldErrors.first_name && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.first_name}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">Last Name</label>
            <input
              type="text"
              value={form.last_name}
              onChange={(e) => handleFieldChange("last_name", e.target.value)}
              className={`w-full rounded-lg border-2 px-4 py-3 focus:border-gray-900 focus:outline-none ${fieldErrors.last_name ? "border-red-500" : "border-gray-200"}`}
            />
            {fieldErrors.last_name && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.last_name}</p>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold">Phone Number</label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => handleFieldChange("phone", e.target.value)}
            inputMode="numeric"
            maxLength={10}
            className={`w-full rounded-lg border-2 px-4 py-3 focus:border-gray-900 focus:outline-none ${fieldErrors.phone ? "border-red-500" : "border-gray-200"}`}
          />
          {fieldErrors.phone && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.phone}</p>
          )}
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
