import Link from "next/link";
import NewsletterForm from "./NewsletterForm";

export default function Footer() {
  return (
    <footer className="bg-[#1C1917] pt-12 pb-6 text-white border-t border-[#E7E5E4]">
      <div className="max-w-screen-2xl mx-auto grid grid-cols-1 gap-10 px-5 sm:grid-cols-2 sm:px-6 md:px-10 xl:grid-cols-4 xl:px-35 md:gap-12">
        <div>
          <h3 className="mb-4 text-2xl font-serif font-bold text-[#FAFAF9]">Decor Tales</h3>
          <p className="text-sm text-[#D6D3D1] leading-relaxed">
            Premium handcrafted decor pieces designed for modern homes.
          </p>
        </div>

        <div>
          <h4 className="mb-5 font-bold tracking-wide text-[#FAFAF9] uppercase text-xs">Shop</h4>
          <ul className="space-y-3 text-sm text-[#D6D3D1]">
            <li>
              <Link href="/#browse-by-category" className="transition-colors duration-300 hover:text-[#D4A373]">
                All Products
              </Link>
            </li>
            <li>
              <Link href="/latest" className="transition-colors duration-300 hover:text-[#D4A373]">
                Latest Collection
              </Link>
            </li>
            <li>
              <Link href="/trending" className="transition-colors duration-300 hover:text-[#D4A373]">
                Trending Now
              </Link>
            </li>
            <li>
              <Link href="/#browse-by-category" className="transition-colors duration-300 hover:text-[#D4A373]">
                Browse by Category
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-5 font-bold tracking-wide text-[#FAFAF9] uppercase text-xs">Support</h4>
          <ul className="space-y-3 text-sm text-[#D6D3D1]">
            <li>
              <Link href="/shipping" className="transition-colors duration-300 hover:text-[#D4A373]">
                Shipping & Delivery
              </Link>
            </li>
            <li>
              <Link href="/returns" className="transition-colors duration-300 hover:text-[#D4A373]">
                Returns Policy
              </Link>
            </li>
            <li>
              <Link href="/track" className="transition-colors duration-300 hover:text-[#D4A373]">
                Track Order
              </Link>
            </li>
            <li>
              <Link href="/contact" className="transition-colors duration-300 hover:text-[#D4A373]">
                Contact Us
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-5 font-bold tracking-wide text-[#FAFAF9] uppercase text-xs">Newsletter</h4>
          <p className="mb-4 text-sm text-[#D6D3D1] leading-relaxed">
            Get updates & exclusive offers.
          </p>

          <NewsletterForm source="footer" variant="dark" />
        </div>
      </div>

      <div className="mt-12 flex flex-col items-center space-y-4 px-5 sm:px-6 md:px-10 xl:px-35">
        <div className="h-px w-full max-w-sm bg-[#44403C]"></div>
        <p className="text-xs text-[#A8A29E]">
          © {new Date().getFullYear()} Decor Tales. All rights reserved.
        </p>
      </div>
    </footer>
  );
}