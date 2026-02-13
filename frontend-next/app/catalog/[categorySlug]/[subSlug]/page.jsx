// app/catalog/[categorySlug]/[subSlug]/page.jsx

import Link from "next/link";
import { BACKEND } from "@/lib/api";


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
    const {categorySlug, subSlug} = await params;
    const data = await getSubcategoryData(
        categorySlug,
        subSlug
    
    );

  console.log("SUBS →", data.subcategories);

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
            <Link
              key={product.id}
              href={`/products/${product.id}`}
              className="block"
            >
              <div className="space-y-3">

                <div className="
                  aspect-[3/4]
                  bg-gray-100
                  rounded-xl
                  overflow-hidden
                ">
                  <img
                    src={product.image}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                <h3 className="
                  font-semibold text-sm
                  whitespace-nowrap
                  overflow-hidden
                  text-ellipsis
                ">
                  {product.title}
                </h3>

              </div>
            </Link>
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
