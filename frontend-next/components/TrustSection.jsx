import { Truck, ShieldCheck, Star } from "lucide-react";
import ViewportReveal from "./ViewportReveal";

export default function TrustSection() {
  const items = [
    {
      icon: <Truck size={28} />,
      title: "Fast Delivery",
      desc: "Pan-India shipping in 3-5 days.",
    },
    {
      icon: <ShieldCheck size={28} />,
      title: "Secure Payments",
      desc: "Razorpay protected checkout.",
    },
    {
      icon: <Star size={28} />,
      title: "Premium Craftsmanship",
      desc: "Frames made with museum-grade finish.",
    },
  ];

  return (
    <section className="bg-white py-8 sm:py-16">
      <ViewportReveal
        stagger
        className="mx-auto grid max-w-screen-2xl grid-cols-1 gap-4 px-5 sm:grid-cols-2 sm:gap-6 sm:px-6 md:px-10 lg:grid-cols-3 lg:gap-10 xl:px-35"
      >
        {items.map((item, index) => (
          <div
            key={index}
            className="flex items-start gap-4 rounded-2xl border bg-white p-5 text-left shadow-sm sm:flex-col sm:items-center sm:p-6 sm:text-center lg:p-8"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F0FFF0] text-gray-900 sm:mb-1">
              {item.icon}
            </div>
            <div>
              <h3 className="mb-1 font-bold text-black sm:mb-2">{item.title}</h3>
              <p className="text-sm text-gray-600">{item.desc}</p>
            </div>
          </div>
        ))}
      </ViewportReveal>
    </section>
  );
}
