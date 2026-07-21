/**
 * AuthBackground — static decorative layers for the auth screens.
 *
 * Provides a gradient wash, fractal noise grain, and micro dot-grid
 * paper texture to create visual depth without distracting from
 * the login form.
 */
import styles from "./auth-layout.module.scss";

export function AuthBackground() {
  return (
    <div data-slot="auth-bg" className={styles.background} aria-hidden="true">
      {/* Gradient wash */}
      <div className={styles.gradient} />

      {/* Noise texture overlay (layer 1: fractal grain) */}
      <div className={styles.noise} />

      {/* Micro dot-grid (layer 2: paper texture) */}
      <div className={styles.dots} />
    </div>
  );
}
