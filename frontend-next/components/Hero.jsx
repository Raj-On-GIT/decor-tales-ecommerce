"use client";

import { useEffect, useRef, useState } from "react";

export default function Hero() {
  const line = "Frames that tell your story.";

  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [startTyping, setStartTyping] = useState(false);

  const heroRef = useRef(null);

  // ================= VIEWPORT TRIGGER =================
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStartTyping(true);
          observer.disconnect(); // run once
        }
      },
      { threshold: 0.6 }
    );

    if (heroRef.current) observer.observe(heroRef.current);

    return () => observer.disconnect();
  }, []);

  // ================= TYPING EFFECT =================
  useEffect(() => {
    if (!startTyping) return;

    let i = 0;

    const typing = setInterval(() => {
      setText(line.substring(0, i + 1));
      i++;

      if (i === line.length) {
        clearInterval(typing);
        setDone(true);

        // Show CTA after 1 second
        setTimeout(() => {
          setShowButton(true);
        }, 500);
      }
    }, 90); // typing speed

    return () => clearInterval(typing);
  }, [startTyping]);

  return (
    <section
      ref={heroRef}
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
        {/* ================= HEADING ================= */}
        <h1
          className="
            font-serif font-bold
            text-4xl sm:text-5xl
            md:text-6xl lg:text-7xl
            leading-tight
            mb-5 md:mb-6
          "
        >
          {text}

          {/* Cursor (only while typing) */}
          {!done && (
            <span className="ml-1 inline-block w-[3px] h-[0.75em] bg-white animate-blink" />
          )}
        </h1>

        {/* ================= CTA ================= */}
        <a
          href="/catalog"
          className={`
            inline-block
            bg-white text-black
            font-bold
            px-6 py-3
            md:px-8 md:py-3
            rounded-lg
            hover:bg-gray-200
            transition

            transform duration-700 ease-out

            ${
              showButton
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-6 pointer-events-none"
            }
          `}
        >
          Shop Collection
        </a>
      </div>
    </section>
  );
}
