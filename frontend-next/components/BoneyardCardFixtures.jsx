"use client";

import { Skeleton } from "boneyard-js/react";
import CategoryCard from "./CategoryCard";
import ProductCard from "./ProductCard";

const product = {
  id: "skeleton-product",
  title: "Handcrafted Oak Frame",
  category: { name: "Wall Decor" },
  image: "/out_of_stock.svg",
  stock_type: "simple",
  stock: 10,
  mrp: 1899,
  slashed_price: 1499,
  discount_percent: 21,
};

const category = {
  id: "skeleton-category",
  name: "Wall Decor",
  slug: "wall-decor",
  image: "/out_of_stock.svg",
  productCount: 12,
  subcategoryCount: 0,
};

export default function BoneyardCardFixtures() {
  return (
    <main className="mx-auto max-w-screen-xl space-y-12 px-4 py-10 sm:px-6">
      <section>
        <h1 className="mb-6 text-2xl font-bold">Product card capture</h1>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 sm:gap-8 md:gap-10 lg:grid-cols-4">
          <Skeleton name="product-card" loading={false} select="viewport">
            <ProductCard product={product} />
          </Skeleton>
        </div>
      </section>

      <section>
        <h2 className="mb-6 text-2xl font-bold">Category card capture</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          <Skeleton name="category-card" loading={false} select="viewport">
            <CategoryCard category={category} />
          </Skeleton>
        </div>
      </section>
    </main>
  );
}
