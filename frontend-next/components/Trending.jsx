import Image from "next/image";
import Link from "next/link";
import { getTrendingProducts } from "@/lib/api";
import TrendingClient from "./TrendingClient";
import { isProductOutOfStock } from "@/lib/utils";

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
        py-8 sm:py-16 md:py-20
      "
    >
      {/* Heading Row */}
      <div
        className="
          flex flex-col sm:flex-row
          sm:justify-between sm:items-end

          gap-4 mb-5 md:mb-10
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

        <Link
          href="/trending"
          className="
            inline-flex items-center gap-2 text-sm font-bold underline
            self-start sm:self-auto
          "
        >
          <span>View All</span>
          <Image
            src="/right_arrow.svg"
            alt=""
            width={16}
            height={16}
            className="h-4 w-4"
            aria-hidden="true"
          />
        </Link>
      </div>

      {/* Products */}
      <TrendingClient products={visibleProducts.slice(0, 4)} />
    </section>
  );
}
