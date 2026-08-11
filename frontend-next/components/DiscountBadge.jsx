export default function DiscountBadge({ discountPercent }) {
  const hasDiscount = typeof discountPercent === "number";

  if (!hasDiscount) return null;

  return (
    <span className="inline-flex w-fit items-center whitespace-nowrap rounded-md bg-[#E6CCBE] px-1.5 py-[2px] text-[10px] font-semibold text-[#1C1917] sm:rounded-full sm:px-2 sm:py-0.5 sm:text-xs tracking-wide">
      {discountPercent}% OFF
    </span>
  );
}
