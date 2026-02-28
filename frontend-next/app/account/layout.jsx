"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AccountLayout({ children }) {
  const pathname = usePathname();

  const linkClass = (path) =>
    `block px-4 py-2 rounded-lg ${
      pathname === path
        ? "bg-gray-900 text-white"
        : "text-gray-700 hover:bg-gray-100"
    }`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FFDF] via-white to-[#FFECC0] px-4 py-12">
      <div className="max-w-6xl mx-auto flex gap-8">

        {/* Sidebar */}
        <div className="w-60 bg-white rounded-2xl shadow-lg p-6 space-y-3 h-fit">
          <h2 className="font-bold text-lg mb-4">My Account</h2>

          <Link href="/account" className={linkClass("/account")}>
            Profile
          </Link>

          <Link href="/account/addresses" className={linkClass("/account/addresses")}>
            Addresses
          </Link>
        </div>

        {/* Content */}
        <div className="flex-1">
          {children}
        </div>

      </div>
    </div>
  );
}