import { IconDots } from "@tabler/icons-react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

import { Dropdown } from "../dropdown";
import { MenuItem } from "../menu-item";
import { Checkbox } from "../checkbox";
import { MenuSeparator } from "../menu-separator";

import styles from "./table-options-dropdown.module.scss";

export type ColumnOption = {
  id: string;
  label: string;
  visible: boolean;
};

type TableOptionsDropdownProps = {
  /** Column definitions with visibility state. */
  columns: ColumnOption[];
  /** Called when a column's visibility is toggled. */
  onToggle: (columnId: string) => void;
  className?: string;
};

/**
 * Table Options dropdown — "Options" button → column visibility toggles.
 *
 * Twenty-inspired: a compact toolbar button that opens a dropdown with
 * checkbox-toggled column list. Matches the Filter button visual style.
 */
export function TableOptionsDropdown({
  columns,
  onToggle,
  className,
}: TableOptionsDropdownProps) {
  const { _ } = useLingui();

  return (
    <Dropdown
      trigger={
        <button type="button" className={styles.trigger}>
          <IconDots size={14} />
          <span>{_(msg`Options`)}</span>
        </button>
      }
      side="bottom"
      align="end"
      sideOffset={4}
      className={className}
    >
      <>
        {columns.map((col) => (
          <MenuItem
            key={col.id}
            label={col.label}
            leftIcon={
              <Checkbox
                checked={col.visible}
                onCheckedChange={() => onToggle(col.id)}
                aria-label={col.label}
              />
            }
            onClick={() => onToggle(col.id)}
          />
        ))}
        <MenuSeparator />
        <MenuItem
          label={_(msg`Show all`)}
          onClick={() => {
            columns.filter((c) => !c.visible).forEach((c) => onToggle(c.id));
          }}
        />
        <MenuItem
          label={_(msg`Hide all`)}
          onClick={() => {
            columns.filter((c) => c.visible).forEach((c) => onToggle(c.id));
          }}
        />
      </>
    </Dropdown>
  );
}

TableOptionsDropdown.displayName = "TableOptionsDropdown";
