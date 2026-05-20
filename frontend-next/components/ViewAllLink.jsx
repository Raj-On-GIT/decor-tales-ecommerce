import Link from "next/link";
import Image from "next/image";

export default function ViewAllLink({ href, label = "View All", className = "" }) {
  return (
    <Link
      href={href}
      className={[
        "group inline-flex self-start sm:self-auto items-center gap-3 rounded-full",
        "border border-[#F5B6B6] bg-white/90 px-4 py-2.5 text-sm font-semibold text-gray-900",
        "shadow-[0_10px_30px_rgba(245,119,153,0.14)] backdrop-blur-sm",
        "transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-[#F57799]/60 hover:bg-[#FFF7CD] hover:shadow-[0_16px_36px_rgba(245,119,153,0.22)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F57799]/40 focus-visible:ring-offset-2",
        className,
      ].join(" ")}
    >
      <span>{label}</span>
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1b000d] text-white transition-transform duration-300 group-hover:translate-x-0.5">
        <Image
          src="/right_arrow.svg"
          alt=""
          width={14}
          height={14}
          className="h-3.5 w-3.5 invert"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}
