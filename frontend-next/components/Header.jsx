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
import { usePathname, useRouter } from "next/navigation";
import { getProfile } from "@/lib/api";

export default function Header() {
  const { cart } = useStore();
  const { isAuthenticated, logout, loading, user } = useAuth();

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const toast = useGlobalToast();
  const router = useRouter();
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

  useEffect(() => {
    let cancelled = false;

    async function loadProfileName() {
      setIsProfileLoading(true);
      try {
        const profile = await getProfile();
        if (cancelled) return;

        const fullName = [profile.first_name, profile.last_name]
          .map((part) => part?.trim())
          .filter(Boolean)
          .join(" ");

        setProfileName(fullName || profile.email || "Your Account");
      } catch {
        if (!cancelled) {
          setProfileName("Your Account");
        }
      } finally {
        if (!cancelled) {
          setIsProfileLoading(false);
        }
      }
    }

    if (!isAuthenticated) {
      setProfileName("");
      setIsProfileLoading(false);
      return () => {
        cancelled = true;
      };
    }

    loadProfileName();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id]);

  const visibleProfileName = isAuthenticated ? profileName : "";
  const isIdentityLoading = loading || (isAuthenticated && isProfileLoading);
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

  useEffect(() => {
    if (isCheckoutPage) {
      setIsCartOpen(false);
    }
  }, [isCheckoutPage]);
  /**
   * Handle logout
   * Calls logout() from AuthContext which:
   * - Clears tokens from localStorage
   * - Resets auth state
   * - Redirects to homepage
   */
  const handleLogout = () => {
    logout(); // clears auth state
    setIsProfileOpen(false);

    toast.info("You’ve been signed out! See you soon 👋", 2500);

    // Small delay so toast renders before navigation
    setTimeout(() => {
      router.push("/");
    }, 200);
  };
  const trackOrderHref = isAuthenticated ? "/orders" : "/login";

  return (
    <>
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-[#F0FFDF]/80 backdrop-blur-md border-b border-gray-100">
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
            <Link href="/" className="flex items-center shrink-0 mr-4">
              <Image
                src="/DECOR_TALES_cropped.svg"
                alt="Decor Tales"
                width={260}
                height={80}
                className="h-12 w-auto object-contain"
                priority
              />
            </Link>

            <nav className="hidden md:flex space-x-6 text-sm font-medium text-gray-600">
              <Link
                href="/catalog"
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
              <Link href="/sale" className="text-rose-600 font-semibold">
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
                  isMobile={true}
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
                className="flex items-center gap-2 rounded-full border border-transparent px-2 py-1.5 text-gray-900 transition hover:border-gray-200 hover:bg-white/70 disabled:opacity-50"
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
                              border border-gray-200
                              rounded-2xl shadow-xl
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
                        <div className="border-b border-gray-200 bg-gradient-to-br from-[#F7FFD9] via-white to-[#FFF3D6] px-5 py-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#002424] text-white shadow-sm">
                              <User size={18} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                                Signed in as
                              </p>
                              <h3 className="truncate text-lg font-serif font-semibold text-gray-900">
                                {visibleProfileName || "Your Account"}
                              </h3>
                            </div>
                          </div>
                        </div>

                        <div className="p-2">
                          <Link
                            href="/account"
                            onClick={() => setIsProfileOpen(false)}
                            className="block rounded-xl px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-[#f7fbe8] hover:text-gray-900"
                          >
                            My Account
                          </Link>
                          <Link
                            href="/orders"
                            onClick={() => setIsProfileOpen(false)}
                            className="block rounded-xl px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-[#f7fbe8] hover:text-gray-900"
                          >
                            My Orders
                          </Link>
                        </div>

                        <div className="border-t border-gray-200 p-2">
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
                          <h3 className="text-lg font-bold text-gray-900 tracking-wide">
                            Your Account
                          </h3>
                          <div className="mt-2 h-1 w-12 bg-teal-500"></div>
                        </div>

                        <div className="px-6 py-5 space-y-3">
                          <Link
                            href="/login"
                            onClick={() => setIsProfileOpen(false)}
                            className="block w-full py-3 px-4
           bg-[#002424] hover:bg-[#004c4c] hover:text-white
           text-white text-center font-medium text-base
           rounded-xl transition"
                          >
                            Login
                          </Link>
                          <Link
                            href="/signup"
                            onClick={() => setIsProfileOpen(false)}
                            className="block w-full py-3 px-4
           bg-[#b2d8d8] hover:bg-[#74baba]
           text-black text-center font-medium text-base
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
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-72 bg-white z-50 shadow-2xl p-6 flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-serif font-bold">Menu</h2>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  ✕
                </button>
              </div>

              {isAuthenticated ? (
                <div className="mb-6 rounded-2xl border border-gray-200 bg-gradient-to-br from-[#F7FFD9] via-white to-[#FFF3D6] px-4 py-4">
                  {isIdentityLoading ? (
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#002424] text-white shadow-sm">
                        <Loader2 size={18} className="animate-spin" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                          Signed in as
                        </p>
                        <p className="text-sm font-medium text-gray-500">
                          Loading profile...
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#002424] text-white shadow-sm">
                        <User size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                          Signed in as
                        </p>
                        <h3 className="truncate text-lg font-serif font-semibold text-gray-900">
                          {visibleProfileName || "Your Account"}
                        </h3>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              <nav className="flex flex-col divide-y">
                <Link
                  href="/catalog"
                  onClick={() => setIsMenuOpen(false)}
                  className="py-4 text-lg font-medium text-gray-800 hover:text-black transition"
                >
                  Catalog
                </Link>
                <Link
                  href={trackOrderHref}
                  onClick={() => setIsMenuOpen(false)}
                  className="py-4 text-lg font-medium text-gray-800 hover:text-black transition"
                >
                  Track Order
                </Link>
                <Link
                  href="/sale"
                  onClick={() => setIsMenuOpen(false)}
                  className="py-4 text-lg font-semibold text-rose-600"
                >
                  Sale
                </Link>

                {isAuthenticated ? (
                  <>
                    <Link
                      href="/account"
                      onClick={() => setIsMenuOpen(false)}
                      className="py-4 text-lg font-medium text-gray-800 hover:text-black transition"
                    >
                      My Account
                    </Link>
                    <Link
                      href="/orders"
                      onClick={() => setIsMenuOpen(false)}
                      className="py-4 text-lg font-medium text-gray-800 hover:text-black transition"
                    >
                      My Orders
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
                      className="py-4 text-lg font-medium text-gray-800 hover:text-black transition"
                    >
                      Login
                    </Link>
                    <Link
                      href="/signup"
                      onClick={() => setIsMenuOpen(false)}
                      className="py-4 text-lg font-medium text-gray-800 hover:text-black transition"
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
