"use client";

import { useEffect, useRef, useState } from "react";

export default function Hero() {
  const line = "Frames that tell your story.";
  const typingSpeed = 90;

  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [startTyping, setStartTyping] = useState(false);
  const [hovered, setHovered] = useState(false);

  const heroRef = useRef(null);
  const animationFrameRef = useRef(null);
  const startTimeRef = useRef(null);
  const buttonTimerRef = useRef(null);
  const doneRef = useRef(false);

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

  useEffect(() => {
    if (!startTyping || doneRef.current) return;

    const revealText = (timestamp) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const nextLength = Math.min(
        line.length,
        Math.floor(elapsed / typingSpeed) + 1,
      );

      setText(line.slice(0, nextLength));

      if (nextLength >= line.length) {
        setDone(true);
        doneRef.current = true;
        animationFrameRef.current = null;

        if (!buttonTimerRef.current) {
          buttonTimerRef.current = window.setTimeout(() => {
            setShowButton(true);
          }, 500);
        }
        return;
      }

      animationFrameRef.current = window.requestAnimationFrame(revealText);
    };

    const resumeAnimation = () => {
      if (animationFrameRef.current || doneRef.current) return;
      animationFrameRef.current = window.requestAnimationFrame(revealText);
    };

    resumeAnimation();

    window.addEventListener("focus", resumeAnimation);
    window.addEventListener("pageshow", resumeAnimation);
    document.addEventListener("visibilitychange", resumeAnimation);

    return () => {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (buttonTimerRef.current) {
        window.clearTimeout(buttonTimerRef.current);
        buttonTimerRef.current = null;
      }

      window.removeEventListener("focus", resumeAnimation);
      window.removeEventListener("pageshow", resumeAnimation);
      document.removeEventListener("visibilitychange", resumeAnimation);
    };
  }, [line, startTyping]);

  return (
    <section
      ref={heroRef}
      className="
        relative flex h-[70vh] w-full items-center justify-center
        sm:h-[80vh] md:h-[85vh]
      "
    >
      
      <img
        src="https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=2000"
        className="absolute inset-0 h-full w-full object-cover"
        alt="Hero"
      />

      <div className="absolute inset-0 bg-black/40" />

      <div className="relative z-10 max-w-xl px-6 text-center text-white md:max-w-3xl">
        <h1
          translate="no"
          className="
            notranslate mb-6
            font-serif font-bold
            text-4xl sm:text-5xl md:text-6xl lg:text-7xl
            leading-tight
          "
        >
          {text}
          {!done && (
            <span className="ml-1 inline-block h-[0.75em] w-[3px] bg-white animate-blink" />
          )}
        </h1>

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
            relative inline-flex items-center justify-center overflow-hidden rounded-lg bg-white px-6 py-3 font-bold transition-all duration-700 md:px-8 md:py-3
            ${
              showButton
                ? "translate-y-0 opacity-100"
                : "-translate-y-6 pointer-events-none opacity-0"
            }
          `}
        >
          <span
            className={`relative z-10 transition-colors duration-700 ${
              hovered ? "text-white" : "text-black"
            }`}
          >
            Shop Collection
          </span>

          <span
            className={`
              pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2f5d56]
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
