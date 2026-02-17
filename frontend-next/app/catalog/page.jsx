import { getProducts, getCategories } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import BrowseByCategoryClient from "@/components/BrowseByCategoryClient";
import Footer from "@/components/Footer";

export default async function CatalogPage({ searchParams }) {
  const params = await searchParams;
  const category = params?.category;

  // ── No filter → show all categories ──────────────────────────────────────
  if (!category) {
    const categories = await getCategories();

    const categoriesWithContent = categories.filter(
      (cat) => cat.productCount > 0 || cat.subcategoryCount > 0
    );

    return (
      <div>
      <section className="max-w-screen-xl mx-auto px-6 py-16">
        <div className="mb-12">
          <h2 className="text-4xl font-serif font-bold text-black">
            Browse by Category
          </h2>
          <p className="text-gray-600 mt-2">
            Explore our curated collection of premium products.
          </p>
        </div>

        <BrowseByCategoryClient categories={categoriesWithContent} />
        
      </section>
      <Footer />
      </div>
    );
  }

  // ── Category filter active → show matching products ───────────────────────
  const products = await getProducts({ category });

  const title = category.charAt(0).toUpperCase() + category.slice(1);

  return (
    <div>
    <section className="max-w-7xl mx-auto px-6 py-16">
      <h2 className="text-3xl font-serif font-bold mb-10">
        {title}
      </h2>

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
    <Footer />
    </div>
  );
}
