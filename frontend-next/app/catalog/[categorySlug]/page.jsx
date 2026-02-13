// app/catalog/[categorySlug]/page.jsx

import ProductCard from "@/components/ProductCard";
import { BACKEND } from "@/lib/api";
import BrowseByCategoryClient from "@/components/BrowseByCategoryClient";

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
  const { categorySlug } = await params; // ✅ unwrap promise
  const data = await getCategoryData(categorySlug);

  return (
    <section className="max-w-screen-xl mx-auto px-6 py-10">
      {/* CATEGORY HEADING */}
      <h1 className="text-3xl sm:text-4xl font-serif font-bold mb-8">
        {data.category}
      </h1>

      {/* ================= SUBCATEGORY TILES ================= */}
      {data.has_subcategories ? (
        <BrowseByCategoryClient
          categories={data.subcategories
            .filter((sub) => sub.productCount > 0)
            .map((sub) => ({
              id: sub.id,
              name: sub.name,
              slug: `${categorySlug}/${sub.slug}`, // 👈 important
              image: sub.image,
              productCount: sub.productCount,
              subcategoryCount: 0, // subcategories don’t have nested subs
            }))}
        />
      ) : (
        /* ================= PRODUCTS GRID ================= */

        <div
          className="
    grid
    grid-cols-2 sm:grid-cols-3 lg:grid-cols-4
    gap-8
  "
        >
          {data.products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
}
