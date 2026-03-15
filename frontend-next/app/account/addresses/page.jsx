"use client";

import { useEffect, useState } from "react";
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

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    state: "",
    postal_code: "",
    is_default: false,
  });

  useEffect(() => {
    loadAddresses();
  }, []);

  async function loadAddresses() {
    try {
      const data = await getAddresses();
      setAddresses(data);
    } catch {
      error("Failed to load addresses");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({
      full_name: "",
      phone: "",
      address_line_1: "",
      address_line_2: "",
      city: "",
      state: "",
      postal_code: "",
      is_default: false,
    });
    setFormOpen(true);
  }

  function openEdit(address) {
    setEditing(address);
    setForm(address);
    setFormOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);

    try {
      if (editing) {
        await updateAddress(editing.id, form);
        success("Address updated");
      } else {
        await createAddress(form);
        success("Address added");
      }

      setFormOpen(false);
      await loadAddresses();
    } catch {
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

  if (loading) return null;

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

      {addresses.length === 0 && (
        <p className="text-gray-500">No saved addresses yet.</p>
      )}

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

      {formOpen && (
        <div className="mt-8 border-t pt-6">
          <h2 className="mb-4 text-lg font-semibold">
            {editing ? "Edit Address" : "Add Address"}
          </h2>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input
              placeholder="Full Name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
              className="rounded-lg border px-3 py-3 sm:col-span-2"
            />

            <input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
              className="rounded-lg border px-3 py-3"
            />

            <input
              placeholder="Postal Code"
              value={form.postal_code}
              onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
              required
              className="rounded-lg border px-3 py-3"
            />

            <input
              placeholder="Address Line 1"
              value={form.address_line_1}
              onChange={(e) => setForm({ ...form, address_line_1: e.target.value })}
              required
              className="rounded-lg border px-3 py-3 sm:col-span-2"
            />

            <input
              placeholder="Address Line 2"
              value={form.address_line_2}
              onChange={(e) => setForm({ ...form, address_line_2: e.target.value })}
              className="rounded-lg border px-3 py-3 sm:col-span-2"
            />

            <input
              placeholder="City"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              required
              className="rounded-lg border px-3 py-3"
            />

            <input
              placeholder="State"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              required
              className="rounded-lg border px-3 py-3"
            />

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
                onClick={() => setFormOpen(false)}
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
