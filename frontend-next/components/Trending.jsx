import { getTrendingProducts } from "@/lib/api";
import TrendingClient from "./TrendingClient";

export default async function Trending() {
  const products = await getTrendingProducts();

  // Don't render the section at all if there's nothing trending yet
  if (!products || products.length === 0) return null;

  return (
    <section
      className="
        max-w-screen-xl mx-auto

        px-4 sm:px-6
        py-14 sm:py-16 md:py-20
      "
    >
      {/* Heading Row */}
      <div
        className="
          flex flex-col sm:flex-row
          sm:justify-between sm:items-end

          gap-4 mb-8 md:mb-10
        "
      >
        <div>
          <h2
            className="
              font-serif font-bold text-black

              text-2xl sm:text-3xl md:text-4xl
            "
          >
            Trending Now
          </h2>

          <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
            Most loved by our customers right now.
          </p>
        </div>

        <a
          href="/trending"
          className="
            text-sm font-bold underline
            self-start sm:self-auto
          "
        >
          View All →
        </a>
      </div>

      {/* Products */}
      <TrendingClient products={products} />
    </section>
  );
}