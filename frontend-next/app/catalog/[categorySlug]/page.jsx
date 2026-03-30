import ProductCard from "@/components/ProductCard";
import { BACKEND } from "@/lib/api";
import BrowseByCategoryClient from "@/components/BrowseByCategoryClient";
import ViewportReveal from "@/components/ViewportReveal";
import { sortProductsInStockFirst } from "@/lib/utils";

async function getCategoryData(slug) {
  const res = await fetch(`${BACKEND}/api/categories/${slug}/`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch category");
  }

  return res.json();
}

export default async function CategoryPage({ params }) {
  const { categorySlug } = await params;
  const data = await getCategoryData(categorySlug);
  const sortedProducts = sortProductsInStockFirst(data.products || []);

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
        <ViewportReveal
          stagger
          className="grid grid-cols-2 gap-5 sm:grid-cols-3 sm:gap-8 md:gap-10 lg:grid-cols-4"
        >
          {sortedProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </ViewportReveal>
      )}
    </section>
  );
}
