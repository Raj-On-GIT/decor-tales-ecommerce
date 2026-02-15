import Hero from "@/components/Hero";
import HomeGallery from "@/components/HomeGallery";
import BrowseByCategory from "@/components/BrowseByCategory";
import TrustSection from "@/components/TrustSection";
import Footer from "@/components/Footer";
import Trending from "../components/Trending";

export default function Home() {
  return (
    <main>
      <Hero />
      <HomeGallery />
      <Trending />
      <BrowseByCategory />
      <TrustSection />
      <Footer />
    </main>
  );
}
