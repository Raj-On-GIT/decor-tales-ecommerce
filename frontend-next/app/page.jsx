import BannerSlider from "@/components/BannerSlider";
import HomeGallery from "@/components/HomeGallery";
import BrowseByCategory from "@/components/BrowseByCategory";
import TrustSection from "@/components/TrustSection";
import Trending from "../components/Trending";
import { Suspense } from "react";
import ProductGridSkeleton from "@/components/ProductGridSkeleton";
import CategoryGridSkeleton from "@/components/CategoryGridSkeleton";

export default function Home() {
  return (
    <main>
      <BannerSlider />
      <Suspense fallback={<ProductGridSkeleton count={4} />}>
        <HomeGallery />
      </Suspense>

      <Suspense fallback={<ProductGridSkeleton count={4} />}>
        <Trending />
      </Suspense>

      <Suspense fallback={<CategoryGridSkeleton count={4} />}>
        <BrowseByCategory />
      </Suspense>
      <TrustSection />
    </main>
  );
}
