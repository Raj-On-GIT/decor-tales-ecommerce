import { getCategories } from "@/lib/api";
import BrowseByCategoryClient from "./BrowseByCategoryClient";
import ViewportReveal from "./ViewportReveal";

export default async function BrowseByCategory() {
  const categories = await getCategories();

  const categoriesWithCounts = categories.filter(
    (cat) => cat.productCount > 0 || cat.subcategoryCount > 0,
  );

  return (
    <section
      id="browse-by-category"
      className="
      scroll-mt-20 sm:scroll-mt-24 md:scroll-mt-20
      max-w-screen-xl mx-auto
      px-4 sm:px-6
      py-8
    "
    >
      <ViewportReveal>
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
              Our Products
            </h2>

            <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
              Explore our curated collection of premium products.
            </p>
          </div>

        </div>

        {/* Categories Grid */}
        <BrowseByCategoryClient categories={categoriesWithCounts} />
      </ViewportReveal>
    </section>
  );
}
