import { getBanners } from "@/lib/api";
import BannerSliderClient from "./BannerSliderClient";

export default async function BannerSlider({ interval = 4000 }) {
  const banners = await getBanners();

  if (!banners.length) {
    return null;
  }

  return <BannerSliderClient banners={banners} interval={interval} />;
}
