import ProductCard from "@/components/ProductCard";
import BrowseByCategoryClient from "@/components/BrowseByCategoryClient";
import ViewportReveal from "@/components/ViewportReveal";
import { MIN_SEARCH_QUERY_LENGTH, searchProducts } from "@/lib/api";
import { sortProductsInStockFirst } from "@/lib/utils";
import Link from "next/link";

export default async function SearchPage({ searchParams }) {
  const params = await searchParams;
  const query = (params?.q || "").trim();

  const results =
    query.length >= MIN_SEARCH_QUERY_LENGTH
      ? await searchProducts(query, {
          productsLimit: "all",
          categoriesLimit: "all",
          subcategoriesLimit: "all",
        })
      : null;

  const sortedProducts = sortProductsInStockFirst(results?.products || []);
  const totalMatches = results
    ? (results.meta?.products_total || 0) +
      (results.meta?.categories_total || 0) +
      (results.meta?.subcategories_total || 0)
    : 0;

  return (
    <section className="mx-auto max-w-screen-xl px-4 py-10 sm:px-6 sm:py-14 md:py-16">
      <div className="mb-10">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-500">
          Search
        </p>
        <h1 className="mt-3 font-serif text-3xl font-bold text-gray-900 sm:text-4xl">
          {query ? `Results for "${query}"` : "Search the catalog"}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-gray-600 sm:text-base">
          {query.length < MIN_SEARCH_QUERY_LENGTH
            ? `Enter at least ${MIN_SEARCH_QUERY_LENGTH} characters to search products, categories, and subcategories.`
            : `${totalMatches} matches found across the catalog.`}
        </p>
      </div>

      {query.length < MIN_SEARCH_QUERY_LENGTH ? null : totalMatches === 0 ? (
        <div className="rounded-3xl border border-gray-200 bg-[#F7FBE8] px-6 py-12 text-center">
          <p className="text-lg font-semibold text-gray-900">
            No matches found for &quot;{query}&quot;.
          </p>
          <p className="mt-2 text-sm text-gray-600">
            Try a broader keyword or browse the catalog instead.
          </p>
          <Link
            href="/catalog"
            className="mt-6 inline-flex rounded-full bg-[#002424] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#004c4c]"
          >
            Browse catalog
          </Link>
        </div>
      ) : (
        <div className="space-y-12">
          {results?.categories?.length > 0 && (
            <div>
              <div className="mb-6">
                <h2 className="font-serif text-2xl font-semibold text-gray-900">
                  Categories
                </h2>
                <p className="text-sm text-gray-600">
                  {results.meta?.categories_total || results.categories.length} matching
                  categories
                </p>
              </div>
              <BrowseByCategoryClient categories={results.categories} reveal />
            </div>
          )}

          {results?.subcategories?.length > 0 && (
            <div>
              <div className="mb-6">
                <h2 className="font-serif text-2xl font-semibold text-gray-900">
                  Subcategories
                </h2>
                <p className="text-sm text-gray-600">
                  {results.meta?.subcategories_total || results.subcategories.length} matching
                  subcategories
                </p>
              </div>
              <BrowseByCategoryClient
                categories={results.subcategories.map((subcategory) => ({
                  id: subcategory.id,
                  name: subcategory.name,
                  slug: subcategory.category?.slug
                    ? `${subcategory.category.slug}/${subcategory.slug}`
                    : "",
                  image: subcategory.image,
                  productCount: subcategory.productCount || 0,
                  subcategoryCount: 0,
                }))}
                reveal
              />
            </div>
          )}

          {sortedProducts.length > 0 && (
            <div>
              <div className="mb-6">
                <h2 className="font-serif text-2xl font-semibold text-gray-900">
                  Products
                </h2>
                <p className="text-sm text-gray-600">
                  {results.meta?.products_total || sortedProducts.length} matching products
                </p>
              </div>
              <ViewportReveal
                stagger
                className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 md:gap-6 lg:grid-cols-4"
              >
                {sortedProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </ViewportReveal>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
