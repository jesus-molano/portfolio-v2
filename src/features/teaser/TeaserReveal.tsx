"use client";

import { type ReactNode, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

gsap.registerPlugin(useGSAP, ScrollTrigger);

type Props = {
  className: string;
  labelledBy: string;
  children: ReactNode;
};

/**
 * The section after the hero. The hero ends faded to night; this section
 * starts on the same colour and fades its `[data-reveal]` children in, one
 * after another, as it scrolls into view. Without JavaScript or with reduced
 * motion the content is simply visible.
 */
export function TeaserReveal({ className, labelledBy, children }: Props) {
  const section = useRef<HTMLElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (reducedMotion) return;
      gsap.fromTo(
        "[data-reveal]",
        { opacity: 0, y: 28 },
        {
          opacity: 1,
          y: 0,
          ease: "power2.out",
          stagger: 0.12,
          scrollTrigger: { trigger: section.current, start: "top 85%", end: "top 35%", scrub: 0.6 },
        },
      );
    },
    { scope: section, dependencies: [reducedMotion], revertOnUpdate: true },
  );

  return (
    <section ref={section} className={className} aria-labelledby={labelledBy}>
      {children}
    </section>
  );
}
