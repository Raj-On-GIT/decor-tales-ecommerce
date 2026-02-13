import { getProducts } from "@/lib/api";
import ProductCard from "@/components/ProductCard";

export default async function CatalogPage({ searchParams }) {
  const params = await searchParams;
  const category = params?.category;
  
  console.log("CatalogPage received category:", category);
  
  const products = await getProducts({ category });
  console.log("CatalogPage received products count:", products.length);

  const title = category
    ? `Products in ${
        category.charAt(0).toUpperCase() + category.slice(1)
      }`
    : "Latest Collection";

  return (
    <section className="max-w-7xl mx-auto px-6 py-16">
      <h2 className="text-3xl font-serif font-bold mb-10">{title}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        {products.length > 0 ? (
          products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))
        ) : (
          <p className="col-span-full text-center text-gray-600">
            No products found in this category.
          </p>
        )}
      </div>
    </section>
  );
}
