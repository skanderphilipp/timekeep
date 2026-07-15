/**
 * AuthBackground — animated decorative elements for the auth screens.
 *
 * Uses framer-motion for subtle floating shapes and a CSS noise
 * texture overlay to create visual depth without distracting from
 * the login form.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import styles from "./auth-layout.module.scss";

/** Fixed seed positions so shapes don't shift on re-render. */
const SHAPES = [
  { x: "10%", y: "15%", size: 120, delay: 0, duration: 20 },
  { x: "85%", y: "20%", size: 80, delay: 3, duration: 18 },
  { x: "20%", y: "75%", size: 100, delay: 1, duration: 22 },
  { x: "75%", y: "70%", size: 60, delay: 5, duration: 16 },
  { x: "50%", y: "50%", size: 140, delay: 2, duration: 24 },
  { x: "5%", y: "45%", size: 50, delay: 4, duration: 19 },
  { x: "90%", y: "85%", size: 90, delay: 6, duration: 21 },
];

export function AuthBackground() {
  // Only animate on client (SSR-safe)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div data-slot="auth-bg" className={styles.background} aria-hidden="true">
      {/* Gradient wash */}
      <div className={styles.gradient} />

      {/* Noise texture overlay */}
      <div className={styles.noise} />

      {/* Floating accent shapes */}
      {mounted &&
        SHAPES.map((shape, i) => (
          <motion.div
            key={i}
            className={styles.shape}
            style={{
              left: shape.x,
              top: shape.y,
              width: shape.size,
              height: shape.size,
            }}
            animate={{
              y: [0, -30, 0],
              rotate: [0, 180, 360],
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: shape.duration,
              delay: shape.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
    </div>
  );
}
