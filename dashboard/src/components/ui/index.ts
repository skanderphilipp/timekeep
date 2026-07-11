/*
 * Attendance OS — UI Component Library
 *
 * Barrel file. Every component exposes its public API via its own index.ts.
 * Import like: import { Button, Card } from "@/components/ui";
 */

export { ActionGroup } from "./action-group";
export { Badge } from "./badge";
export { Button } from "./button";
export type { ButtonProps } from "./button";
export { Card } from "./card";
export { CardGrid } from "./card-grid";
export { Checkbox } from "./checkbox";
export { DataTable, TextCell, TimestampCell, DurationCell, StatusCell } from "./data-table";
export type { SortDirection, SortState, DataTableColumn, TextCellProps, TimestampCellProps, DurationCellProps, StatusCellProps } from "./data-table";
export { DetailGrid, DetailItem } from "./detail-grid";
export { Dialog } from "./dialog";
export { EmptyState } from "./empty-state";
export { Form, FormField, FormActions, FormSection, FormFieldInput, FieldInputContainer, SchemaForm } from "./form";
export type { FormFieldDef } from "./form";
export { Grid } from "./grid";
export { Heading } from "./heading";
export type { HeadingLevel, HeadingColor } from "./heading";
export { InlineHeader } from "./inline-header";
export { Input } from "./input";
export { PageBar } from "./page-bar";
export type { BreadcrumbSegment } from "./page-bar";
export { PageHeader } from "./page-header";
export { PageLayout } from "./page-layout";
export { PageBody } from "./page-body";
export { Pagination } from "./pagination";
export { Section } from "./section";
export { Select } from "./select";
export { Separator } from "./separator";
export { Skeleton, SkeletonLines } from "./skeleton";
export { Spinner } from "./spinner";
export { StatusDot } from "./status-dot";
export { StatusBadge } from "./status-badge";
export { MetricCard } from "./metric-card";
export type { MetricCardColor } from "./metric-card";
export { Text } from "./text";
export type { TextVariant, TextColor, TextElement } from "./text";
export { Toggle } from "./toggle";
export { Tooltip } from "./tooltip";
export { VisuallyHidden } from "./visually-hidden";
export { IconButton } from "./icon-button";
export { MenuItem, MenuCloseContext } from "./menu-item";
export { MenuItemNavigate } from "./menu-item-navigate";
export { MenuSeparator } from "./menu-separator";
export { Dropdown, useDropdownContext } from "./dropdown";
export { DropdownContent } from "./dropdown-content";
export { DropdownSearch } from "./dropdown-search";
export { FilterBar } from "./filter-bar";
export type { ActiveFilter } from "./filter-bar";
export { FilterDropdown } from "./filter-dropdown";
export type { FilterField } from "./filter-dropdown";
export { FilterInput } from "./filter-input";
export { FilterSelect } from "./filter-select";
export { FilterDateRange } from "./filter-date-range";
export { Chip, ChipSize, ChipAccent, ChipVariant } from "./chip";
export type { ChipProps } from "./chip";
export { LinkChip } from "./link-chip";
export type { LinkChipProps, TriggerEventType } from "./link-chip";
export { ListItem } from "./list-item";
export { ClickableListItem } from "./clickable-list-item";
export { BooleanCell } from "./data-table/cells/boolean-cell";
export type { BooleanCellProps } from "./data-table/cells/boolean-cell";
export { EllipsisDisplay } from "./ellipsis-display";
export type { EllipsisDisplayProps } from "./ellipsis-display";
export { Avatar } from "./avatar";
export { TextArea } from "./text-area";
export { SearchInput } from "./search-input";
export { Banner } from "./banner";
export { ProgressBar } from "./progress-bar";
export { TabList, Tab, TabPanel } from "./tab-list";
export { Chart } from "./chart";
export { BarChart } from "./bar-chart";
export { LineChart } from "./line-chart";
export { PieChart } from "./pie-chart";
export { DatePicker } from "./date-picker";
export type { DateRangePreset } from "./date-picker";
export { Combobox } from "./combobox";
export type { ComboboxOption } from "./combobox";

// ── Phase 3+ molecules ──
export { Callout } from "./callout";
export type { CalloutProps, CalloutVariant } from "./callout";
export { PageError } from "./page-error";
export { DataBoundary } from "./data-boundary";
export { TintedIconTile } from "./tinted-icon-tile";
export type { TintedIconTileProps, TintedIconTileColor } from "./tinted-icon-tile";
export { AnimatedPlaceholder } from "./animated-placeholder";
export type { AnimatedPlaceholderProps, AnimatedPlaceholderType } from "./animated-placeholder";
export { Info } from "./info";
export type { InfoProps, InfoAccent } from "./info";
export { Pill } from "./pill";
export type { PillProps } from "./pill";
export { Tag } from "./tag";
export type { TagProps, TagColor, TagVariant, TagWeight } from "./tag";
export { AnimatedButton } from "./animated-button";
export type { AnimatedButtonProps } from "./animated-button";
export { OverflowingTextWithTooltip } from "./overflowing-text-with-tooltip";
export type { OverflowingTextWithTooltipProps } from "./overflowing-text-with-tooltip";
export { CircularProgressBar } from "./circular-progress-bar";
export type { CircularProgressBarProps } from "./circular-progress-bar";

// ── Device management molecules ──
export { StorageGauge } from "./storage-gauge";
export { Dot } from "./dot";
export { DeviceStatusBadge } from "./device-status-badge";
export { DeviceHealthCard } from "./device-health-card";
export { ActivityTimeline } from "./activity-timeline";
export { Timeline } from "./timeline";
export type { TimelineRowData, TimelineBlockData } from "./timeline";
export { AvatarGroup } from "./avatar-group";
export type { AvatarGroupProps } from "./avatar-group";
export { CalendarMonth } from "./calendar-month";
export type { CalendarMonthProps, CalendarDay } from "./calendar-month";
export { ViewBar } from "./view-bar";
export type { ViewBarProps, ViewType, FilterChip, SortChip } from "./view-bar";

export { MultiSelect } from "./multi-select";
export type { MultiSelectOption } from "./multi-select";

// ── Specialized form inputs ──
export { IpInput, isValidIpv4 } from "./ip-input";
export { PortInput, clampPort } from "./port-input";
export { IpPortInput, parseIpPort } from "./ip-port-input";
export { ExpiryPicker } from "./expiry-picker";
export type { ExpiryPreset, ExpiryValue } from "./expiry-picker";
export { PermissionMultiSelect } from "./permission-multiselect";

// ── Right side panel ──
export { SidePanel, ResizablePanelGap } from "./side-panel";

// ── Schema-driven form infrastructure ──
export type { FormSchemaDefinition, FormFieldMetaEntry, FormSectionDef } from "@/lib/form-field-meta";
