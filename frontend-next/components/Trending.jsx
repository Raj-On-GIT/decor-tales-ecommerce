import { getTrendingProducts } from "@/lib/api";
import TrendingClient from "./TrendingClient";
import { isProductOutOfStock } from "@/lib/utils";
import ViewportReveal from "./ViewportReveal";
import ViewAllLink from "./ViewAllLink";

export default async function Trending() {
  const products = await getTrendingProducts(); // Show only top 4 trending products
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
        <div
          className="
            mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 md:mb-10
            sm:items-end
          "
        >
          <div className="min-w-0">
            <h2
              className="
                font-serif font-bold text-black

                text-2xl sm:text-3xl md:text-4xl
              "
            >
              Trending Now
            </h2>
          </div>

          <ViewAllLink href="/trending" className="col-start-2 row-start-1" />

          <p className="col-span-full text-sm text-gray-600 sm:mt-2 sm:text-base">
            Most loved by our customers right now.
          </p>
        </div>

        {/* Products */}
        <TrendingClient products={visibleProducts.slice(0, 4)} />
      </ViewportReveal>
    </section>
  );
}
