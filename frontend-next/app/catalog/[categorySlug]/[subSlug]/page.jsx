// app/catalog/[categorySlug]/[subSlug]/page.jsx

import { BACKEND } from "@/lib/api";
import ProductCard from "@/components/ProductCard";


async function getSubcategoryData(category, sub) {
  const res = await fetch(
    `${BACKEND}/api/categories/${category}/${sub}/`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch subcategory");
  }

  return res.json();
}


export default async function SubcategoryPage({ params }) {

  // Params are not async in App Router
  const { categorySlug, subSlug } = await params;

  const data = await getSubcategoryData(
    categorySlug,
    subSlug
  );

  return (
    <section className="max-w-screen-xl mx-auto px-6 py-10">

      {/* HEADING */}
      <h1 className="text-3xl sm:text-4xl font-serif font-bold mb-2">
        {data.category}
      </h1>

      <p className="text-gray-600 mb-8">
        {data.subcategory}
      </p>


      {/* PRODUCTS GRID */}
      <div className="
        grid
        grid-cols-2 sm:grid-cols-3 lg:grid-cols-4
        gap-8
      ">

        {data.products.length > 0 ? (

          data.products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
            />
          ))

        ) : (

          <p className="col-span-full text-center text-gray-500">
            No products found in this subcategory.
          </p>

        )}

      </div>

    </section>
  );
}
