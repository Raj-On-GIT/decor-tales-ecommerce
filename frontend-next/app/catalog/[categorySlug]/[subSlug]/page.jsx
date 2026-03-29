import { BACKEND } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { sortProductsInStockFirst } from "@/lib/utils";

async function getSubcategoryData(category, sub) {
  const res = await fetch(`${BACKEND}/api/categories/${category}/${sub}/`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch subcategory");
  }

  return res.json();
}

export default async function SubcategoryPage({ params }) {
  const { categorySlug, subSlug } = await params;

  const data = await getSubcategoryData(categorySlug, subSlug);
  const sortedProducts = sortProductsInStockFirst(data.products || []);

  return (
    <section className="mx-auto max-w-screen-xl px-4 py-10 sm:px-6 sm:py-14 md:py-16">
      <h1 className="mb-2 font-serif text-3xl font-bold sm:text-4xl">
        {data.category}
      </h1>

      <p className="mb-6 text-sm text-gray-600 sm:mb-8 sm:text-base">{data.subcategory}</p>

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 sm:gap-8 md:gap-10 lg:grid-cols-4">
        {sortedProducts.length > 0 ? (
          sortedProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))
        ) : (
          <p className="col-span-full text-center text-gray-500">
            No products found in this subcategory.
          </p>
        )}
      </div>
    </section>
  );
}
