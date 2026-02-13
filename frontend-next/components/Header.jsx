"use client";

import Link from "next/link";
import { useState } from "react";
import { ShoppingBag, Search, Menu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../context/StoreContext";
import CartDrawer from "./CartDrawer";

export default function Header() {
  const { cart } = useStore();

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);


  const cartCount = cart.reduce((acc, item) => acc + item.qty, 0);

  return (
    <>
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
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

              {/* Logo */}
              <img
                src="/DECOR_TALES_cropped.svg"
                alt="LuxeFrames Logo"
                className="h-8 md:h-10 w-auto"
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

            {/* Search */}
            <button className="p-2 text-gray-500 hover:text-black transition">
              <Search size={20} />
            </button>

            {/* Cart */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 text-gray-900 hover:bg-gray-100 rounded-full transition"
            >
              <ShoppingBag size={20} />

              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-gray-900 text-white text-[10px] font-bold flex items-center justify-center rounded-full">
                  {cartCount}
                </span>
              )}
            </button>

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
            {/* OVERLAY */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            />

            {/* DRAWER */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="
                fixed top-0 right-0 h-full w-72
                bg-white z-50 shadow-2xl
                p-6 flex flex-col
              "
            >
              {/* HEADER */}
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-serif font-bold">
                  Menu
                </h2>

                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  ✕
                </button>
              </div>

              {/* NAV LINKS */}
              <nav className="flex flex-col divide-y">

                <Link
                  href="/catalog"
                  onClick={() => setIsMenuOpen(false)}
                  className="
                    py-4 text-lg font-medium
                    text-gray-800 hover:text-black
                    transition
                  "
                >
                  Catalog
                </Link>

                <Link
                  href="/tracking"
                  onClick={() => setIsMenuOpen(false)}
                  className="
                    py-4 text-lg font-medium
                    text-gray-800 hover:text-black
                    transition
                  "
                >
                  Track Order
                </Link>

                <Link
                  href="/sale"
                  onClick={() => setIsMenuOpen(false)}
                  className="
                    py-4 text-lg font-semibold
                    text-rose-600
                  "
                >
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
