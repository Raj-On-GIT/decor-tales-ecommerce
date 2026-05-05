import {
  Facebook,
  Instagram,
  Mail,
  MessageCircle,
  Phone,
  MapPin,
} from "lucide-react";


const contactMethods = [
  {
    icon: Phone,
    label: "Phone",
    value: "+91 88517 81355",
    href: "tel:+918851781355",
    note: "Primary contact number",
  },
  {
    icon: Phone,
    label: "Phone",
    value: "+91 72176 63365",
    href: "tel:+917217663365",
    note: "Alternate contact number",
  },
  {
    icon: Mail,
    label: "Email",
    value: "shrikrishnahandicrafts30@gmail.com",
    href: "mailto:shrikrishnahandicrafts30@gmail.com",
    note: "For order support and general queries",
  },
];

const socialLinks = [
  {
    icon: Instagram,
    label: "Instagram",
    value: "@decortales30",
  },
  {
    icon: Facebook,
    label: "Facebook",
    value: "To be added",
  },
  {
    icon: MessageCircle,
    label: "WhatsApp",
    value: "To be added",
  },
  {
    icon: MapPin,
    label: "Location",
    value: "To be added",
  }
];

export const metadata = {
  title: "Contact Us | Decor Tales",
  description: "Reach Decor Tales by phone or email and find upcoming social channels.",
};

export default function ContactPage() {
  return (
    <section className="relative overflow-hidden bg-[#fcfaf5] text-[#163332]">
      <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-[#dce8e3] via-[#f2f6f3] to-transparent" />
      <div className="absolute -left-24 top-20 h-64 w-64 rounded-full bg-[#2f5d56]/10 blur-3xl" />
      <div className="absolute -right-20 bottom-10 h-64 w-64 rounded-full bg-[#c58b52]/10 blur-3xl" />

      <div className="relative mx-auto max-w-5xl px-5 py-5 sm:px-8 sm:py-10 lg:px-10">
        <div className="">
          <h1 className="mt-4 font-serif text-4xl leading-tight text-[#102726] sm:text-5xl">
            Contact Us
          </h1>
          <p className="mt-5 text-sm text-[#45615f] sm:text-base">
            Please find the below contact details relevant to your inquiries. We are here to assist you with any questions, support, or feedback you may have. You can contact us through phone, email, or follow us on our social media channels for any updates.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="min-w-0 rounded-[28px] border border-[#d7e2de] bg-white/90 p-6 shadow-[0_18px_60px_rgba(16,39,38,0.08)] backdrop-blur sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7b8f8d]">
              Direct Support
            </p>
            <div className="mt-6 space-y-4">
              {contactMethods.map(({ icon: Icon, label, value, href, note }) => (
                <a
                  key={value}
                  href={href}
                  className="flex min-w-0 items-start gap-4 rounded-2xl border border-[#e4ece9] bg-[#f8fbf9] p-4 transition hover:border-[#bfd1cb] hover:bg-white"
                >
                  <span className="mt-1 shrink-0 rounded-full bg-[#dce8e3] p-3 text-[#1c4742]">
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-[#7b8f8d]">
                      {label}
                    </span>
                    <span className="mt-1 block break-words text-base font-medium text-[#173433] sm:text-lg">
                      {value}
                    </span>
                    <span className="mt-1 block text-sm text-[#5a7270]">
                      {note}
                    </span>
                  </span>
                </a>
              ))}
            </div>
          </div>

          <div className="min-w-0 rounded-[28px] border border-[#d7e2de] bg-[#163b38] p-6 text-white shadow-[0_18px_60px_rgba(16,39,38,0.14)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
              Social Media
            </p>
            <div className="mt-6 space-y-4">
              {socialLinks.map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="flex min-w-0 items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <span className="shrink-0 rounded-full bg-white/10 p-3 text-white">
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-medium">
                      {label}
                    </span>
                    <span className="block break-words text-sm text-white/65">
                      {value}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            
          </div>
        </div>
      </div>
    </section>
  );
}
