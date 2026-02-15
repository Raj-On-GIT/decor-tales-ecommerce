import { getProducts } from "@/lib/api";
import ProductCard from "@/components/ProductCard";

export default async function LatestCollectionPage() {
  const products = await getProducts();

  const sorted = products.sort((a, b) => {
    const dateA = new Date(a.created_at || 0);
    const dateB = new Date(b.created_at || 0);
    return dateB - dateA;
  });

  return (
    <section className="max-w-screen-xl mx-auto px-4 sm:px-6 py-14 sm:py-16 md:py-20">
      <div className="mb-8 md:mb-10">
        <h2 className="font-serif font-bold text-black text-2xl sm:text-3xl md:text-4xl">
          Latest Collection
        </h2>
        <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
          Handcrafted frames for the modern home.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-8 md:gap-10">
        {sorted.length > 0 ? (
          sorted.map((p) => <ProductCard key={p.id} product={p} />)
        ) : (
          <p className="col-span-full text-center text-gray-600">
            No products found.
          </p>
        )}
      </div>
    </section>
  );
}