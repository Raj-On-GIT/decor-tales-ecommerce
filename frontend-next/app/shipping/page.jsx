import Image from "next/image";
import {
  ArrowUpRight,
  CircleHelp,
  Clock3,
  MapPinned,
  PackageCheck,
  ShieldCheck,
  Truck,
} from "lucide-react";

const benefits = [
  {
    icon: Truck,
    title: "Trusted courier partner",
    description:
      "Orders are shipped through Delhivery for dependable nationwide coverage.",
  },
  {
    icon: Clock3,
    title: "Fast dispatch flow",
    description:
      "Orders are processed promptly before they move into the courier network.",
  },
  {
    icon: ShieldCheck,
    title: "Trackable shipments",
    description:
      "Each shipped order receives tracking visibility once it is handed to the courier.",
  },
];

const processSteps = [
  {
    icon: PackageCheck,
    title: "Order confirmation",
    body: "Once your order is placed, we review item availability, verify details, and prepare it for fulfillment.",
  },
  {
    icon: Clock3,
    title: "Processing before dispatch",
    body: "Most orders are processed within 1 to 3 business days before they are packed and handed over for shipment.",
  },
  {
    icon: Truck,
    title: "Courier handoff",
    body: "After dispatch, the shipment moves through Delhivery's network and tracking updates become available.",
  },
  {
    icon: MapPinned,
    title: "Final delivery",
    body: "Delivery timelines depend on the destination city, serviceability, and courier movement in your region.",
  },
];

const deliveryWindows = [
  {
    region: "Metro cities",
    timeline: "Approximately 2 to 5 business days after dispatch",
    note: "Major serviceable locations may receive faster movement depending on route availability.",
  },
  {
    region: "Non-metro / remote areas",
    timeline: "Approximately 4 to 8 business days after dispatch",
    note: "Extended transit may apply for remote pincodes or regions with limited courier frequency.",
  },
];

const policyBlocks = [
  {
    heading: "Shipping charges",
    content:
      "Add your shipping fee policy here. You can replace this section with flat charges, weight-based rules, or a free-shipping threshold.",
  },
  {
    heading: "Tracking instructions",
    content:
      "After dispatch, customers can use their tracking details to follow shipment movement through Delhivery. Update this block if you want to explain where the AWB number is shared.",
  },
  {
    heading: "Courier partner",
    content:
      "Delivery is handled via Delhivery. You can expand this section later with service coverage details, pickup behavior, or packaging notes.",
  },
];

const faqs = [
  {
    question: "When will my order be dispatched?",
    answer:
      "Orders are generally processed within 1 to 3 business days before dispatch, subject to stock availability and order verification.",
  },
  {
    question: "How do I track my shipment?",
    answer:
      "Once the order is shipped, tracking updates can be followed through Delhivery using the shipment or AWB details shared after dispatch.",
  },
  {
    question: "Can delivery take longer than the estimated timeline?",
    answer:
      "Yes. Delays can happen due to weather, high-volume periods, regional restrictions, public holidays, or other unforeseen courier disruptions.",
  },
];

export const metadata = {
  title: "Shipping & Delivery | Decor Tales",
  description:
    "Learn how Decor Tales processes, dispatches, and delivers orders through Delhivery, including timelines, tracking, and shipping information.",
};

export default function ShippingPage() {
  return (
    <section className="relative overflow-hidden bg-[#f8f6f1] text-[#163332]">
      <div className="absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-[#dce8e3] via-[#f2f6f3] to-transparent" />
      <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-[#2f5d56]/10 blur-3xl" />
      <div className="absolute -right-20 bottom-12 h-72 w-72 rounded-full bg-[#c58b52]/10 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-5 py-5 sm:px-8 sm:py-10 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="max-w-3xl">
            <h1 className="mt-4 font-serif text-4xl leading-tight text-[#102726] sm:text-5xl">
              Shipping & Delivery
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-[#45615f] sm:text-base">
              A clean delivery information page built to match the site and stay
              easy to edit. Update the content blocks below whenever your
              shipping policy, pricing, or courier workflow changes.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="https://www.delhivery.com/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#173b38] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#102c2a]"
              >
                Visit Delhivery
                <ArrowUpRight size={16} />
              </a>
              <a
                href="https://www.delhivery.com/tracking"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#bfd1cb] bg-white px-6 py-3 text-sm font-semibold text-[#173b38] transition hover:border-[#9fb8b0] hover:bg-[#f4f8f6]"
              >
                Track With Delhivery
                <ArrowUpRight size={16} />
              </a>
            </div>
          </div>

          <aside className="rounded-[30px] mt-5 border border-[#d7e2de] bg-white/90 p-6 shadow-[0_18px_60px_rgba(16,39,38,0.08)] backdrop-blur sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7b8f8d]">
              Our Delivery Partner
            </p>
            <div className="mt-5 overflow-hidden rounded-[24px] border border-[#e6eeeb] bg-[#f7faf8] p-5">
              <Image
                src="/delhivery-partner.png"
                alt="Delhivery delivery partner logo"
                width={920}
                height={360}
                className="h-auto w-full"
                priority
              />
            </div>
            <p className="mt-5 text-sm leading-7 text-[#4c6765] sm:text-base">
              Delivery is handled via <strong>Delhivery</strong>. Official
              reference links:
              {" "}
              <a
                href="https://www.delhivery.com/"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[#173b38] underline decoration-[#9ab7af] underline-offset-4"
              >
                delhivery.com
              </a>
              {" "}
              and
              {" "}
              <a
                href="https://help.delhivery.com/docs/track-orders"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[#173b38] underline decoration-[#9ab7af] underline-offset-4"
              >
                official tracking help
              </a>
              .
            </p>
          </aside>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {benefits.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="rounded-[28px] border border-[#d7e2de] bg-white/90 p-6 shadow-[0_18px_60px_rgba(16,39,38,0.07)]"
            >
              <span className="inline-flex rounded-full bg-[#dce8e3] p-3 text-[#1c4742]">
                <Icon size={20} />
              </span>
              <h2 className="mt-4 text-xl font-semibold text-[#173433]">
                {title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#4c6765]">
                {description}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[30px] border border-[#d7e2de] bg-white/90 p-6 shadow-[0_18px_60px_rgba(16,39,38,0.08)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7b8f8d]">
              Overview of Shipping Process
            </p>
            <div className="mt-6 grid gap-4">
              {processSteps.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="flex gap-4 rounded-2xl border border-[#e6eeeb] bg-[#f9fbfa] p-4"
                >
                  <span className="mt-1 rounded-full bg-[#dce8e3] p-3 text-[#1c4742]">
                    <Icon size={18} />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-[#173433]">
                      {title}
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-[#4c6765]">
                      {body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-[#d7e2de] bg-[#173b38] p-6 text-white shadow-[0_18px_60px_rgba(16,39,38,0.14)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
              Estimated Delivery Timelines
            </p>
            <div className="mt-6 space-y-4">
              {deliveryWindows.map((item) => (
                <div
                  key={item.region}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <h2 className="text-lg font-semibold">{item.region}</h2>
                  <p className="mt-2 text-sm font-medium text-white/85">
                    {item.timeline}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-white/70">
                    {item.note}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm leading-7 text-white/70">
              These are indicative timelines and may vary based on courier
              routing, order volume, local serviceability, or special
              circumstances.
            </p>
          </div>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {policyBlocks.map((block) => (
            <article
              key={block.heading}
              className="rounded-[28px] border border-dashed border-[#bfd1cb] bg-white/70 p-6"
            >
              <h2 className="text-xl font-semibold text-[#173433]">
                {block.heading}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#4c6765]">
                {block.content}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[30px] border border-[#d7e2de] bg-white/90 p-6 shadow-[0_18px_60px_rgba(16,39,38,0.08)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7b8f8d]">
              Tracking
            </p>
            <h2 className="mt-4 text-2xl font-semibold text-[#173433]">
              Track your order
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#4c6765]">
              Use the official Delhivery tracking resource once shipment details
              are shared. If you later build an internal tracker, this section
              is ready to be replaced with a working form.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                readOnly
                aria-label="Tracking placeholder"
                value="AWB / tracking input can be connected here later"
                className="w-full rounded-2xl border border-[#dbe6e2] bg-[#f8fbf9] px-4 py-3 text-sm text-[#6f8482] focus:outline-none"
              />
              <a
                href="https://help.delhivery.com/docs/track-orders"
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#173b38] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#102c2a]"
              >
                Open Tracking
              </a>
            </div>
          </div>

          <div className="rounded-[30px] border border-[#d7e2de] bg-white/90 p-6 shadow-[0_18px_60px_rgba(16,39,38,0.08)] sm:p-8">
            <div className="flex items-center gap-3">
              <CircleHelp className="text-[#2f5d56]" size={18} />
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7b8f8d]">
                Shipping FAQ
              </p>
            </div>
            <div className="mt-6 space-y-4">
              {faqs.map((faq) => (
                <div
                  key={faq.question}
                  className="rounded-2xl border border-[#e6eeeb] bg-[#f9fbfa] p-4"
                >
                  <h2 className="text-lg font-semibold text-[#173433]">
                    {faq.question}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-[#4c6765]">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 rounded-[30px] border border-[#e1c8ab] bg-[#fff7ee] p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#9a6a38]">
            Delivery Disclaimer
          </p>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-[#6e5540] sm:text-base">
            Delivery timelines are estimates and not guaranteed. Delays may
            occur due to weather conditions, public holidays, high shipment
            volumes, operational constraints, remote-location routing, or other
            unforeseen circumstances affecting courier movement.
          </p>
        </div>
      </div>
    </section>
  );
}
