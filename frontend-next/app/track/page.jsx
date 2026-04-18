import TrackOrderForm from "@/components/orders/TrackOrderForm";

export const metadata = {
  title: "Track Your Order | Decor Tales",
  description: "Track Decor Tales orders using an Order ID or tracking number.",
};

export default function TrackOrderPage() {
  return (
    <section className="min-h-screen bg-gradient-to-br from-[#F0FFDF] via-white to-[#FFECC0] px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-[2rem] border border-white/80 bg-white/75 px-6 py-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:px-8 sm:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-800/70">
            Order tracking
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-gray-900 sm:text-4xl">
            Track Your Order
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-600 sm:text-base">
            Enter your order details to view real-time tracking updates.
          </p>
        </div>

        <div className="mt-8">
          <TrackOrderForm />
        </div>
      </div>
    </section>
  );
}
