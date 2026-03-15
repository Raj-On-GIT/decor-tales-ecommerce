"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AccountLayout({ children }) {
  const pathname = usePathname();

  const mobileLinkClass = (path) =>
    `shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
      pathname === path
        ? "bg-gray-900 text-white"
        : "bg-white text-gray-700 hover:bg-gray-100"
    }`;

  const desktopLinkClass = (path) =>
    `block w-full rounded-lg px-4 py-2 text-sm font-medium transition ${
      pathname === path
        ? "bg-gray-900 text-white"
        : "text-gray-700 hover:bg-gray-100"
    }`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FFDF] via-white to-[#FFECC0] px-4 py-6 sm:px-6 sm:py-8 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-3 lg:hidden">
            <Link href="/account" className={linkClass("/account")}>
            <Link href="/account" className={mobileLinkClass("/account")}>
              Profile
            </Link>
            <Link
              href="/account/addresses"
              className={mobileLinkClass("/account/addresses")}
            >
              Addresses
            </Link>
            <Link
              href="/account/change-password"
              className={mobileLinkClass("/account/change-password")}
            >
              Change Password
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:gap-8">
          <div className="hidden h-fit w-60 rounded-2xl bg-white p-6 shadow-lg lg:block">
            <h2 className="mb-4 text-lg font-bold">My Account</h2>

            <div className="space-y-3">
              <Link href="/account" className={desktopLinkClass("/account")}>
                Profile
              </Link>
              <Link
                href="/account/addresses"
                className={desktopLinkClass("/account/addresses")}
              >
                Addresses
              </Link>
              <Link
                href="/account/change-password"
                className={desktopLinkClass("/account/change-password")}
              >
                Change Password
              </Link>
            </div>
          </div>

          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
