"use client";

import { useEffect, useRef, useState } from "react";

export default function Hero() {
  const line = "Frames that tell your story.";

  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [startTyping, setStartTyping] = useState(false);
  const [hovered, setHovered] = useState(false);

  const heroRef = useRef(null);

  // ================= VIEWPORT TRIGGER =================
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStartTyping(true);
          observer.disconnect();
        }
      },
      { threshold: 0.6 },
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

        setTimeout(() => {
          setShowButton(true);
        }, 500);
      }
    }, 90);

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
      <div className="absolute inset-0 bg-black/40" />

      {/* Content */}
      <div className="relative z-10 text-center text-white max-w-xl md:max-w-3xl px-6">
        {/* HEADING */}
        <h1
          className="
            font-serif font-bold
            text-4xl sm:text-5xl md:text-6xl lg:text-7xl
            leading-tight
            mb-6
          "
        >
          {text}
          {!done && (
            <span className="ml-1 inline-block w-[3px] h-[0.75em] bg-white animate-blink" />
          )}
        </h1>

        {/* CTA BUTTON */}
        <a
          href="/catalog"
          onMouseEnter={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            e.currentTarget.style.setProperty("--x", `${x}px`);
            e.currentTarget.style.setProperty("--y", `${y}px`);

            setHovered(true);
          }}
          onMouseLeave={() => setHovered(false)}
          className={`
            relative overflow-hidden
            inline-flex items-center justify-center
            bg-white
            font-bold
            px-6 py-3 md:px-8 md:py-3
            rounded-lg
            transition-all duration-700
            ${
              showButton
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-6 pointer-events-none"
            }
          `}
        >
          {/* Button Text */}
          <span
            className={`relative z-10 transition-colors duration-700 ${
              hovered ? "text-white" : "text-black"
            }`}
          >
            Shop Collection
          </span>

          {/* Ripple */}
          <span
            className={`
              absolute
              w-4 h-4
              rounded-full
              bg-[#2f5d56]
              pointer-events-none
              -translate-x-1/2 -translate-y-1/2
              transition-transform duration-900 ease-[cubic-bezier(0.25,1,0.5,1)]
              ${hovered ? "scale-[40]" : "scale-0"}
            `}
            style={{
              top: "var(--y)",
              left: "var(--x)",
            }}
          />
        </a>
      </div>
    </section>
  );
}
