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

    try {
      if (editing) {
        await updateAddress(editing.id, form);
        success("Address updated");
      } else {
        await createAddress(form);
        success("Address added");
      }

      setFormOpen(false);
      loadAddresses();
    } catch {
      error("Failed to save address");
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this address?")) return;

    try {
      await deleteAddress(id);
      success("Address deleted");
      loadAddresses();
    } catch {
      error("Delete failed");
    }
  }

  if (loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-xl p-8"
    >
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Addresses</h1>
        <button
          onClick={openCreate}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800"
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
            className="border rounded-xl p-4 flex justify-between items-start"
          >
            <div>
              <div className="font-semibold">
                {addr.full_name}
                {addr.is_default && (
                  <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                    Default
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-600">
                {addr.address_line_1}, {addr.address_line_2}
              </div>
              <div className="text-sm text-gray-600">
                {addr.city}, {addr.state} - {addr.postal_code}
              </div>
              <div className="text-sm text-gray-600">
                Phone: {addr.phone}
              </div>
            </div>

            <div className="flex gap-3 text-sm">
              <button
                onClick={() => openEdit(addr)}
                className="text-blue-600 hover:underline"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(addr.id)}
                className="text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {formOpen && (
        <div className="mt-8 border-t pt-6">
          <h2 className="text-lg font-semibold mb-4">
            {editing ? "Edit Address" : "Add Address"}
          </h2>

          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <input
              placeholder="Full Name"
              value={form.full_name}
              onChange={(e) =>
                setForm({ ...form, full_name: e.target.value })
              }
              required
              className="border rounded-lg px-3 py-2 col-span-2"
            />

            <input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) =>
                setForm({ ...form, phone: e.target.value })
              }
              required
              className="border rounded-lg px-3 py-2"
            />

            <input
              placeholder="Postal Code"
              value={form.postal_code}
              onChange={(e) =>
                setForm({ ...form, postal_code: e.target.value })
              }
              required
              className="border rounded-lg px-3 py-2"
            />

            <input
              placeholder="Address Line 1"
              value={form.address_line_1}
              onChange={(e) =>
                setForm({ ...form, address_line_1: e.target.value })
              }
              required
              className="border rounded-lg px-3 py-2 col-span-2"
            />

            <input
              placeholder="Address Line 2"
              value={form.address_line_2}
              onChange={(e) =>
                setForm({ ...form, address_line_2: e.target.value })
              }
              className="border rounded-lg px-3 py-2 col-span-2"
            />

            <input
              placeholder="City"
              value={form.city}
              onChange={(e) =>
                setForm({ ...form, city: e.target.value })
              }
              required
              className="border rounded-lg px-3 py-2"
            />

            <input
              placeholder="State"
              value={form.state}
              onChange={(e) =>
                setForm({ ...form, state: e.target.value })
              }
              required
              className="border rounded-lg px-3 py-2"
            />

            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) =>
                  setForm({ ...form, is_default: e.target.checked })
                }
              />
              Set as default address
            </label>

            <button
              type="submit"
              className="col-span-2 bg-gray-900 text-white py-2 rounded-lg hover:bg-gray-800"
            >
              Save Address
            </button>
          </form>
        </div>
      )}
    </motion.div>
  );
}