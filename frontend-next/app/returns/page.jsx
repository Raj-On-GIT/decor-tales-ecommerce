const policySections = [
  {
    eyebrow: "Returns",
    title: "No return after purchase",
    body: "Items once sold cannot be returned. However, they are available for exchange. In case an item is exchanged, delivery charges will be required to be paid again by the customer.",
  },
  {
    eyebrow: "Customized orders",
    title: "Personalized gifts are final sale",
    body: "For customized souvenirs or gifts, no return or exchange will be offered.",
  },
  {
    eyebrow: "Transit damage",
    title: "Broken items in transit can be exchanged",
    body: "We will exchange items broken in transit.",
  },
  {
    eyebrow: "Exchange window",
    title: "Raise the request within 3 business days",
    body: "Exchange request for a product can be made within 3 business days only, after which we will not be able for any broken or wrong product delivered to the customer.",
  },
];

export const metadata = {
  title: "Returns Policy | Decor Tales",
  description: "Read the exchange and transit-damage policy for Decor Tales orders.",
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
            Returns & Exchange Policy
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-[#45615f] sm:text-base">
            This page is structured for future edits, so policy details can be
            refined directly in this JSX file without changing the layout.
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

        <div className="mt-8 rounded-[28px] border border-dashed border-[#b8cbc6] bg-white/60 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#2f5d56]">
            Edit Placeholder
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#4c6765] sm:text-base">
            Add future notes here such as packaging instructions, proof
            requirements for transit damage, exchange approval process, or any
            category-specific conditions.
          </p>
        </div>
      </div>
    </section>
  );
}
