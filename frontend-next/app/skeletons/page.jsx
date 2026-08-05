import BoneyardCardFixtures from "@/components/BoneyardCardFixtures";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

// Capture-only route used by `npm run skeletons:generate`.
export default function SkeletonFixturesPage() {
  return <BoneyardCardFixtures />;
}
