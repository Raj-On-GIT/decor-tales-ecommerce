// app/catalog/[categorySlug]/page.jsx

import Link from "next/link";
import { BACKEND } from "@/lib/api";


async function getCategoryData(slug) {
  const res = await fetch(
    `${BACKEND}/api/categories/${slug}/`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch category");
  }

  return res.json();
}


export default async function CategoryPage({ params }) {

  const {categorySlug} = await params;   // ✅ unwrap promise
  const data = await getCategoryData(categorySlug);
  console.log(
    "CATEGORY DETAIL API →",
    JSON.stringify(data, null, 2)
  );
  console.log("SUBS →", data.subcategories);

  return (
    <section className="max-w-screen-xl mx-auto px-6 py-10">

      {/* CATEGORY HEADING */}
      <h1 className="text-3xl sm:text-4xl font-serif font-bold mb-8">
        {data.category}
      </h1>

      {/* ================= SUBCATEGORY TILES ================= */}
      {data.has_subcategories ? (

        <div className="
          grid
          grid-cols-2 sm:grid-cols-3 lg:grid-cols-4
          gap-6
        ">

          {data.subcategories
            .filter((sub) => sub.productCount > 0)   // ✅ FILTER ADDED
            .map((sub) => (
              <Link
                key={sub.id}
                href={`/catalog/${categorySlug}/${sub.slug}`}
                className="group"
              >
                <div className="
                  aspect-square
                  bg-gray-100
                  rounded-xl
                  overflow-hidden
                  relative
                ">

                  <img
                    src={
                      sub.image ||
                      "https://via.placeholder.com/400"
                    }
                    alt={sub.name}
                    className="
                      w-full h-full
                      object-cover
                      group-hover:scale-105
                      transition
                    "
                  />

                  <div className="
                    absolute inset-0
                    bg-black/30
                    flex items-center justify-center
                  ">
                    <h2 className="
                      text-white
                      font-semibold
                      text-lg
                      text-center
                      px-3
                    ">
                      {sub.name}
                    </h2>
                  </div>

                </div>
              </Link>
            ))}

        </div>

      ) : (


      /* ================= PRODUCTS GRID ================= */

        <div className="
          grid
          grid-cols-2 sm:grid-cols-3 lg:grid-cols-4
          gap-8
        ">
          {data.products.map((product) => (
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

                <h3 className="font-semibold text-sm">
                  {product.title}
                </h3>

              </div>
            </Link>
          ))}
        </div>

      )}

    </section>
  );
}
