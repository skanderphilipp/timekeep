import type { ReactNode, KeyboardEvent } from "react";

import { ListItem } from "./list-item";

type ClickableListItemProps = {
  children: ReactNode;
  onClick: () => void;
  /** Unique key for the list item. */
  id: string;
};

/**
 * A clickable list item with proper keyboard accessibility.
 *
 * Renders a button-like container around a standard ListItem,
 * providing onClick, onKeyDown (Enter/Space), role="button", and tabIndex.
 *
 * Use when list items need click interaction without creating raw <div> wrappers
 * in module components.
 */
export function ClickableListItem({ children, onClick, id }: ClickableListItemProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      data-slot="clickable-list-item"
      data-id={id}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className="clickable-list-item"
    >
      <ListItem>{children}</ListItem>
    </div>
  );
}
