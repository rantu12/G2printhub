"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import type { CSSProperties } from "react";

type ProductImageCarouselProps = {
  images: string[];
  name: string;
  href: string;
  selectedColor: string;
  colorIndex: number;
  featured: boolean;
  discount: number;
};

export default function ProductImageCarousel({
  images,
  name,
  href,
  selectedColor,
  colorIndex,
  featured,
  discount,
}: ProductImageCarouselProps) {
  const gallery = images.length > 0 ? images : ["/products/placeholder.svg"];
  const [activeIndex, setActiveIndex] = useState(
    colorIndex < gallery.length ? colorIndex : 0
  );
  const [failedImage, setFailedImage] = useState(false);
  const [pointerStart, setPointerStart] = useState<number | null>(null);
  const didSwipe = useRef(false);

  function move(delta: number) {
    setFailedImage(false);
    setActiveIndex((current) => (current + delta + gallery.length) % gallery.length);
  }

  return (
    <div
      className="product-image-carousel"
      style={{ "--variant-tint": colorTint(selectedColor) } as CSSProperties}
    >
      <Link
        href={href}
        className="shop-product-image"
        aria-label={`View ${name}`}
        onPointerDown={(event) => {
          didSwipe.current = false;
          setPointerStart(event.clientX);
        }}
        onPointerUp={(event) => {
          if (pointerStart === null) return;
          const difference = event.clientX - pointerStart;
          if (Math.abs(difference) > 40 && gallery.length > 1) {
            didSwipe.current = true;
            move(difference < 0 ? 1 : -1);
          }
          setPointerStart(null);
        }}
        onPointerCancel={() => setPointerStart(null)}
        onClick={(event) => {
          if (didSwipe.current) {
            event.preventDefault();
            didSwipe.current = false;
          }
        }}
      >
        <Image
          key={`${gallery[activeIndex]}-${failedImage}`}
          src={failedImage ? "/products/placeholder.svg" : gallery[activeIndex]}
          alt={`${name}${selectedColor ? ` in ${selectedColor}` : ""}`}
          fill
          sizes="(max-width: 700px) 50vw, (max-width: 1000px) 33vw, 25vw"
          unoptimized
          draggable={false}
          onError={() => setFailedImage(true)}
        />
        {featured && <span className="shop-featured">Featured</span>}
        {discount > 0 && <span className="shop-discount">-{discount}%</span>}
        <span className="product-variant-preview" aria-hidden="true" />
      </Link>

      {gallery.length > 1 && (
        <>
          <button
            type="button"
            className="product-carousel-arrow previous"
            aria-label={`Previous image of ${name}`}
            onClick={() => move(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="product-carousel-arrow next"
            aria-label={`Next image of ${name}`}
            onClick={() => move(1)}
          >
            ›
          </button>
          <div className="product-carousel-dots" aria-label="Product images">
            {gallery.map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                aria-label={`Show image ${index + 1} of ${gallery.length}`}
                aria-current={activeIndex === index}
                onClick={() => {
                  setFailedImage(false);
                  setActiveIndex(index);
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function colorTint(color: string) {
  const colors: Record<string, string> = {
    Black: "rgba(15, 23, 42, 0.16)",
    White: "rgba(255, 255, 255, 0.2)",
    Red: "rgba(220, 38, 38, 0.16)",
    Blue: "rgba(37, 99, 235, 0.16)",
    Pink: "rgba(236, 72, 153, 0.16)",
    Green: "rgba(22, 163, 74, 0.16)",
  };
  return colors[color] ?? "transparent";
}
