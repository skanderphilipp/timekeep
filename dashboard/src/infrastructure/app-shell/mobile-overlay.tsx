import styles from "@/app-shell.module.scss";

type MobileOverlayProps = {
  open: boolean;
  onClick: () => void;
};

/** Semi-transparent overlay that closes the mobile sidebar on click/escape. */
export function MobileOverlay({ open, onClick }: MobileOverlayProps) {
  if (!open) return null;
  return (
    <div
      data-slot="sidebar-overlay"
      className={styles.overlay}
      role="button"
      tabIndex={-1}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Escape" || e.key === "Enter") onClick();
      }}
    />
  );
}
