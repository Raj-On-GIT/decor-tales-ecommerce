"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from "@/lib/api";
import { useGlobalToast } from "@/context/ToastContext";

export default function AddressesPage() {
  const { success, error } = useGlobalToast();
  const emptyForm = {
    full_name: "",
    phone: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    state: "",
    postal_code: "",
    is_default: false,
  };

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});

  const loadAddresses = useCallback(async () => {
    try {
      const data = await getAddresses();
      setAddresses(Array.isArray(data) ? data : data?.results || []);
    } catch {
      error("Failed to load addresses");
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(address) {
    setEditing(address);
    setForm(address);
    setFieldErrors({});
    setFormOpen(true);
  }

  function normalizeFormValue(name, value) {
    if (name === "phone" || name === "postal_code") {
      return value.replace(/\D/g, "");
    }

    return value;
  }

  function validateForm(values) {
    const errors = {};
    const name = values.full_name.trim();
    const phone = values.phone.replace(/\D/g, "");
    const postalCode = values.postal_code.replace(/\D/g, "");
    const address1 = values.address_line_1.trim();
    const city = values.city.trim();
    const state = values.state.trim();
    const cityStatePattern = /^[A-Za-z.\-\s]+$/;

    if (name.length < 2) {
      errors.full_name = "Full name must be at least 2 characters.";
    }

    if (phone.length !== 10) {
      errors.phone = "Phone number must be exactly 10 digits.";
    }

    if (postalCode.length !== 6) {
      errors.postal_code = "Postal code must be exactly 6 digits.";
    }

    if (address1.length < 5) {
      errors.address_line_1 = "Address line 1 must be at least 5 characters.";
    }

    if (city.length < 2) {
      errors.city = "City must be at least 2 characters.";
    } else if (!cityStatePattern.test(city)) {
      errors.city = "City can only contain letters, spaces, hyphens, and periods.";
    }

    if (state.length < 2) {
      errors.state = "State must be at least 2 characters.";
    } else if (!cityStatePattern.test(state)) {
      errors.state = "State can only contain letters, spaces, hyphens, and periods.";
    }

    return errors;
  }

  function buildPayload(values) {
    return {
      ...values,
      full_name: values.full_name.trim(),
      phone: values.phone.replace(/\D/g, ""),
      address_line_1: values.address_line_1.trim(),
      address_line_2: values.address_line_2.trim(),
      city: values.city.trim(),
      state: values.state.trim(),
      postal_code: values.postal_code.replace(/\D/g, ""),
    };
  }

  function handleFieldChange(name, value) {
    const normalizedValue = normalizeFormValue(name, value);
    const nextForm = { ...form, [name]: normalizedValue };
    setForm(nextForm);

    if (fieldErrors[name]) {
      const nextErrors = validateForm(nextForm);
      setFieldErrors((current) => ({ ...current, [name]: nextErrors[name] }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = buildPayload(form);
    const clientErrors = validateForm(payload);

    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      error("Please correct the highlighted address fields");
      return;
    }

    setSaving(true);
    setFieldErrors({});

    try {
      if (editing) {
        await updateAddress(editing.id, payload);
        success("Address updated");
      } else {
        await createAddress(payload);
        success("Address added");
      }

      setFormOpen(false);
      setEditing(null);
      await loadAddresses();
    } catch (err) {
      if (err && typeof err === "object" && !Array.isArray(err)) {
        const apiFieldErrors = Object.fromEntries(
          Object.entries(err).map(([key, value]) => [
            key,
            Array.isArray(value) ? value[0] : value,
          ]),
        );

        if (Object.keys(apiFieldErrors).length > 0) {
          setFieldErrors(apiFieldErrors);
          error("Please correct the highlighted address fields");
          return;
        }
      }

      error("Failed to save address");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this address?")) return;

    try {
      await deleteAddress(id);
      success("Address deleted");
      await loadAddresses();
    } catch {
      error("Delete failed");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white p-5 shadow-xl sm:p-6 lg:p-8"
    >
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">My Addresses</h1>
        <button
          onClick={openCreate}
          className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-white hover:bg-gray-800 sm:w-auto"
        >
          Add Address
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
        </div>
      ) : addresses.length === 0 ? (
        <p className="text-gray-500">No saved addresses yet.</p>
      ) : (
      <div className="space-y-4">
        {addresses.map((addr) => (
          <div
            key={addr.id}
            className="rounded-xl border p-4"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 font-semibold">
                  <span>{addr.full_name}</span>
                  {addr.is_default && (
                    <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">
                      Default
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm text-gray-600">
                  {addr.address_line_1}
                  {addr.address_line_2 ? `, ${addr.address_line_2}` : ""}
                </div>
                <div className="text-sm text-gray-600">
                  {addr.city}, {addr.state} - {addr.postal_code}
                </div>
                <div className="text-sm text-gray-600">Phone: {addr.phone}</div>
              </div>

              <div className="flex gap-4 text-sm">
                <button
                  onClick={() => openEdit(addr)}
                  className="font-medium text-blue-600 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(addr.id)}
                  className="font-medium text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}

      {formOpen && (
        <div className="mt-8 border-t pt-6">
          <h2 className="mb-4 text-lg font-semibold">
            {editing ? "Edit Address" : "Add Address"}
          </h2>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input
              placeholder="Full Name"
              value={form.full_name}
              onChange={(e) => handleFieldChange("full_name", e.target.value)}
              required
              className={`rounded-lg border px-3 py-3 sm:col-span-2 ${fieldErrors.full_name ? "border-red-500" : ""}`}
            />
            {fieldErrors.full_name && (
              <p className="text-sm text-red-600 sm:col-span-2">{fieldErrors.full_name}</p>
            )}

            <input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => handleFieldChange("phone", e.target.value)}
              inputMode="numeric"
              maxLength={10}
              required
              className={`rounded-lg border px-3 py-3 ${fieldErrors.phone ? "border-red-500" : ""}`}
            />
            {fieldErrors.phone && (
              <p className="text-sm text-red-600">{fieldErrors.phone}</p>
            )}

            <input
              placeholder="Postal Code"
              value={form.postal_code}
              onChange={(e) => handleFieldChange("postal_code", e.target.value)}
              inputMode="numeric"
              maxLength={6}
              required
              className={`rounded-lg border px-3 py-3 ${fieldErrors.postal_code ? "border-red-500" : ""}`}
            />
            {fieldErrors.postal_code && (
              <p className="text-sm text-red-600">{fieldErrors.postal_code}</p>
            )}

            <input
              placeholder="Address Line 1"
              value={form.address_line_1}
              onChange={(e) => handleFieldChange("address_line_1", e.target.value)}
              required
              className={`rounded-lg border px-3 py-3 sm:col-span-2 ${fieldErrors.address_line_1 ? "border-red-500" : ""}`}
            />
            {fieldErrors.address_line_1 && (
              <p className="text-sm text-red-600 sm:col-span-2">{fieldErrors.address_line_1}</p>
            )}

            <input
              placeholder="Address Line 2"
              value={form.address_line_2}
              onChange={(e) => handleFieldChange("address_line_2", e.target.value)}
              className="rounded-lg border px-3 py-3 sm:col-span-2"
            />

            <input
              placeholder="City"
              value={form.city}
              onChange={(e) => handleFieldChange("city", e.target.value)}
              required
              className={`rounded-lg border px-3 py-3 ${fieldErrors.city ? "border-red-500" : ""}`}
            />
            {fieldErrors.city && (
              <p className="text-sm text-red-600">{fieldErrors.city}</p>
            )}

            <input
              placeholder="State"
              value={form.state}
              onChange={(e) => handleFieldChange("state", e.target.value)}
              required
              className={`rounded-lg border px-3 py-3 ${fieldErrors.state ? "border-red-500" : ""}`}
            />
            {fieldErrors.state && (
              <p className="text-sm text-red-600">{fieldErrors.state}</p>
            )}

            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
              />
              Set as default address
            </label>

            <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row">
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-gray-900 py-3 text-white hover:bg-gray-800 sm:flex-1"
              >
                {saving ? "Saving..." : "Save Address"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  setFieldErrors({});
                }}
                className="w-full rounded-lg border py-3 text-gray-700 hover:bg-gray-50 sm:w-auto sm:px-6"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </motion.div>
  );
}
