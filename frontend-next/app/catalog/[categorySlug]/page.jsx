import { BACKEND } from "@/lib/api";
import BrowseByCategoryClient from "@/components/BrowseByCategoryClient";
import ProductGridWithLoadMore from "@/components/ProductGridWithLoadMore";

const PRODUCTS_PER_PAGE = 12;

async function getCategoryData(slug) {
  const res = await fetch(
    `${BACKEND}/api/categories/${slug}/?limit=${PRODUCTS_PER_PAGE}&offset=0`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    throw new Error("Failed to fetch category");
  }

  return res.json();
}

export default async function CategoryPage({ params }) {
  const { categorySlug } = await params;
  const data = await getCategoryData(categorySlug);
  const products = data.products || [];

  return (
    <section className="mx-auto max-w-screen-xl px-4 py-10 sm:px-6 sm:py-14 md:py-16">
      <h1 className="mb-6 font-serif text-3xl font-bold sm:mb-8 sm:text-4xl">
        {data.category}
      </h1>

      {data.has_subcategories ? (
        <BrowseByCategoryClient
          categories={data.subcategories
            .filter((sub) => sub.productCount > 0)
            .map((sub) => ({
              id: sub.id,
              name: sub.name,
              slug: `${categorySlug}/${sub.slug}`,
              image: sub.image,
              productCount: sub.productCount,
              subcategoryCount: 0,
            }))}
          reveal
        />
      ) : (
        <ProductGridWithLoadMore
          initialProducts={products}
          count={data.count ?? products.length}
          hasMore={Boolean(data.has_more)}
          apiPath={`/api/categories/${categorySlug}/`}
          emptyMessage="No products found in this category."
        />
      )}
    </section>
  );
}
