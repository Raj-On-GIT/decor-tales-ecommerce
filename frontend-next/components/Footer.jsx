export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="max-w-screen-2xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-10">
        
        {/* Brand */}
        <div>
          <h3 className="text-2xl font-serif font-bold mb-4">
            LuxeFrames
          </h3>
          <p className="text-gray-400 text-sm">
            Premium handcrafted photo frames for modern homes.
          </p>
        </div>

        {/* Shop */}
        <div>
          <h4 className="font-bold mb-4">Shop</h4>
          <ul className="space-y-2 text-gray-400 text-sm">
            <li>All Frames</li>
            <li>Wood Collection</li>
            <li>Minimalist Frames</li>
            <li>Gift Frames</li>
          </ul>
        </div>

        {/* Support */}
        <div>
          <h4 className="font-bold mb-4">Support</h4>
          <ul className="space-y-2 text-gray-400 text-sm">
            <li>Shipping & Delivery</li>
            <li>Returns Policy</li>
            <li>Track Order</li>
            <li>Contact Us</li>
          </ul>
        </div>

        {/* Newsletter */}
        <div>
          <h4 className="font-bold mb-4">Newsletter</h4>
          <p className="text-gray-400 text-sm mb-3">
            Get updates & offers.
          </p>
          <div className="flex">
            <input
              placeholder="Email"
              className="w-full px-4 py-2 rounded-l bg-gray-800 text-white focus:outline-none"
            />
            <button className="bg-white text-black px-4 rounded-r font-bold">
              Go
            </button>
          </div>
        </div>
      </div>

      <p className="text-center text-gray-500 text-xs mt-12">
        © {new Date().getFullYear()} LuxeFrames. All rights reserved.
      </p>
    </footer>
  );
}
