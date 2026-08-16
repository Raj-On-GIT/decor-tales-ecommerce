import { MessageCircle } from "lucide-react";

const WHATSAPP_CLAIMS_URL = "https://wa.me/message/D24UIHQEQT3MH1";

const policySections = [
  {
    eyebrow: "Returns",
    title: "No returns after purchase",
    body: "Once an order is placed and delivered, the purchase is final. We do not offer returns or exchange of any kind on delivered orders — this is not a return or exchange scheme.",
  },
  {
    eyebrow: "Replacement",
    title: "Replacement only in genuine cases",
    body: "A replacement is offered only in extreme cases: an item broken in transit or a wrong item delivered to you. Every claim is reviewed individually before any replacement is approved.",
  },
  {
    eyebrow: "Customized orders",
    title: "Customized items are final sale",
    body: "Items personalized with a name, photo, or custom message are made to order and cannot be replaced for any reason. This includes transit damage.",
  },
  {
    eyebrow: "Claim window",
    title: "Report within 3 business days",
    body: "A claim for transit damage or a wrong item must be raised within 3 business days of delivery. Claims raised after this window cannot be processed, regardless of the reason.",
  },
  {
    eyebrow: "Before delivery",
    title: "Refuse visibly damaged parcels at the doorstep",
    body: "If the outer carton looks crushed, torn, or tampered with, refuse the delivery at the doorstep. The parcel will return to us and we will arrange a replacement for you. This is the fastest way to resolve a transit-damage claim.",
  },
  {
    eyebrow: "Contact",
    title: "Claims are accepted on WhatsApp only",
    body: "Damage and wrong-item claims are handled only through our dedicated WhatsApp line. Emails, calls, or social media DMs are not treated as claims. Write to us on WhatsApp with the details listed below.",
  },
];

const claimRequirements = [
  {
    title: "Order number",
    body: "Your Decor Tales order number, so we can locate your order instantly.",
  },
  {
    title: "Parcel photos",
    body: "A clear photo of the sealed outer carton along with the invoice / tracking label stuck on it.",
  },
  {
    title: "Unboxing video",
    body: "One continuous unboxing video (no cuts) that starts at the sealed parcel, shows the seal being opened, and ends at the damaged or wrong item.",
  },
  {
    title: "Your contact details",
    body: "Your name and the phone number you ordered with, so we can update you on the claim.",
  },
];

export const metadata = {
  title: "Returns Policy | Decor Tales",
  description: "Read the returns, replacement, and transit-damage policy for Decor Tales orders.",
};

export default function ReturnsPage() {
  return (
    <section className="relative overflow-hidden bg-[#f7f5ef] text-[#163332]">
      <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-[#dbe9e5] via-[#eef4f1] to-transparent" />
      <div className="absolute -left-24 top-16 h-64 w-64 rounded-full bg-[#2f5d56]/10 blur-3xl" />
      <div className="absolute -right-24 bottom-10 h-64 w-64 rounded-full bg-[#c58b52]/10 blur-3xl" />

      <div className="relative mx-auto max-w-5xl px-5 py-5 sm:px-8 sm:py-10 lg:px-10">
        <div className="max-w-3xl">
          <h1 className="mt-4 font-serif text-4xl leading-tight text-[#102726] sm:text-5xl">
            Returns, Replacement & Damage Policy
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-[#45615f] sm:text-base">
            Please read this policy carefully. We do not offer returns or exchanges. A replacement is
            considered only in genuine cases of transit damage or a wrong item delivered — and every
            claim is accepted exclusively through WhatsApp.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {policySections.map((section) => (
            <article
              key={section.title}
              className="rounded-[28px] border border-[#d7e2de] bg-white/90 p-6 shadow-[0_18px_60px_rgba(16,39,38,0.08)] backdrop-blur"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7b8f8d]">
                {section.eyebrow}
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-[#173433]">
                {section.title}
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#4c6765] sm:text-base">
                {section.body}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-12 rounded-[28px] border border-[#d7e2de] bg-[#0f2e2b] p-6 text-white shadow-[0_18px_60px_rgba(16,39,38,0.15)] sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#9dbcb6]">
                How to raise a claim
              </p>
              <h2 className="mt-3 text-3xl font-semibold">
                Send these details on WhatsApp
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#cfe0dc]">
                To start a claim, message us on WhatsApp with the following, all in one message:
              </p>
            </div>

            <a
              href={WHATSAPP_CLAIMS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-bold text-[#06281f] transition hover:brightness-105"
            >
              <MessageCircle size={18} />
              Claim on WhatsApp
            </a>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {claimRequirements.map((item) => (
              <div key={item.title} className="rounded-[20px] bg-white/5 p-5">
                <p className="text-sm font-bold text-[#bfe3d9]">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-[#cfe0dc]">{item.body}</p>
              </div>
            ))}
          </div>

          <p className="mt-8 text-xs leading-6 text-[#9dbcb6]">
            Important: Claims with incomplete details — such as a missing order number, missing parcel
            photo, or a cut unboxing video — will not be processed and will be closed without review.
            No claim will be entertained over email, phone, or social media.
          </p>
        </div>
      </div>
    </section>
  );
}
