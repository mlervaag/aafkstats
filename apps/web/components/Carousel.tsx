"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FocusEvent, type TouchEvent } from "react";

type CarouselImage = {
  src: string;
  alt: string;
  credit?: string;
};

const images: CarouselImage[] = [
  {
    src: "/images/kraamyra/0kraamyra.jpg",
    alt: "Kråmyra som skibakke om vinteren, før fotballbanen ble anlagt"
  },
  {
    src: "/images/kraamyra/1kraamyra.jpg",
    alt: "AaFKs banekomité på Kråmyra i 1951"
  },
  {
    src: "/images/kraamyra/2kraamyra.jpg",
    alt: "To barn ser vintertreningskampen mellom AaFK og Raufoss på Kråmyra i 1966"
  },
  {
    src: "/images/kraamyra/3kraamyra.jpg",
    alt: "AaFK spiller den første ordinære seriekampen på Kråmyra mot Kristiansund i 1977"
  },
  {
    src: "/images/kraamyra/4kraamyra.jpg",
    alt: "Et tettpakket publikum følger kamp fra tribunene på Kråmyra",
    credit: "Arnfinn Mauren"
  },
  {
    src: "/images/kraamyra/5kraamyra.jpg",
    alt: "Nær 10 000 tilskuere på Kråmyra under kampen mellom AaFK og Molde i 2003",
    credit: "Sunnmørsposten"
  }
];

const AUTOPLAY_INTERVAL = 7000;
const MIN_SWIPE_DISTANCE = 50;

export function Carousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(true);
  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updatePreference);
      return () => mediaQuery.removeEventListener("change", updatePreference);
    }

    if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(updatePreference);
      return () => mediaQuery.removeListener(updatePreference);
    }
  }, []);

  useEffect(() => {
    if (isHovered || hasFocus || isPaused || prefersReducedMotion) return;

    const interval = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % images.length);
    }, AUTOPLAY_INTERVAL);

    return () => window.clearInterval(interval);
  }, [currentIndex, hasFocus, isHovered, isPaused, prefersReducedMotion]);

  const showPrevious = () => {
    setCurrentIndex((index) => (index === 0 ? images.length - 1 : index - 1));
  };

  const showNext = () => {
    setCurrentIndex((index) => (index + 1) % images.length);
  };

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setHasFocus(false);
    }
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchEnd.current = null;
    touchStart.current = event.targetTouches[0].clientX;
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    touchEnd.current = event.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStart.current === null || touchEnd.current === null) return;

    const distance = touchStart.current - touchEnd.current;
    if (distance > MIN_SWIPE_DISTANCE) showNext();
    if (distance < -MIN_SWIPE_DISTANCE) showPrevious();
  };

  const currentImage = images[currentIndex];

  return (
    <section
      className="carousel-section"
      aria-labelledby="kraamyra-carousel-title"
      aria-roledescription="karusell"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setHasFocus(true)}
      onBlur={handleBlur}
    >
      <header className="carousel-heading">
        <p className="eyebrow">Fra arkivet</p>
        <h2 id="kraamyra-carousel-title">Kråmyra gjennom tidene</h2>
        <p>Fra vinterbakke til fullsatte tribuner – seks glimt fra AaFKs gamle hjemmebane.</p>
      </header>

      <div
        className="carousel-container"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Image
          key={currentImage.src}
          className="carousel-image"
          src={currentImage.src}
          alt={currentImage.alt}
          fill
          priority={currentIndex === 0}
          quality={82}
          sizes="(max-width: 760px) calc(100vw - 2rem), 1112px"
        />

        <button
          type="button"
          className="carousel-nav carousel-nav-left"
          onClick={showPrevious}
          aria-label="Forrige bilde"
        >
          <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <button
          type="button"
          className="carousel-nav carousel-nav-right"
          onClick={showNext}
          aria-label="Neste bilde"
        >
          <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="carousel-controls">
        <div className="carousel-dots" aria-label="Velg bilde">
          {images.map((image, index) => (
            <button
              key={image.src}
              type="button"
              className="carousel-dot"
              aria-label={`Vis bilde ${index + 1} av ${images.length}`}
              aria-current={index === currentIndex ? "true" : undefined}
              onClick={() => setCurrentIndex(index)}
            />
          ))}
        </div>
        {!prefersReducedMotion && (
          <button
            type="button"
            className="carousel-pause"
            aria-pressed={isPaused}
            onClick={() => setIsPaused((paused) => !paused)}
          >
            {isPaused ? "Start bildevisning" : "Stopp bildevisning"}
          </button>
        )}
      </div>

      <p className="carousel-caption">
        Bilde {currentIndex + 1} av {images.length} ·{" "}
        <Link href="/kilder/tango-siden-1914-2013-806b">Kilde: Tango siden 1914</Link>
        {currentImage.credit && ` (Foto: ${currentImage.credit})`}
      </p>
    </section>
  );
}
