import { getProducts } from "@/lib/api";
import HomeGalleryClient from "./HomeGalleryClient";

export default async function HomeGallery() {
  const products = await getProducts();

  const sortedProducts = products.sort((a, b) => {
    const dateA = new Date(a.created_at || 0);
    const dateB = new Date(b.created_at || 0);
    return dateB - dateA;
  });

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
            Latest Collection
          </h2>

          <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
            Handcrafted frames for the modern home.
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

      {/* Products */}
      <HomeGalleryClient products={sortedProducts} />
    </section>
  );
}
