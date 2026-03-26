"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function BannerContent({ banner }) {
  const hasCta = Boolean(banner.cta_text && banner.cta_link);
  const content = (
    <>
      {banner.subtitle ? (
        <p className="text-xs font-semibold uppercase tracking-[0.35em] opacity-80 sm:text-sm">
          {banner.subtitle}
        </p>
      ) : null}

      <div className="space-y-4">
        <h2 className="max-w-3xl font-serif text-3xl leading-tight sm:text-4xl lg:text-6xl">
          {banner.title}
        </h2>

        {banner.description ? (
          <div
            className="max-w-2xl text-sm leading-7 opacity-90 sm:text-base"
            dangerouslySetInnerHTML={{ __html: banner.description }}
          />
        ) : null}
      </div>

      <BannerMeta banner={banner} />

      {hasCta ? (
        <Link
          href={banner.cta_link}
          className="inline-flex w-fit items-center rounded-full border border-current px-5 py-3 text-sm font-semibold transition hover:bg-black/10"
        >
          {banner.cta_text}
        </Link>
      ) : null}
    </>
  );

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {content}
    </div>
  );
}

function BannerMeta({ banner }) {
  const metadata = banner.metadata || {};

  return (
    <div className="flex flex-wrap items-center gap-3">
      {metadata.countdown_label ? (
        <span className="rounded-full bg-white/16 px-4 py-2 text-xs font-semibold tracking-[0.2em] uppercase">
          {metadata.countdown_label}
        </span>
      ) : null}

      {metadata.coupon_code ? (
        <span className="rounded-full border border-current px-4 py-2 text-xs font-semibold tracking-[0.25em] uppercase">
          Code: {metadata.coupon_code}
        </span>
      ) : null}

      {metadata.audience ? (
        <span className="rounded-full bg-black/12 px-4 py-2 text-xs font-medium">
          {metadata.audience}
        </span>
      ) : null}
    </div>
  );
}

function BannerImage({ banner, priority = false, backgroundColor = "#111827" }) {
  if (!banner.image) {
    return null;
  }

  return (
    <>
      <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
        <Image
          src={banner.image}
          alt=""
          fill
          priority={priority}
          sizes="100vw"
          className="scale-110 object-cover opacity-40 blur-xl"
          aria-hidden="true"
        />
      </div>

      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to right, ${backgroundColor}12, transparent 18%, transparent 82%, ${backgroundColor}12)`,
        }}
      />

      <Image
        src={banner.image}
        alt={banner.title}
        fill
        priority={priority}
        sizes="100vw"
        className="object-contain"
      />
    </>
  );
}

function ImageOnlyBannerContent({ banner }) {
  if (!banner.cta_text || !banner.cta_link) {
    return null;
  }

  return (
    <div className="absolute bottom-6 left-6 z-10 sm:bottom-8 sm:left-8">
      <Link
        href={banner.cta_link}
        className="inline-flex items-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-black shadow-lg transition hover:bg-white/90"
      >
        {banner.cta_text}
      </Link>
    </div>
  );
}

function renderBannerByType(banner, isPriority) {
  const sharedStyle = {
    backgroundColor: banner.background_color || "#111827",
    color: banner.text_color || "#FFFFFF",
  };
  const sharedHeight = "h-[440px] sm:h-[520px]";

  switch (banner.type) {
    case "image":
      return (
        <article
          className={`relative overflow-hidden rounded-[2rem] ${sharedHeight}`}
          style={sharedStyle}
        >
          <div className="absolute inset-0 p-4 sm:p-6">
            <BannerImage
              banner={banner}
              priority={isPriority}
              backgroundColor={sharedStyle.backgroundColor}
            />
          </div>
          <ImageOnlyBannerContent banner={banner} />
        </article>
      );

    case "text":
      return (
        <article
          className={`relative overflow-hidden rounded-[2rem] ${sharedHeight}`}
          style={sharedStyle}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.2),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.14),transparent_30%)]" />
          <div className="relative z-10 flex h-full items-center px-6 py-12 sm:px-10 sm:py-16 lg:px-14">
            <BannerContent banner={banner} />
          </div>
        </article>
      );

    case "mixed":
    default:
      return (
        <article
          className={`relative overflow-hidden rounded-[2rem] ${sharedHeight}`}
          style={sharedStyle}
        >
          <div className="grid h-full grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="relative order-2 min-h-[220px] lg:order-1 lg:min-h-full">
              <BannerImage
                banner={banner}
                priority={isPriority}
                backgroundColor={sharedStyle.backgroundColor}
              />
            </div>
            <div className="relative order-1 flex items-center px-6 py-10 sm:px-10 lg:order-2 lg:px-14">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_30%)]" />
              <div className="relative z-10">
                <BannerContent banner={banner} />
              </div>
            </div>
          </div>
        </article>
      );
  }
}

export default function BannerSliderClient({ banners, interval = 4000 }) {
  const orderedBanners = useMemo(
    () => [...banners].sort((left, right) => left.priority - right.priority),
    [banners],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (orderedBanners.length <= 1 || isPaused) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % orderedBanners.length);
    }, interval);

    return () => window.clearInterval(timer);
  }, [interval, isPaused, orderedBanners.length]);

  if (!orderedBanners.length) {
    return null;
  }

  const goTo = (index) => setActiveIndex(index);
  const goPrevious = () =>
    setActiveIndex((current) =>
      current === 0 ? orderedBanners.length - 1 : current - 1,
    );
  const goNext = () =>
    setActiveIndex((current) => (current + 1) % orderedBanners.length);

  return (
    <section
      className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label="Promotional banners"
    >
      <div className="relative overflow-hidden">
        <div
          className="flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {orderedBanners.map((banner, index) => (
            <div key={banner.id} className="w-full shrink-0">
              {renderBannerByType(banner, index === 0)}
            </div>
          ))}
        </div>

        {orderedBanners.length > 1 ? (
          <>
            <button
              type="button"
              onClick={goPrevious}
              className="absolute left-4 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/35 bg-black/30 text-white backdrop-blur transition hover:bg-black/45"
              aria-label="Previous banner"
            >
              <ChevronLeft size={20} />
            </button>

            <button
              type="button"
              onClick={goNext}
              className="absolute right-4 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/35 bg-black/30 text-white backdrop-blur transition hover:bg-black/45"
              aria-label="Next banner"
            >
              <ChevronRight size={20} />
            </button>

            <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/30 px-3 py-2 backdrop-blur">
              {orderedBanners.map((banner, index) => (
                <button
                  key={banner.id}
                  type="button"
                  onClick={() => goTo(index)}
                  className={`h-2.5 rounded-full transition-all ${
                    index === activeIndex
                      ? "w-8 bg-white"
                      : "w-2.5 bg-white/45 hover:bg-white/70"
                  }`}
                  aria-label={`Go to banner ${index + 1}`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
