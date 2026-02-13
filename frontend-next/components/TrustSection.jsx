import { Truck, ShieldCheck, Star } from "lucide-react";

export default function TrustSection() {
  const items = [
    {
      icon: <Truck size={28} />,
      title: "Fast Delivery",
      desc: "Pan-India shipping in 3–5 days.",
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
    <section className="bg-gray-50 py-16">
      <div className="max-w-screen-2xl mx-auto px-6 grid md:grid-cols-3 gap-10 text-center">
        {items.map((x, i) => (
          <div
            key={i}
            className="p-8 bg-white rounded-xl shadow-sm border"
          >
            <div className="flex justify-center mb-4 text-gray-900">
              {x.icon}
            </div>
            <h3 className="font-bold text-gray-800 text-black mb-2">{x.title}</h3>
            <p className="text-gray-600 text-sm">{x.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
