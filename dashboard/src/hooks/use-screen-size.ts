import { useEffect, useState } from "react";

type ScreenSize = {
  width: number;
  height: number;
};

/**
 * Tracks the current viewport dimensions.
 * Updates on window resize events with automatic cleanup.
 */
export function useScreenSize(): ScreenSize {
  const [size, setSize] = useState<ScreenSize>({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return size;
}
