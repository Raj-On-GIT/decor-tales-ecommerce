import Image from "next/image";
import Link from "next/link";

export default function CategoryCard({ category }) {
  return (
    <Link href={`/catalog/${category.slug}`} className="group block h-full">
      <article className="premium-card relative flex h-full flex-col overflow-hidden rounded-xl border-[#E7E5E4] bg-[#FAFAF9] hover:bg-[#F0F0EF] p-1 transition-all duration-500 ease-out hover:-translate-y-1 sm:p-1.5">
        <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-xl bg-[#F5F5F4] sm:h-48">
          {category.image ? (
            <Image
              src={category.image}
              alt={category.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              style={{ objectFit: "cover" }}
              className="transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#E7E5E4]/50">
              <span className="text-sm text-[#A8A29E]">No Image</span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-2 text-center mb-2 mt-3">
          <h3 className="mb-1 text-base font-bold text-[#1C1917] sm:text-lg">
            {category.name}
          </h3>
          <p className="text-xs text-[#78716C] sm:text-sm">
            {category.subcategoryCount > 0
              ? `${category.subcategoryCount} ${category.subcategoryCount === 1 ? "subcategory" : "subcategories"}`
              : `${category.productCount} ${category.productCount === 1 ? "product" : "products"}`}
          </p>
        </div>

        <div className="absolute right-4 bottom-4 rounded-full border border-[#E7E5E4] bg-white/80 p-1.5 opacity-0 shadow-sm backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
          <svg className="h-4 w-4 text-[#1C1917]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </article>
    </Link>
  );
}
