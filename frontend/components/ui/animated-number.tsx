"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "motion/react";

// A number that glides to its new value instead of jumping: "3 days" becoming "5 days", a price changing.
// Anyone who prefers reduced motion gets the final value at once.
export function AnimatedNumber({ value, format = (n: number) => String(Math.round(n)), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const controls = animate(from.current, value, {
      duration: reduced ? 0 : 0.45,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        from.current = latest;
        setShown(latest);
      },
    });
    return () => controls.stop();
  }, [value]);

  return <span className={className}>{format(shown)}</span>;
}
