import { getProducts, getCategories } from "@/lib/api";
import BrowseByCategoryClient from "./BrowseByCategoryClient";

export default async function BrowseByCategory() {
  const categories = await getCategories();

  const categoriesWithCounts = categories.filter(
    (cat) =>
      cat.productCount > 0 ||
      cat.subcategoryCount > 0
  );



  return (
    <section className="max-w-screen-xl mx-auto px-6 py-10">
      {/* Heading */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-12">
        <div>
          <h2 className="text-4xl font-serif font-bold text-black">
            Browse by Category
          </h2>
          <p className="text-gray-600 mt-2">
            Explore our curated collection of premium products.
          </p>
        </div>

        <a
          href="/catalog"
          className="text-sm font-bold underline self-start sm:self-auto"
        >
          View All →
        </a>
      </div>

      {/* Categories Grid */}
      <BrowseByCategoryClient categories={categoriesWithCounts} />
    </section>
  );
}