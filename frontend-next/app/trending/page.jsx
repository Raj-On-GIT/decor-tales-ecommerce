import { getTrendingProducts } from "@/lib/api";
import ProductCard from "@/components/ProductCard";

export default async function TrendingPage() {
  const products = await getTrendingProducts();

  return (
    <section className="max-w-screen-xl mx-auto px-4 sm:px-6 py-14 sm:py-16 md:py-20">
      <div className="mb-8 md:mb-10">
        <h2 className="font-serif font-bold text-black text-2xl sm:text-3xl md:text-4xl">
          Trending Now
        </h2>
        <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
          Most loved by our customers right now.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-8 md:gap-10">
        {products.length > 0 ? (
          products.map((p) => <ProductCard key={p.id} product={p} />)
        ) : (
          <p className="col-span-full text-center text-gray-600">
            No trending products right now. Check back soon!
          </p>
        )}
      </div>
    </section>
  );
}