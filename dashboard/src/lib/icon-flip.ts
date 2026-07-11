import { IconChevronLeft, IconChevronRight, type Icon } from "@tabler/icons-react";

/**
 * Returns the correct chevron icon based on text direction and navigation intent.
 *
 * In LTR: "forward" (next page / drill down) = chevron-right, "back" = chevron-left.
 * In RTL: the icons flip — "forward" becomes chevron-left.
 *
 * @param dir - Current text direction ("ltr" | "rtl")
 * @param forward - Whether this represents forward/next navigation
 */
export function chevronForDirection(dir: "ltr" | "rtl", forward: boolean): Icon {
  const isLtr = dir === "ltr";
  return (forward && isLtr) || (!forward && !isLtr) ? IconChevronRight : IconChevronLeft;
}
