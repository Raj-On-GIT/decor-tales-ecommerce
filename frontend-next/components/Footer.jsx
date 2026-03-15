export default function Footer() {
  return (
    <footer className="bg-[#002424] text-white pt-10 pb-5">
      <div className="max-w-screen-2xl mx-auto grid grid-cols-1 gap-8 px-5 sm:grid-cols-2 sm:px-6 md:px-10 xl:grid-cols-4 xl:px-35 md:gap-10">
        <div>
          <h3 className="mb-4 text-2xl font-serif font-bold">Decor Tales</h3>
          <p className="text-sm text-white/80">
            Premium handcrafted decor pieces designed for modern homes.
          </p>
        </div>

        <div>
          <h4 className="mb-4 font-bold">Shop</h4>
          <ul className="space-y-2 text-sm text-white/80">
            <li>
              <a href="/catalog" className="transition hover:text-white">
                All Products
              </a>
            </li>
            <li>
              <a href="/latest" className="transition hover:text-white">
                Latest Collection
              </a>
            </li>
            <li>
              <a href="/trending" className="transition hover:text-white">
                Trending Now
              </a>
            </li>
            <li>
              <a href="/catalog" className="transition hover:text-white">
                Browse by Category
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-4 font-bold">Support</h4>
          <ul className="space-y-2 text-sm text-white/80">
            <li>
              <a href="/shipping" className="transition hover:text-white">
                Shipping & Delivery
              </a>
            </li>
            <li>
              <a href="/returns" className="transition hover:text-white">
                Returns Policy
              </a>
            </li>
            <li>
              <a href="/track" className="transition hover:text-white">
                Track Order
              </a>
            </li>
            <li>
              <a href="/contact" className="transition hover:text-white">
                Contact Us
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-4 font-bold">Newsletter</h4>
          <p className="mb-3 text-sm text-white/80">
            Get updates & exclusive offers.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:gap-0">
            <input
              placeholder="Email"
              className="w-full rounded-md bg-white/10 px-4 py-2 text-white placeholder-white/60 focus:outline-none sm:rounded-l sm:rounded-r-none"
            />
            <button className="rounded-md bg-white px-4 py-2 font-semibold text-black hover:bg-gray-200 sm:rounded-l-none sm:rounded-r">
              Go
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center space-y-3 px-5 sm:px-6 md:px-10 xl:px-35">
        <div className="h-px w-72 bg-white/20"></div>
        <p className="text-xs text-white/60">
          © {new Date().getFullYear()} Decor Tales. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
