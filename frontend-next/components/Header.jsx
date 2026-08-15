"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { ShoppingBag, Search, Menu, User, LogOut, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../context/StoreContext";
import { useAuth } from "../context/AuthContext";
import CartDrawer from "./CartDrawer";
import SearchBar from "./SearchBar";
import { useGlobalToast } from "@/context/ToastContext";
import { usePathname } from "next/navigation";

function getProfileName(user) {
  const fullName = [user?.first_name, user?.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  return fullName || user?.email || "Your Account";
}

export default function Header() {
  const { cart } = useStore();
  const { isAuthenticated, logout, loading, user } = useAuth();

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const toast = useGlobalToast();
  const pathname = usePathname();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const isCheckoutPage =
    pathname === "/checkout" || pathname?.startsWith("/checkout/");

  const profileRef = useRef(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setIsProfileOpen(false);
      }
    };
    if (isProfileOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isProfileOpen]);

  const cartCount = mounted ? cart.reduce((acc, item) => acc + item.qty, 0) : 0;
  const visibleProfileName = isAuthenticated ? getProfileName(user) : "";
  const isIdentityLoading = loading;
  const firstName =
    visibleProfileName && visibleProfileName !== "Your Account"
      ? visibleProfileName.trim().split(/\s+/)[0]
      : "";

  useEffect(() => {
    const handleLogin = () => {
      setIsProfileOpen(false);
    };

    window.addEventListener("user-login", handleLogin);

    return () => window.removeEventListener("user-login", handleLogin);
  }, []);

  /**
   * Handle logout
   * Calls logout() from AuthContext which:
   * - Clears tokens from localStorage
   * - Resets auth state
   * - Redirects to homepage
   */
  const handleLogout = () => {
    setIsProfileOpen(false);
    logout();
    toast.info("You’ve been signed out! See you soon 👋", 2500);
  };
  const trackOrderHref = "/track";
// F0FFDF
  return (
    <>
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-[#131b23] bg-[#FAFAF9]/70 backdrop-blur-md">
        <div
          className={`max-w-screen-xl mx-auto 
                        px-4 sm:px-6
                        h-14 md:h-16 
                        flex items-center ${
                          isSearchOpen
                            ? "justify-end md:justify-between"
                            : "justify-between"
                        }`}
        >
          {/* LEFT - Logo & Nav */}
          <div
            className={`items-center space-x-4 md:space-x-8 ${
              isSearchOpen ? "hidden md:flex" : "flex"
            }`}
          >
            <Link
              href="/"
              className="flex items-center gap-2 md:gap-3 text-lg md:text-2xl font-serif font-bold tracking-tight text-gray-900 whitespace-nowrap shrink-0"
            >
              <Image
                src="/DECOR_TALES_cropped.svg"
                alt="Decor Tales Logo"
                width={720}
                height={220}
                className="h-10 w-auto max-w-[146px] object-contain opacity-80 mix-blend-multiply md:h-12 md:max-w-[210px]"

                priority
              />
              Decor Tales
            </Link>

            <nav className="hidden md:flex space-x-6 text-sm font-medium text-[#363535]">
              <Link
                href="/#browse-by-category"
                className="hover:text-black transition-colors"
              >
                Catalog
              </Link>
              <Link
                href={trackOrderHref}
                className="hover:text-black transition-colors"
              >
                Track Order
              </Link>
              <span className="text-gray-300">|</span>
              <Link href="/sale" className="text-[#B22222] hover:text-[#7f2222] font-semibold">
                Sale
              </Link>
            </nav>
          </div>

          {/* RIGHT - Search, Cart, Profile */}
          <div
            className={`flex items-center ${
              isSearchOpen
                ? "w-full justify-end md:w-auto md:space-x-4"
                : "space-x-2 md:space-x-4"
            }`}
          >
            {/* Search Button */}
            {/* Search Button */}
            <AnimatePresence mode="wait">
              {isSearchOpen ? (
                <SearchBar
                  key="searchbar"
                  isOpen={isSearchOpen}
                  onClose={() => setIsSearchOpen(false)}
                />
              ) : (
                <motion.button
                  key="searchicon"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => setIsSearchOpen(true)}
                  className="p-2 text-gray-500 hover:text-black transition"
                >
                  <Search size={20} />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Cart Button */}
            {!isCheckoutPage && (
              <button
                onClick={() => setIsCartOpen(true)}
                className={`relative p-2 text-gray-900 hover:bg-gray-100 rounded-full transition ${
                  isSearchOpen ? "hidden md:inline-flex" : ""
                }`}
              >
                <ShoppingBag size={20} />
                {mounted && cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-gray-900 text-white text-[10px] font-bold flex items-center justify-center rounded-full">
                    {cartCount}
                  </span>
                )}
              </button>
            )}

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* PROFILE BUTTON - AUTH-AWARE */}
            {/* ═══════════════════════════════════════════════════════════ */}

            <div ref={profileRef} className="relative hidden md:block">
              {/* Profile Icon */}
              <button
                disabled={isIdentityLoading}
                onClick={() => {
                  if (!isIdentityLoading) setIsProfileOpen(!isProfileOpen);
                }}
                className="flex items-center gap-2 rounded-full border border-transparent px-2 py-1.5 text-gray-900 transition hover:border-[#E7E5E4] hover:bg-white disabled:opacity-50"
              >
                {isAuthenticated && firstName ? (
                  <span className="max-w-24 truncate text-sm font-medium text-gray-700">
                    {firstName}
                  </span>
                ) : null}
                {isIdentityLoading ? (
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
                ) : (
                  <User size={20} />
                )}
              </button>

              {/* Profile Dropdown */}
              <AnimatePresence>
                {isProfileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute right-0 mt-3 w-72
                              bg-white/95 backdrop-blur
                              border border-[#E7E5E4]
                              rounded-2xl shadow-premium-hover
                              overflow-hidden z-50"
                  >
                    {isIdentityLoading ? (
                      /* LOADING STATE */
                      <div className="px-5 py-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                        <p className="text-sm text-gray-500 mt-2">Loading...</p>
                      </div>
                    ) : isAuthenticated ? (
                      /* LOGGED IN STATE */
                      <>
                        <div className="border-b border-[#E7E5E4] bg-[#FAFAF9] px-5 py-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1C1917] text-[#D4A373] shadow-sm">
                              <User size={18} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#363535]">
                                Signed in as
                              </p>
                              <h3 className="truncate text-lg font-serif font-semibold text-[#1C1917]">
                                {visibleProfileName || "Your Account"}
                              </h3>
                            </div>
                          </div>
                        </div>

                        <div className="p-2">
                          <Link
                            href="/account"
                            onClick={() => setIsProfileOpen(false)}
                            className="block rounded-xl px-4 py-3 text-sm font-medium text-[#363535] transition hover:bg-[#FAFAF9] hover:text-[#1C1917]"
                          >
                            My Account
                          </Link>
                          <Link
                            href="/orders"
                            onClick={() => setIsProfileOpen(false)}
                            className="block rounded-xl px-4 py-3 text-sm font-medium text-[#363535] transition hover:bg-[#FAFAF9] hover:text-[#1C1917]"
                          >
                            My Orders
                          </Link>
                          <Link
                            href="/account/reviews"
                            onClick={() => setIsProfileOpen(false)}
                            className="block rounded-xl px-4 py-3 text-sm font-medium text-[#363535] transition hover:bg-[#FAFAF9] hover:text-[#1C1917]"
                          >
                            My Reviews
                          </Link>
                        </div>

                        <div className="border-t border-[#E7E5E4] p-2">
                          <button
                            onClick={handleLogout}
                            className="flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                          >
                            <span className="inline-flex items-center gap-2">
                              Logout
                              <LogOut size={16} />
                            </span>
                          </button>
                        </div>
                      </>
                    ) : (
                      /* LOGGED OUT STATE */
                      <>
                        <div className="px-5 pt-5 pb-4">
                          <h3 className="text-lg font-serif font-bold text-[#1C1917] tracking-wide">
                            Your Account
                          </h3>
                          <div className="mt-2 h-[2px] w-12 bg-[#D4A373]"></div>
                        </div>

                        <div className="px-6 py-5 space-y-3">
                          <Link
                            href="/login"
                            onClick={() => setIsProfileOpen(false)}
                            className="block w-full py-3 px-4
           bg-[#1C1917] hover:bg-black
           text-white text-center font-medium text-base
           rounded-xl transition shadow-sm"
                          >
                            Login
                          </Link>
                          <Link
                            href="/signup"
                            onClick={() => setIsProfileOpen(false)}
                            className="block w-full py-3 px-4
           bg-white hover:bg-[#FAFAF9] border border-[#E7E5E4]
           text-[#1C1917] text-center font-medium text-base
           rounded-xl transition"
                          >
                            Register
                          </Link>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(true)}
              className={`md:hidden p-2 ${isSearchOpen ? "hidden" : ""}`}
            >
              <Menu size={24} />
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE MENU */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 flex h-full w-72 flex-col bg-[#FAFAF9] p-6 shadow-2xl z-50 border-l border-[#E7E5E4]"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-serif font-bold text-[#1C1917]">Menu</h2>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="rounded-full p-2 text-[#363535] hover:bg-[#E7E5E4] hover:text-[#1C1917] transition-colors"
                >
                  ✕
                </button>
              </div>

              {isAuthenticated ? (
                <div className="mb-6 rounded-2xl border border-[#E7E5E4] bg-white px-4 py-4 shadow-sm">
                  {isIdentityLoading ? (
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1C1917] text-[#D4A373] shadow-sm">
                        <Loader2 size={18} className="animate-spin" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#363535]">
                          Signed in as
                        </p>
                        <p className="text-sm font-medium text-gray-500">
                          Loading profile...
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1C1917] text-[#D4A373] shadow-sm">
                        <User size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#363535]">
                          Signed in as
                        </p>
                        <h3 className="truncate text-lg font-serif font-semibold text-[#1C1917]">
                          {visibleProfileName || "Your Account"}
                        </h3>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              <nav className="flex flex-col divide-y divide-[#E7E5E4]">
                <Link
                  href="/#browse-by-category"
                  onClick={() => setIsMenuOpen(false)}
                  className="py-4 text-lg font-medium text-[#363535] hover:text-[#1C1917] transition"
                >
                  Catalog
                </Link>
                <Link
                  href={trackOrderHref}
                  onClick={() => setIsMenuOpen(false)}
                  className="py-4 text-lg font-medium text-[#363535] hover:text-[#1C1917] transition"
                >
                  Track Order
                </Link>
                <Link
                  href="/sale"
                  onClick={() => setIsMenuOpen(false)}
                  className="py-4 text-lg font-semibold text-[#B22222] hover:text-[#7f2222] transition"
                >
                  Sale
                </Link>

                {isAuthenticated ? (
                  <>
                    <Link
                      href="/account"
                      onClick={() => setIsMenuOpen(false)}
                      className="py-4 text-lg font-medium text-[#363535] hover:text-[#1C1917] transition"
                    >
                      My Account
                    </Link>
                    <Link
                      href="/orders"
                      onClick={() => setIsMenuOpen(false)}
                      className="py-4 text-lg font-medium text-[#363535] hover:text-[#1C1917] transition"
                    >
                      My Orders
                    </Link>
                    <Link
                      href="/account/reviews"
                      onClick={() => setIsMenuOpen(false)}
                      className="py-4 text-lg font-medium text-[#363535] hover:text-[#1C1917] transition"
                    >
                      My Reviews
                    </Link>
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsMenuOpen(false);
                      }}
                      className="py-4 text-lg font-medium text-red-600 text-left"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setIsMenuOpen(false)}
                      className="py-4 text-lg font-medium text-[#363535] hover:text-[#1C1917] transition"
                    >
                      Login
                    </Link>
                    <Link
                      href="/signup"
                      onClick={() => setIsMenuOpen(false)}
                      className="py-4 text-lg font-medium text-[#363535] hover:text-[#1C1917] transition"
                    >
                      Sign Up
                    </Link>
                  </>
                )}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* CART DRAWER */}
      {!isCheckoutPage && (
        <CartDrawer isCartOpen={isCartOpen} setIsCartOpen={setIsCartOpen} />
      )}
    </>
  );
  
}
