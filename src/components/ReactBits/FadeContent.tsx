import { useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type FadeContentProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  children: ReactNode;
  blur?: boolean;
  duration?: number;
  delay?: number;
  threshold?: number;
  initialOpacity?: number;
  trigger?: "mount" | "scroll";
};

/**
 * React Bits FadeContent, adapted to TypeScript and reduced-motion support.
 * Keeps data-heavy screens calm: one opacity/blur reveal, no row animation.
 * Source pattern: https://reactbits.dev/animations/fade-content
 */
export default function FadeContent({
  children,
  blur = false,
  duration = 0.45,
  delay = 0,
  threshold = 0.08,
  initialOpacity = 0,
  trigger = "scroll",
  className = "",
  ...props
}: FadeContentProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(element, {
        autoAlpha: 1,
        filter: "none",
        clearProps: "transform",
      });
      return;
    }

    const context = gsap.context(() => {
      const from = {
        autoAlpha: initialOpacity,
        filter: blur ? "blur(10px)" : "blur(0px)",
        y: 8,
      };
      const to = {
        autoAlpha: 1,
        filter: "blur(0px)",
        y: 0,
        duration,
        delay,
        ease: "power2.out",
      };

      if (trigger === "mount") {
        gsap.fromTo(element, from, to);
        return;
      }

      gsap.set(element, from);
      ScrollTrigger.create({
        trigger: element,
        start: `top ${(1 - threshold) * 100}%`,
        once: true,
        onEnter: () => gsap.to(element, to),
      });
    }, element);

    return () => context.revert();
  }, [blur, delay, duration, initialOpacity, threshold, trigger]);

  return (
    <div ref={ref} className={className} {...props}>
      {children}
    </div>
  );
}
