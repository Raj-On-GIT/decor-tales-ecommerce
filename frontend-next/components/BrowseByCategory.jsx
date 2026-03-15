import { getCategories } from "@/lib/api";
import BrowseByCategoryClient from "./BrowseByCategoryClient";

export default async function BrowseByCategory() {
  const categories = await getCategories();

  const categoriesWithCounts = categories.filter(
    (cat) => cat.productCount > 0 || cat.subcategoryCount > 0,
  );

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
            Browse by Category
          </h2>

          <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
            Explore our curated collection of premium products.
          </p>
        </div>

        <a
          href="/catalog"
          className="
          text-sm font-bold underline
          self-start sm:self-auto
        "
        >
          View All →
        </a>
      </div>

      {/* Categories Grid */}
      <BrowseByCategoryClient categories={categoriesWithCounts} />
    </section>
  );
}
