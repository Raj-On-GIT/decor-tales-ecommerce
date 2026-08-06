import { BACKEND } from "@/lib/api";
import ProductGridWithLoadMore from "@/components/ProductGridWithLoadMore";

const PRODUCTS_PER_PAGE = 12;

async function getSubcategoryData(category, sub) {
  const res = await fetch(
    `${BACKEND}/api/categories/${category}/${sub}/?limit=${PRODUCTS_PER_PAGE}&offset=0`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    throw new Error("Failed to fetch subcategory");
  }

  return res.json();
}

export default async function SubcategoryPage({ params }) {
  const { categorySlug, subSlug } = await params;

  const data = await getSubcategoryData(categorySlug, subSlug);
  const products = data.products || [];

  return (
    <section className="mx-auto max-w-screen-xl px-4 py-10 sm:px-6 sm:py-14 md:py-16">
      <h1 className="mb-2 font-serif text-3xl font-bold sm:text-4xl">
        {data.category}
      </h1>

      <p className="mb-6 text-sm text-gray-600 sm:mb-8 sm:text-base">{data.subcategory}</p>

      <ProductGridWithLoadMore
        initialProducts={products}
        count={data.count ?? products.length}
        hasMore={Boolean(data.has_more)}
        apiPath={`/api/categories/${categorySlug}/${subSlug}/`}
        emptyMessage="No products found in this subcategory."
      />
    </section>
  );
}
