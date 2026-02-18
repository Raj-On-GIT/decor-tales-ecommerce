"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { ShoppingBag, Search, Menu, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../context/StoreContext";
import CartDrawer from "./CartDrawer";
import SearchBar from "./SearchBar";

export default function Header() {
  const { cart } = useStore();

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const profileRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const cartCount = mounted
    ? cart.reduce((acc, item) => acc + item.qty, 0)
    : 0;

  return (
    <>
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-[#F0FFDF]/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-screen-2xl mx-auto 
                        px-4 sm:px-6 md:px-10 lg:px-20
                        h-14 md:h-16 
                        flex items-center justify-between">

          {/* LEFT */}
          <div className="flex items-center space-x-4 md:space-x-8">
            <Link
              href="/"
              className="flex items-center gap-2 md:gap-3
                         text-lg md:text-2xl
                         font-serif font-bold tracking-tight text-gray-900
                         whitespace-nowrap">
              <img
                src="/DECOR_TALES_cropped.svg"
                alt="LuxeFrames Logo"
                className="h-8 md:h-10 w-auto bg-[#FFECC0] rounded-full"
              />
              Decor Tales
            </Link>

            <nav className="hidden md:flex space-x-6 text-sm font-medium text-gray-600">
              <Link href="/catalog" className="hover:text-black transition-colors">
                Catalog
              </Link>
              <Link href="/tracking" className="hover:text-black transition-colors">
                Track Order
              </Link>
              <span className="text-gray-300">|</span>
              <Link href="/sale" className="text-rose-600 font-semibold">
                Sale
              </Link>
            </nav>
          </div>

          {/* RIGHT */}
          <div className="flex items-center space-x-2 md:space-x-4">

            {/* Search — icon fades out, bar animates in */}
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

            {/* Cart */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 text-gray-900 hover:bg-gray-100 rounded-full transition"
            >
              <ShoppingBag size={20} />
              {mounted && cartCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-gray-900 text-white text-[10px] font-bold flex items-center justify-center rounded-full">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Profile Dropdown */}
            <div ref={profileRef} className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="p-2 text-gray-900 hover:bg-gray-100 rounded-full transition"
              >
                <User size={20} />
              </button>

              {/* Dropdown Card */}
              <AnimatePresence>
                {isProfileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute right-0 mt-3 w-64
                               bg-white border-2 border-red-500 rounded-lg shadow-2xl
                               overflow-hidden z-50"
                  >
                    {/* Header */}
                    <div className="px-5 pt-5 pb-4">
                      <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                        YOUR ACCOUNT
                      </h3>
                      <div className="mt-2 h-1 w-12 bg-red-500"></div>
                    </div>

                    {/* Buttons */}
                    <div className="px-5 pb-5 space-y-3">
                      <p className="text-gray-500 text-sm mb-1 px-1">Existing User?</p>
                      <Link
                        href="/login"
                        onClick={() => setIsProfileOpen(false)}
                        className="block w-full py-3 px-4 
                                   bg-[#FF7444] hover:bg-[#E76F1C]
                                   text-white text-center font-semibold text-base
                                   rounded transition-colors"
                      >
                        Login
                      </Link>
                      <p className="text-gray-500 text-sm mb-1 px-1">New to DC?</p>
                      <Link
                        href="/signup"
                        onClick={() => setIsProfileOpen(false)}
                        className="block w-full py-3 px-4 
                                   bg-slate-700 hover:bg-slate-800
                                   text-white text-center font-semibold text-base
                                   rounded transition-colors"
                      >
                        Register
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile Menu */}
            <button
              onClick={() => setIsMenuOpen(true)}
              className="md:hidden p-2"
            >
              <Menu size={24} />
            </button>

          </div>
        </div>
      </header>

      {/* MOBILE MENU DRAWER */}
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

              <nav className="flex flex-col divide-y">
                <Link href="/catalog" onClick={() => setIsMenuOpen(false)}
                  className="py-4 text-lg font-medium text-gray-800 hover:text-black transition">
                  Catalog
                </Link>
                <Link href="/tracking" onClick={() => setIsMenuOpen(false)}
                  className="py-4 text-lg font-medium text-gray-800 hover:text-black transition">
                  Track Order
                </Link>
                <Link href="/sale" onClick={() => setIsMenuOpen(false)}
                  className="py-4 text-lg font-semibold text-rose-600">
                  Sale
                </Link>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* CART DRAWER */}
      <CartDrawer isCartOpen={isCartOpen} setIsCartOpen={setIsCartOpen} />
    </>
  );
}