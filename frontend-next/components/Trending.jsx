import { getTrendingProducts } from "@/lib/api";
import TrendingClient from "./TrendingClient";
import { isProductOutOfStock } from "@/lib/utils";
import ViewportReveal from "./ViewportReveal";

export default async function Trending() {
  const products = await getTrendingProducts(); // Show only top 8 trending products
  const visibleProducts = (products || []).filter(
    (product) => !isProductOutOfStock(product),
  );

  // Don't render the section at all if there's nothing trending yet
  if (!visibleProducts.length) return null;

  return (
    <section
      className="
        max-w-screen-xl mx-auto

        px-4 sm:px-6
        py-8
      "
    >
      <ViewportReveal>
        {/* Heading Row */}
        <div className="mb-5 md:mb-10">
          <h2
            className="
              font-serif font-bold text-black

              text-2xl sm:text-3xl md:text-4xl
            "
          >
            Trending Now
          </h2>
          <p className="mt-2 text-sm text-gray-600 sm:text-base">
            Most loved by our customers right now.
          </p>
        </div>

        {/* Products */}
        <TrendingClient products={visibleProducts.slice(0, 8)} />
      </ViewportReveal>
    </section>
  );
}
