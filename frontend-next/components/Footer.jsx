export default function Footer() {
  return (
    <footer className="bg-[#002424] text-white pt-10 pb-5">
      <div className="max-w-screen-2xl mx-auto px-35 grid grid-cols-1 md:grid-cols-4 gap-10">

        {/* Brand */}
        <div>
          <h3 className="text-2xl font-serif font-bold mb-4">Decor Tales</h3>
          <p className="text-white/80 text-sm">
            Premium handcrafted decor pieces designed for modern homes.
          </p>
        </div>

        {/* Shop */}
        <div>
          <h4 className="font-bold mb-4">Shop</h4>
          <ul className="space-y-2 text-white/80 text-sm">
            <li>
              <a href="/catalog" className="hover:text-white transition">
                All Products
              </a>
            </li>
            <li>
              <a href="/latest" className="hover:text-white transition">
                Latest Collection
              </a>
            </li>
            <li>
              <a href="/trending" className="hover:text-white transition">
                Trending Now
              </a>
            </li>
            <li>
              <a href="/catalog" className="hover:text-white transition">
                Browse by Category
              </a>
            </li>
          </ul>
        </div>

        {/* Support */}
        <div>
          <h4 className="font-bold mb-4">Support</h4>
          <ul className="space-y-2 text-white/80 text-sm">
            <li>
              <a href="/shipping" className="hover:text-white transition">
                Shipping & Delivery
              </a>
            </li>
            <li>
              <a href="/returns" className="hover:text-white transition">
                Returns Policy
              </a>
            </li>
            <li>
              <a href="/track" className="hover:text-white transition">
                Track Order
              </a>
            </li>
            <li>
              <a href="/contact" className="hover:text-white transition">
                Contact Us
              </a>
            </li>
          </ul>
        </div>

        {/* Newsletter */}
        <div>
          <h4 className="font-bold mb-4">Newsletter</h4>
          <p className="text-white/80 text-sm mb-3">
            Get updates & exclusive offers.
          </p>

          <div className="flex">
            <input
              placeholder="Email"
              className="w-full px-4 py-2 rounded-l bg-white/10 text-white placeholder-white/60 focus:outline-none"
            />
            <button className="bg-white text-black px-4 rounded-r font-semibold hover:bg-gray-200">
              Go
            </button>
          </div>
        </div>

      </div>
      <div className="flex flex-col items-center mt-8 space-y-3">

  <div className="w-72 h-px bg-white/20"></div>

  <p className="text-white/60 text-xs">
    © {new Date().getFullYear()} Decor Tales. All rights reserved.
  </p>

</div>
    </footer>
  );
}