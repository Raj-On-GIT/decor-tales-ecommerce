export default function Hero() {
  return (
    <section
      className="
        w-full relative flex items-center justify-center

        h-[70vh] sm:h-[80vh] md:h-[85vh]
      "
    >
      {/* Background Image */}
      <img
        src="https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=2000"
        className="absolute inset-0 w-full h-full object-cover"
        alt="Hero"
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 md:bg-black/40" />

      {/* Content */}
      <div
        className="
          relative z-10
          text-center text-white

          max-w-xl md:max-w-3xl
          px-6 md:px-6
        "
      >
        {/* Heading */}
        <h1
          className="
            font-serif font-bold

            text-4xl sm:text-5xl
            md:text-6xl lg:text-7xl

            leading-tight
            mb-5 md:mb-6
          "
        >
          Frames that tell your story.
        </h1>

        {/* CTA */}
        <a
          href="/catalog"
          className="
            inline-block

            bg-white text-black
            font-bold

            px-6 py-3
            md:px-8 md:py-3

            rounded-lg
            hover:bg-gray-200
            transition
          "
        >
          Shop Collection
        </a>
      </div>
    </section>
  );
}
