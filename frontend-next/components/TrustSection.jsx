import { Truck, ShieldCheck, Star } from "lucide-react";
import ViewportReveal from "./ViewportReveal";

export default function TrustSection() {
  const items = [
    {
      icon: <Truck size={30} strokeWidth={2.5} />,
      title: "Fast Delivery",
      desc: "Pan-India shipping in 3-5 days.",
    },
    {
      icon: <ShieldCheck size={30} strokeWidth={2.5} />,
      title: "Secure Payments",
      desc: "Razorpay protected checkout.",
    },
    {
      icon: <Star size={30} strokeWidth={2.5} />,
      title: "Premium Craftsmanship",
      desc: "Frames made with museum-grade finish.",
    },
  ];

  return (
    <section className="bg-white py-5 sm:py-16">
      <ViewportReveal
        stagger
        className="mx-auto max-w-screen-xl"
      >
        <div className="rounded-[2rem] px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-col lg:flex-row lg:items-stretch lg:justify-between">
            {items.map((item, index) => (
              <div
                key={item.title}
                className="relative flex-1"
              >
                <div className="flex flex-col items-center gap-4 py-5 text-center sm:flex-row sm:items-start sm:text-left sm:gap-5 lg:h-full lg:flex-col lg:items-center lg:justify-center lg:px-8 lg:py-6 lg:text-center">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#eef7ea] text-[#002424] shadow-[inset_0_0_0_1px_rgba(0,36,36,0.06)]">
                    {item.icon}
                  </div>

                  <div className="max-w-xs">
                    <h3 className="text-base font-semibold tracking-[0.01em] text-gray-900 sm:text-lg">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-6 text-gray-600 sm:text-[15px]">
                      {item.desc}
                    </p>
                  </div>
                </div>

                {index < items.length - 1 ? (
                  <>
                    <div
                      aria-hidden="true"
                      className="mx-auto h-[2px] w-full bg-gradient-to-r from-transparent via-[#9ab4a8]/65 to-transparent lg:hidden"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute right-0 top-1/2 hidden h-full w-[3px] -translate-y-1/2 bg-gradient-to-b from-transparent via-[#9ab4a8]/65 to-transparent lg:block"
                    />
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </ViewportReveal>
    </section>
  );
}
