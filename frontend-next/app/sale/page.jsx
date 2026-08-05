import Link from "next/link";
import { ArrowRight, Tag } from "lucide-react";

export const metadata = {
  title: "Sale | Decor Tales",
  description:
    "The Decor Tales sale page is under construction and will be available in the future. Explore the full collection while you wait.",
};

export default function SalePage() {
  return (
    <section className="relative overflow-hidden bg-[#FAFAF9]">
      <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#E6CCBE]/40 blur-3xl" />
      <div className="absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-[#D6D3D1]/40 blur-3xl" />

      <div className="relative mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-5 py-16 sm:px-8 sm:py-24 md:py-28">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#1C1917] text-white sm:h-24 sm:w-24">
          <Tag size={34} className="sm:h-10 sm:w-10" />
        </div>

        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.24em] text-[#78716C] sm:text-sm">
          Coming Soon
        </p>
        <h1 className="mt-3 text-center font-serif text-3xl font-bold text-[#1C1917] sm:text-5xl">
          Our Sale is on the way
        </h1>
        <p className="mt-5 max-w-md text-center text-sm leading-7 text-[#78716C] sm:text-base">
          The dedicated sale page is still being planned and is currently under
          construction. We will announce it here as soon as it is ready, 
          please check back later.
        </p>

        <div className="mt-8 w-full max-w-sm rounded-2xl border border-[#E7E5E4] bg-white p-5 text-center sm:p-6">
          <p className="text-sm font-semibold text-[#1C1917]">
            This page will be available in the future.
          </p>
          <p className="mt-1.5 text-xs text-[#78716C] sm:text-sm">
            Meanwhile, explore the full Decor Tales collection.
          </p>
        </div>

        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1C1917] px-6 py-3 text-sm font-semibold text-white transition hover:bg-black"
          >
            Continue Shopping
          </Link>
          <Link
            href="/#browse-by-category"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#E7E5E4] bg-white px-6 py-3 text-sm font-semibold text-[#1C1917] transition hover:border-[#D6D3D1] hover:bg-[#FAFAF9]"
          >
            Browse Catalog
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
