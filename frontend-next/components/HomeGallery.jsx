import { getProducts } from "@/lib/api";
import HomeGalleryClient from "./HomeGalleryClient";
import { isProductOutOfStock } from "@/lib/utils";
import ViewportReveal from "./ViewportReveal";
import ViewAllLink from "./ViewAllLink";

export default async function HomeGallery() {
  const products = await getProducts();

  const sortedProducts = products.sort((a, b) => {
    const dateA = new Date(a.created_at || 0);
    const dateB = new Date(b.created_at || 0);
    return dateB - dateA;
  });
  const visibleProducts = sortedProducts.filter(
    (product) => !isProductOutOfStock(product),
  );

  return (
    <section
      className="
        max-w-screen-xl mx-auto

        px-4 sm:px-6
        pt-10 pb-10
      "
    >
      <ViewportReveal>
        {/* Heading Row */}
        <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 md:mb-10">
          <div className="min-w-0">
            <h2
              className="
                font-serif font-bold text-black

                text-2xl sm:text-3xl md:text-4xl
              "
            >
              Latest Collection
            </h2>
            <p className="mt-2 text-sm text-gray-600 sm:text-base">
              Handcrafted frames for the modern home.
            </p>
          </div>

          <ViewAllLink href="/latest" className="col-start-2 row-start-1" />
        </div>

        {/* Products */}
        <HomeGalleryClient products={visibleProducts} />
      </ViewportReveal>
    </section>
  );
}
